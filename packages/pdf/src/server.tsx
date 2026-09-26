import type { ResumeData } from "@reactive-resume/schema/resume/data";
import type { Template } from "@reactive-resume/schema/templates";
import type { ResumePdfMetrics } from "./metrics";
import type { SectionTitleResolver } from "./section-title";
import * as React from "react";
import { parseResumeData } from "@reactive-resume/schema/resume/data";
import { renderToBuffer } from "#react-pdf-renderer";
import { ResumeDocument } from "./document";
import { measureResumePdfBytes } from "./metrics";

if (!("React" in globalThis)) {
	Object.assign(globalThis, { React });
}

export type CreateResumePdfFileOptions = {
	data: ResumeData;
	filename: string;
	template?: Template | undefined;
	resolveSectionTitle?: SectionTitleResolver | undefined;
};

type RenderResumePdfOptions = Omit<CreateResumePdfFileOptions, "filename">;

const renderResumePdfBytes = async ({
	data: input,
	template,
	resolveSectionTitle,
}: RenderResumePdfOptions): Promise<Uint8Array<ArrayBuffer>> => {
	const data = parseResumeData(input);
	const document = React.createElement(ResumeDocument, {
		data,
		template: template ?? data.metadata.template,
		resolveSectionTitle,
	}) as Parameters<typeof renderToBuffer>[0];
	const buffer = await renderToBuffer(document);
	const bytes = new Uint8Array(new ArrayBuffer(buffer.byteLength));
	bytes.set(buffer);

	return bytes;
};

export const createResumePdfFile = async ({ filename, ...options }: CreateResumePdfFileOptions): Promise<File> => {
	const bytes = await renderResumePdfBytes(options);
	return new File([bytes], filename, { type: "application/pdf" });
};

export type CreateResumePdfMetricsOptions = RenderResumePdfOptions;

export const createResumePdfMetrics = async (options: CreateResumePdfMetricsOptions): Promise<ResumePdfMetrics> =>
	measureResumePdfBytes(await renderResumePdfBytes(options));

export type { ResumePdfMetrics } from "./metrics";
