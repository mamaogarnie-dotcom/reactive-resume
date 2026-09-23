import type { IncomingHttpHeaders } from "node:http";
import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { ORPCError } from "@orpc/client";
import sanitizeHtml from "sanitize-html";
import { isPrivateOrLoopbackHost, parseUrl } from "@reactive-resume/utils/url-security.node";

const MAX_REDIRECTS = 5;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_TEXT_CHARS = 50_000;
const TOTAL_TIMEOUT_MS = 12_000;
const MAX_RESOLVED_ADDRESSES = 4;

type ResolvedAddress = {
	address: string;
	family: 4 | 6;
};

type UrlFetchResponse = {
	statusCode: number;
	headers: IncomingHttpHeaders;
	body: Uint8Array;
};

type UrlFetchDependencies = {
	resolveHostname: (hostname: string) => Promise<ResolvedAddress[]>;
	requestPinned: (url: URL, addresses: ResolvedAddress[], deadline: number) => Promise<UrlFetchResponse>;
};

function badRequest(message: string, cause?: unknown) {
	return new ORPCError("BAD_REQUEST", {
		message,
		...(cause === undefined ? {} : { cause }),
	});
}

function stripIpv6Brackets(hostname: string) {
	return hostname.replace(/^\[/, "").replace(/\]$/, "");
}

function parseAndValidateTarget(input: string): URL {
	const parsed = parseUrl(input.trim());

	if (!parsed || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) {
		throw badRequest("The job-offer link must use http or https.");
	}

	if (parsed.username || parsed.password) {
		throw badRequest("Job-offer links containing credentials are not allowed.");
	}

	const hostname = stripIpv6Brackets(parsed.hostname);

	if (!hostname || isPrivateOrLoopbackHost(hostname)) {
		throw badRequest("The job-offer link points to a private or local address.");
	}

	return parsed;
}

function remainingMs(deadline: number) {
	return Math.max(1, deadline - Date.now());
}

async function withDeadline<T>(promise: Promise<T>, deadline: number, message: string): Promise<T> {
	const timeoutMs = remainingMs(deadline);
	let timeout: NodeJS.Timeout | undefined;

	try {
		return await Promise.race([
			promise,
			new Promise<T>((_, reject) => {
				timeout = setTimeout(() => reject(badRequest(message)), timeoutMs);
			}),
		]);
	} finally {
		if (timeout) clearTimeout(timeout);
	}
}

async function resolvePublicAddresses(hostname: string, deadline: number): Promise<ResolvedAddress[]> {
	const normalized = stripIpv6Brackets(hostname);

	if (isPrivateOrLoopbackHost(normalized)) {
		throw badRequest("The job-offer link points to a private or local address.");
	}

	let records: Array<{ address: string; family: number }>;

	try {
		records = await withDeadline(
			lookup(normalized, { all: true, verbatim: true }),
			deadline,
			"Resolving the job-offer host timed out.",
		);
	} catch (error) {
		if (error instanceof ORPCError) throw error;
		throw badRequest("The job-offer host could not be resolved.", error);
	}

	const addresses = records
		.map((record) => ({
			address: record.address,
			family: record.family as 4 | 6,
		}))
		.filter((record): record is ResolvedAddress => record.family === 4 || record.family === 6);

	if (addresses.length === 0) {
		throw badRequest("The job-offer host did not resolve to a usable address.");
	}

	if (addresses.some((record) => isPrivateOrLoopbackHost(record.address))) {
		throw badRequest("The job-offer host resolves to a private or local address.");
	}

	return addresses.slice(0, MAX_RESOLVED_ADDRESSES);
}

function headerValue(headers: IncomingHttpHeaders, name: string): string | null {
	const value = headers[name.toLowerCase()];

	if (Array.isArray(value)) return value[0] ?? null;
	return typeof value === "string" ? value : null;
}

function isRedirect(statusCode: number) {
	return [301, 302, 303, 307, 308].includes(statusCode);
}

function acceptedContentType(contentType: string | null) {
	if (!contentType) return false;

	const normalized = contentType.toLowerCase();
	return normalized.startsWith("text/html") || normalized.startsWith("text/plain");
}

