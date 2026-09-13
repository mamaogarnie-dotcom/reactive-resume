import { describe, expect, it, vi } from "vitest";

const envMock = vi.hoisted(() => ({
	APP_URL: "https://example.com",
	LOCAL_STORAGE_PATH: "",
	S3_ACCESS_KEY_ID: undefined as string | undefined,
	S3_SECRET_ACCESS_KEY: undefined as string | undefined,
	S3_REGION: "us-east-1",
	S3_ENDPOINT: undefined as string | undefined,
	S3_BUCKET: undefined as string | undefined,
	S3_FORCE_PATH_STYLE: false,
	FLAG_DISABLE_IMAGE_PROCESSING: false,
}));

vi.mock("@reactive-resume/env/server", () => ({ env: envMock }));

const sharpMetadataMock = vi.hoisted(() =>
	vi.fn(async () => ({
		width: 100,
		height: 100,
		format: "png",
	})),
);

// sharp is exercised by processImageForUpload; keep it out of the import graph entirely
// because resolving it loads native bindings we can't rely on in CI.
vi.mock("sharp", () => {
	const chain = {
		resize: () => chain,
		jpeg: () => chain,
		rotate: () => chain,
		toBuffer: async () => Buffer.from("processed"),
		metadata: sharpMetadataMock,
	};
	return { default: () => chain };
});
vi.mock("@aws-sdk/client-s3", () => ({
	S3Client: vi.fn(),
	PutObjectCommand: vi.fn(),
	GetObjectCommand: vi.fn(),
	DeleteObjectCommand: vi.fn(),
	ListObjectsV2Command: vi.fn(),
}));

const {
	MAX_UPLOAD_BYTES,
	__testables,
	buildPublicUrl,
	getStorageService,
	hasPdfSignature,
	inferContentType,
	inspectImageUpload,
	isAllowedPublicUpload,
	isImageFile,
	normalizeStorageKey,
	processImageForUpload,
} = await import("./service");

const makeFile = (bytes: Uint8Array, type = "image/png") =>
	({
		arrayBuffer: async () => bytes.buffer,
		type,
	}) as unknown as File;

describe("buildPublicUrl", () => {
	it("builds the public API URL from a storage key", () => {
		expect(buildPublicUrl("uploads/user-1/pictures/photo.jpeg")).toBe(
			"https://example.com/api/uploads/user-1/pictures/photo.jpeg",
		);
	});

	it("does not duplicate the API prefix", () => {
		expect(buildPublicUrl("/api/uploads/user-1/pictures/photo.jpeg")).toBe(
			"https://example.com/api/uploads/user-1/pictures/photo.jpeg",
		);
	});
});

describe("inferContentType", () => {
	it("maps common image extensions to their MIME types", () => {
		expect(inferContentType("photo.jpg")).toBe("image/jpeg");
		expect(inferContentType("photo.jpeg")).toBe("image/jpeg");
		expect(inferContentType("photo.png")).toBe("image/png");
		expect(inferContentType("animated.gif")).toBe("image/gif");
		expect(inferContentType("logo.svg")).toBe("image/svg+xml");
		expect(inferContentType("photo.webp")).toBe("image/webp");
	});

	it("maps .pdf to application/pdf", () => {
		expect(inferContentType("doc.pdf")).toBe("application/pdf");
	});

	it("is case-insensitive on the extension", () => {
		expect(inferContentType("PHOTO.JPG")).toBe("image/jpeg");
		expect(inferContentType("Document.PDF")).toBe("application/pdf");
	});

	it("falls back to application/octet-stream for unknown extensions", () => {
		expect(inferContentType("data.xyz")).toBe("application/octet-stream");
		expect(inferContentType("README")).toBe("application/octet-stream");
	});

	it("uses just the file extension regardless of path depth", () => {
		expect(inferContentType("/nested/dir/file.png")).toBe("image/png");
	});
});

