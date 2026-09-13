import fs from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import {
	DeleteObjectCommand,
	GetObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import sharp from "sharp";
import { env } from "@reactive-resume/env/server";
import { getLocalDataDirectory } from "@reactive-resume/utils/monorepo.node";
import { generateId } from "@reactive-resume/utils/string";

interface StorageWriteInput {
	key: string;
	data: Uint8Array;
	contentType: string;
	private?: boolean;
}

interface StorageReadResult {
	data: Uint8Array;
	size: number;
	etag?: string;
	lastModified?: Date;
	contentType?: string;
}

interface StorageService {
	list(prefix: string): Promise<string[]>;
	write(input: StorageWriteInput): Promise<void>;
	read(key: string): Promise<StorageReadResult | null>;
	delete(key: string): Promise<boolean>;
	healthcheck(): Promise<StorageHealthResult>;
}

interface StorageHealthResult {
	status: "healthy" | "unhealthy";
	type: "local" | "s3";
	message: string;
	error?: string;
}

const CONTENT_TYPE_MAP: Record<string, string> = {
	".webp": "image/webp",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".png": "image/png",
	".gif": "image/gif",
	".svg": "image/svg+xml",
	".pdf": "application/pdf",
};

const DEFAULT_CONTENT_TYPE = "application/octet-stream";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const IMAGE_MIME_TYPES = new Set(["image/gif", "image/png", "image/jpeg", "image/webp"]);
const PUBLIC_UPLOAD_MIME_TYPES = new Set([...IMAGE_MIME_TYPES, "application/pdf"]);

const IMAGE_FORMAT_TO_MIME: Record<string, string> = {
	jpeg: "image/jpeg",
	png: "image/png",
	webp: "image/webp",
	gif: "image/gif",
};

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
	"image/jpeg": "jpeg",
	"image/png": "png",
	"image/webp": "webp",
	"image/gif": "gif",
	"application/pdf": "pdf",
};

// Derive the stored key's extension from the validated content type. Keys use a random ID
// instead of a timestamp so concurrent uploads cannot overwrite one another.
function buildFileKey(userId: string, contentType: string): string {
	const extension = EXTENSION_BY_CONTENT_TYPE[contentType] ?? "bin";
	return normalizeStorageKey(`uploads/${userId}/pictures/${generateId()}.${extension}`);
}

export function buildPublicUrl(path: string): string {
	const normalizedPath = path.startsWith("/") ? path : `/${path}`;
	const apiPath = normalizedPath.startsWith("/api/") ? normalizedPath : `/api${normalizedPath}`;
	return new URL(apiPath, env.APP_URL).toString();
}

export function inferContentType(filename: string): string {
	const extension = extname(filename).toLowerCase();
	return CONTENT_TYPE_MAP[extension] ?? DEFAULT_CONTENT_TYPE;
}

export function isImageFile(mimeType: string): boolean {
	return IMAGE_MIME_TYPES.has(mimeType);
}

export function isAllowedPublicUpload(mimeType: string): boolean {
	return PUBLIC_UPLOAD_MIME_TYPES.has(mimeType);
}

export function normalizeStorageKey(key: string): string {
	const normalizedKey = key.trim().replace(/^[/\\]+/, "");
	const segments = normalizedKey.split(/[/\\]+/).filter(Boolean);

	if (segments.length === 0 || segments.some((segment) => segment === "." || segment === "..")) {
		throw new Error("Invalid storage key");
	}

	return segments.join("/");
}

export function hasPdfSignature(data: Uint8Array): boolean {
	return (
		data.length >= 5 && data[0] === 0x25 && data[1] === 0x50 && data[2] === 0x44 && data[3] === 0x46 && data[4] === 0x2d
	);
}