function normalizeText(text: string) {
	return text
		.replaceAll("\u0000", "")
		.replace(/\r\n?/g, "\n")
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n[ \t]+/g, "\n")
		.replace(/[ \t]{2,}/g, " ")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

function htmlToText(html: string) {
	const withoutNoise = html
		.replace(/<(script|style|svg|canvas|template)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
		.replace(/<(br|hr)\b[^>]*>/gi, "\n")
		.replace(/<\/(p|div|section|article|main|header|footer|aside|li|ul|ol|h[1-6]|tr|table|blockquote)>/gi, "\n");

	const text = sanitizeHtml(withoutNoise, {
		allowedTags: [],
		allowedAttributes: {},
	});

	return normalizeText(text);
}

function decodeBody(body: Uint8Array, contentType: string) {
	const decoded = new TextDecoder("utf-8", { fatal: false }).decode(body);

	return contentType.toLowerCase().startsWith("text/html") ? htmlToText(decoded) : normalizeText(decoded);
}

function validateResponseSize(headers: IncomingHttpHeaders, body: Uint8Array) {
	const contentLength = headerValue(headers, "content-length");

	if (contentLength) {
		const parsed = Number.parseInt(contentLength, 10);

		if (Number.isFinite(parsed) && parsed > MAX_RESPONSE_BYTES) {
			throw badRequest("The job-offer page is too large to read automatically.");
		}
	}

	if (body.byteLength > MAX_RESPONSE_BYTES) {
		throw badRequest("The job-offer page is too large to read automatically.");
	}
}

function requestSingleAddress(url: URL, address: ResolvedAddress, deadline: number): Promise<UrlFetchResponse> {
	return new Promise((resolve, reject) => {
		const requestFactory = url.protocol === "https:" ? httpsRequest : httpRequest;
		const hostname = stripIpv6Brackets(url.hostname);
		const timeoutMs = remainingMs(deadline);

		const request = requestFactory(
			{
				protocol: url.protocol,
				hostname: address.address,
				port: url.port || undefined,
				method: "GET",
				path: `${url.pathname}${url.search}`,
				headers: {
					Accept: "text/html,text/plain;q=0.9",
					"Accept-Encoding": "identity",
					Host: url.host,
					"User-Agent": "Mozilla/5.0 (compatible; 1story-job-offer-fetch/1.0)",
				},
				...(url.protocol === "https:" ? { servername: hostname } : {}),
			},
			(response) => {
				const statusCode = response.statusCode ?? 0;
				const headers = response.headers;

				if (isRedirect(statusCode) || statusCode < 200 || statusCode >= 300) {
					response.resume();
					resolve({
						statusCode,
						headers,
						body: new Uint8Array(),
					});
					return;
				}

				const contentType = headerValue(headers, "content-type");

				if (!acceptedContentType(contentType)) {
					response.resume();
					reject(badRequest("The job-offer link did not return an HTML or plain-text page."));
					return;
				}

				const contentLength = headerValue(headers, "content-length");

				if (contentLength) {
					const parsed = Number.parseInt(contentLength, 10);

					if (Number.isFinite(parsed) && parsed > MAX_RESPONSE_BYTES) {
						response.resume();
						reject(badRequest("The job-offer page is too large to read automatically."));
						return;
					}
				}

				const chunks: Buffer[] = [];
				let totalBytes = 0;

				response.on("data", (chunk: Buffer | string) => {
					const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
					totalBytes += buffer.byteLength;

					if (totalBytes > MAX_RESPONSE_BYTES) {
						response.destroy(badRequest("The job-offer page is too large to read automatically."));
						return;
					}

					chunks.push(buffer);
				});

				response.on("end", () => {
					resolve({
						statusCode,
						headers,
						body: new Uint8Array(Buffer.concat(chunks)),
					});
				});

				response.on("error", reject);
			},
		);

		request.setTimeout(timeoutMs, () => {
			request.destroy(badRequest("Reading the job-offer page timed out."));
		});

		request.on("error", reject);
		request.end();
	});
}

async function requestPinned(url: URL, addresses: ResolvedAddress[], deadline: number): Promise<UrlFetchResponse> {
	let lastError: unknown;

	for (const address of addresses) {
		if (Date.now() >= deadline) {
			throw badRequest("Reading the job-offer page timed out.");
		}

		try {
			return await requestSingleAddress(url, address, deadline);
		} catch (error) {
			if (error instanceof ORPCError) throw error;
			lastError = error;
		}
	}

	throw badRequest("The job-offer page could not be reached.", lastError);
}

const defaultDependencies: UrlFetchDependencies = {
	resolveHostname: async (hostname) => resolvePublicAddresses(hostname, Date.now() + TOTAL_TIMEOUT_MS),
	requestPinned,
};

async function resolveWithDependencies(
	url: URL,
	dependencies: UrlFetchDependencies,
	deadline: number,
): Promise<ResolvedAddress[]> {
	const hostname = stripIpv6Brackets(url.hostname);

	if (isPrivateOrLoopbackHost(hostname)) {
		throw badRequest("The job-offer link points to a private or local address.");
	}

	let addresses: ResolvedAddress[];

	try {
		addresses = await withDeadline(
			dependencies.resolveHostname(hostname),
			deadline,
			"Resolving the job-offer host timed out.",
		);
	} catch (error) {
		if (error instanceof ORPCError) throw error;
		throw badRequest("The job-offer host could not be resolved.", error);
	}

	if (addresses.length === 0) {
		throw badRequest("The job-offer host did not resolve to a usable address.");
	}

	if (addresses.some((record) => isPrivateOrLoopbackHost(record.address))) {
		throw badRequest("The job-offer host resolves to a private or local address.");
	}

	return addresses.slice(0, MAX_RESOLVED_ADDRESSES);
}

export async function fetchJobOfferTextFromUrl(
	input: string,
	dependencies: UrlFetchDependencies = defaultDependencies,
): Promise<string> {
	let currentUrl = parseAndValidateTarget(input);
	const deadline = Date.now() + TOTAL_TIMEOUT_MS;

	for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
		const addresses =
			dependencies === defaultDependencies
				? await resolvePublicAddresses(stripIpv6Brackets(currentUrl.hostname), deadline)
				: await resolveWithDependencies(currentUrl, dependencies, deadline);

		let response: UrlFetchResponse;

		try {
			response = await withDeadline(
				dependencies.requestPinned(currentUrl, addresses, deadline),
				deadline,
				"Reading the job-offer page timed out.",
			);
		} catch (error) {
			if (error instanceof ORPCError) throw error;
			throw badRequest("The job-offer page could not be reached.", error);
		}

		if (isRedirect(response.statusCode)) {
			const location = headerValue(response.headers, "location");

			if (!location) {
				throw badRequest("The job-offer page returned an invalid redirect.");
			}

			if (redirectCount >= MAX_REDIRECTS) {
				throw badRequest("The job-offer page redirected too many times.");
			}

			currentUrl = parseAndValidateTarget(new URL(location, currentUrl).toString());
			continue;
		}

		if (response.statusCode < 200 || response.statusCode >= 300) {
			throw badRequest(
				"The job-offer site blocked or refused automatic retrieval. Paste the offer text or attach a file instead.",
			);
		}

		const contentType = headerValue(response.headers, "content-type");

		if (!acceptedContentType(contentType)) {
			throw badRequest("The job-offer link did not return an HTML or plain-text page.");
		}

		validateResponseSize(response.headers, response.body);

		const text = decodeBody(response.body, contentType ?? "text/plain").slice(0, MAX_TEXT_CHARS);

		if (text.length < 40) {
			throw badRequest(
				"The job-offer page did not contain enough readable text. Paste the offer text or attach a file instead.",
			);
		}

		return text;
	}

	throw badRequest("The job-offer page redirected too many times.");
}

export const __testables = {
	MAX_REDIRECTS,
	MAX_RESPONSE_BYTES,
	MAX_TEXT_CHARS,
	acceptedContentType,
	htmlToText,
	normalizeText,
	parseAndValidateTarget,
	resolveWithDependencies,
	validateResponseSize,
};