describe("processImageForUpload", () => {
	it("returns a validated image untouched when image processing is disabled", async () => {
		envMock.FLAG_DISABLE_IMAGE_PROCESSING = true;
		const file = makeFile(new Uint8Array([1, 2, 3, 4]), "image/png");

		const result = await processImageForUpload(file);

		expect(result.contentType).toBe("image/png");
		expect(Array.from(result.data)).toEqual([1, 2, 3, 4]);
	});

	it("re-encodes a validated image to JPEG when processing is enabled", async () => {
		envMock.FLAG_DISABLE_IMAGE_PROCESSING = false;
		const file = makeFile(new Uint8Array([5, 6, 7, 8]), "image/png");

		const result = await processImageForUpload(file);

		expect(result.contentType).toBe("image/jpeg");
		expect(result.data.length).toBeGreaterThan(0);
		expect(Array.from(result.data)).not.toEqual([5, 6, 7, 8]);
	});

	it("rejects a declared image type that does not match decoded content", async () => {
		sharpMetadataMock.mockResolvedValueOnce({
			width: 100,
			height: 100,
			format: "jpeg",
		});

		await expect(inspectImageUpload(new Uint8Array([1, 2, 3]), "image/png")).rejects.toThrow(
			"Image content does not match its declared media type",
		);
	});

	it("rejects oversized images before reading their bytes", async () => {
		const arrayBuffer = vi.fn(async () => new ArrayBuffer(0));
		const file = {
			arrayBuffer,
			size: MAX_UPLOAD_BYTES + 1,
			type: "image/png",
		} as unknown as File;

		await expect(processImageForUpload(file)).rejects.toThrow("File size must be less than 10MB");
		expect(arrayBuffer).not.toHaveBeenCalled();
	});
});

describe("isImageFile", () => {
	it("returns true for supported image mime types", () => {
		for (const type of ["image/gif", "image/png", "image/jpeg", "image/webp"]) {
			expect(isImageFile(type)).toBe(true);
		}
	});

	it("returns false for image/svg+xml (not in the upload allowlist)", () => {
		expect(isImageFile("image/svg+xml")).toBe(false);
	});

	it("returns false for application/pdf and other non-image types", () => {
		expect(isImageFile("application/pdf")).toBe(false);
		expect(isImageFile("text/plain")).toBe(false);
		expect(isImageFile("")).toBe(false);
	});
});

describe("public upload validation", () => {
	it("allows only the public image/PDF media types", () => {
		for (const type of ["image/gif", "image/png", "image/jpeg", "image/webp", "application/pdf"]) {
			expect(isAllowedPublicUpload(type)).toBe(true);
		}

		expect(isAllowedPublicUpload("image/svg+xml")).toBe(false);
		expect(isAllowedPublicUpload("text/html")).toBe(false);
		expect(isAllowedPublicUpload("application/javascript")).toBe(false);
	});

	it("requires a PDF magic signature", () => {
		expect(hasPdfSignature(new TextEncoder().encode("%PDF-1.7\n"))).toBe(true);
		expect(hasPdfSignature(new TextEncoder().encode("<html>%PDF-1.7</html>"))).toBe(false);
	});
});

describe("storage keys", () => {
	it("normalizes separators but rejects dot-segment traversal", () => {
		expect(normalizeStorageKey("/uploads/user-1/pictures/photo.png")).toBe("uploads/user-1/pictures/photo.png");
		expect(normalizeStorageKey("uploads\\user-1\\pictures\\photo.png")).toBe("uploads/user-1/pictures/photo.png");

		expect(() => normalizeStorageKey("../secret.txt")).toThrow("Invalid storage key");
		expect(() => normalizeStorageKey("uploads/user-1/../user-2/secret.txt")).toThrow("Invalid storage key");
		expect(() => normalizeStorageKey("uploads\\user-1\\..\\user-2\\secret.txt")).toThrow("Invalid storage key");
	});

	it("generates distinct user-scoped keys instead of timestamp-only names", () => {
		const first = __testables.buildFileKey("user-1", "image/png");
		const second = __testables.buildFileKey("user-1", "image/png");

		expect(first).toMatch(/^uploads\/user-1\/pictures\/.+\.png$/);
		expect(second).toMatch(/^uploads\/user-1\/pictures\/.+\.png$/);
		expect(second).not.toBe(first);
	});
});

describe("LocalStorageService", () => {
	it("rejects private writes instead of silently storing them on the local filesystem", async () => {
		await expect(
			getStorageService().write({
				key: "uploads/user/agent/thread/file.txt",
				data: new TextEncoder().encode("private"),
				contentType: "text/plain",
				private: true,
			}),
		).rejects.toThrow("Private storage writes are not supported by the local filesystem backend.");
	});

	it("rejects traversal keys instead of silently rewriting them", async () => {
		await expect(getStorageService().read("../outside.txt")).rejects.toThrow("Invalid storage key");
		await expect(getStorageService().read("uploads\\user-1\\..\\user-2\\secret.txt")).rejects.toThrow(
			"Invalid storage key",
		);
	});
});