export async function inspectImageUpload(data: Uint8Array, declaredMimeType: string) {
	if (!isImageFile(declaredMimeType)) {
		throw new Error("Unsupported image media type");
	}

	const metadata = await sharp(data).metadata();
	const actualMimeType = metadata.format ? IMAGE_FORMAT_TO_MIME[metadata.format] : undefined;

	if (!actualMimeType || actualMimeType !== declaredMimeType) {
		throw new Error("Image content does not match its declared media type");
	}

	return {
		width: metadata.width ?? null,
		height: metadata.height ?? null,
		mediaType: actualMimeType,
	};
}

interface ProcessedImage {
	data: Uint8Array;
	contentType: string;
}

export async function processImageForUpload(file: File): Promise<ProcessedImage> {
	if (file.size > MAX_UPLOAD_BYTES) {
		throw new Error("File size must be less than 10MB");
	}

	const data = new Uint8Array(await file.arrayBuffer());
	await inspectImageUpload(data, file.type);

	if (env.FLAG_DISABLE_IMAGE_PROCESSING) {
		return {
			data,
			contentType: file.type,
		};
	}

	const processedBuffer = await sharp(data)
		.resize(800, 800, { fit: "inside", withoutEnlargement: true })
		.jpeg({ quality: 80 })
		.toBuffer();

	return {
		data: new Uint8Array(processedBuffer),
		contentType: "image/jpeg",
	};
}

class LocalStorageService implements StorageService {
	private rootDirectory: string;

	constructor() {
		this.rootDirectory = getLocalDataDirectory(env.LOCAL_STORAGE_PATH);
	}

	async list(prefix: string): Promise<string[]> {
		const fullPath = this.resolvePath(prefix);

		try {
			const files = await fs.readdir(fullPath, { recursive: true });

			return files.map((file) => join(prefix, file));
		} catch (error: unknown) {
			// If directory doesn't exist, return empty array
			if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
				return [];
			}

			throw error;
		}
	}

	async write({ key, data, private: isPrivate }: StorageWriteInput): Promise<void> {
		if (isPrivate) {
			throw new Error(
				"Private storage writes are not supported by the local filesystem backend. Configure S3 to store private attachments.",
			);
		}

		const fullPath = this.resolvePath(key);

		await fs.mkdir(dirname(fullPath), { recursive: true });
		await fs.writeFile(fullPath, data);
	}

	async read(key: string): Promise<StorageReadResult | null> {
		const fullPath = this.resolvePath(key);
		try {
			const [arrayBuffer, stats] = await Promise.all([fs.readFile(fullPath), fs.stat(fullPath)]);

			return {
				data: arrayBuffer,
				size: stats.size,
				etag: `"${stats.size}-${stats.mtime.getTime()}"`,
				lastModified: stats.mtime,
				contentType: inferContentType(key),
			};
		} catch (error: unknown) {
			if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
				return null;
			}

			throw error;
		}
	}

	async delete(key: string): Promise<boolean> {
		const fullPath = this.resolvePath(key);

		// Check if the path exists and whether it's a file or folder
		try {
			const stats = await fs.stat(fullPath);

			if (stats.isDirectory()) {
				// Delete the directory and its contents recursively
				await fs.rm(fullPath, { recursive: true });
				return true;
			}
			await fs.unlink(fullPath);
			return true;
		} catch {
			// Path does not exist
			return false;
		}
	}

	async healthcheck(): Promise<StorageHealthResult> {
		try {
			await fs.mkdir(this.rootDirectory, { recursive: true });
			await fs.access(this.rootDirectory, fs.constants.R_OK | fs.constants.W_OK);

			return {
				type: "local",
				status: "healthy",
				message: "Local filesystem storage is accessible and has read/write permission.",
			};
		} catch (error: unknown) {
			return {
				type: "local",
				status: "unhealthy",
				message: "Local filesystem storage is not accessible or lacks sufficient permissions.",
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	private resolvePath(key: string): string {
		const normalizedKey = normalizeStorageKey(key);
		return join(this.rootDirectory, ...normalizedKey.split("/"));
	}
}

class S3StorageService implements StorageService {
	private readonly bucket: string;
	private readonly client: S3Client;

	constructor() {
		if (!env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY || !env.S3_BUCKET) {
			throw new Error("S3 credentials are not set");
		}

		this.bucket = env.S3_BUCKET;
		this.client = new S3Client({
			region: env.S3_REGION,
			forcePathStyle: env.S3_FORCE_PATH_STYLE,
			...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT } : {}),
			credentials: {
				accessKeyId: env.S3_ACCESS_KEY_ID,
				secretAccessKey: env.S3_SECRET_ACCESS_KEY,
			},
		});
	}

	async list(prefix: string): Promise<string[]> {
		const command = new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix });
		const response = await this.client.send(command);
		if (!response.Contents) return [];
		return response.Contents.map((object) => object.Key ?? "");
	}

	async write({ key, data, contentType }: StorageWriteInput): Promise<void> {
		// BucketOwnerEnforced rejects object ACLs. Public files use the application proxy
		// with authenticated S3 reads; private attachments retain their access checks.
		const command = new PutObjectCommand({
			Bucket: this.bucket,
			Key: key,
			Body: data,
			ContentType: contentType,
		});

		await this.client.send(command);
	}

	async read(key: string): Promise<StorageReadResult | null> {
		try {
			const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
			const response = await this.client.send(command);
			if (!response.Body) return null;

			const arrayBuffer = await response.Body.transformToByteArray();

			return {
				data: arrayBuffer,
				size: response.ContentLength ?? 0,
				contentType: response.ContentType ?? inferContentType(key),
				...(response.ETag !== undefined ? { etag: response.ETag } : {}),
				...(response.LastModified !== undefined ? { lastModified: response.LastModified } : {}),
			};
		} catch {
			return null;
		}
	}

	async delete(keyOrPrefix: string): Promise<boolean> {
		// Use list to find all matching keys (handles both single file and folder/prefix)
		const keys = await this.list(keyOrPrefix);

		if (keys.length === 0) return false;

		// Delete all matching keys using Promise.allSettled
		const deleteCommands = keys.map((k) => new DeleteObjectCommand({ Bucket: this.bucket, Key: k }));
		const results = await Promise.allSettled(deleteCommands.map((c) => this.client.send(c)));

		// Return true if at least one deletion succeeded
		return results.some((r) => r.status === "fulfilled");
	}

	async healthcheck(): Promise<StorageHealthResult> {
		try {
			const putCommand = new PutObjectCommand({ Bucket: this.bucket, Key: "healthcheck", Body: "OK" });
			await this.client.send(putCommand);

			const deleteCommand = new DeleteObjectCommand({ Bucket: this.bucket, Key: "healthcheck" });
			await this.client.send(deleteCommand);

			return {
				type: "s3",
				status: "healthy",
				message: "S3 storage is accessible and credentials are valid.",
			};
		} catch (error: unknown) {
			return {
				type: "s3",
				status: "unhealthy",
				message: "Failed to connect to S3 storage or invalid credentials.",
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}
}

let cachedService: StorageService | null = null;

export function getStorageService(): StorageService {
	cachedService ??=
		env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY && env.S3_BUCKET
			? new S3StorageService()
			: new LocalStorageService();
	return cachedService;
}

interface UploadFileInput {
	userId: string;
	data: Uint8Array;
	contentType: string;
}

interface UploadFileResult {
	url: string;
	key: string;
}

export async function uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
	if (input.data.byteLength > MAX_UPLOAD_BYTES) {
		throw new Error("File size must be less than 10MB");
	}

	if (!isAllowedPublicUpload(input.contentType)) {
		throw new Error("Unsupported public upload media type");
	}

	const key = buildFileKey(input.userId, input.contentType);
	await getStorageService().write({ key, data: input.data, contentType: input.contentType });
	return { key, url: buildPublicUrl(key) };
}

export const __testables = {
	buildFileKey,
};
