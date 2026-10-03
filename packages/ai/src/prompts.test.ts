import { describe, expect, it } from "vitest";
import {
	atsReviewSystemPrompt,
	atsReviewUserPromptTemplate,
	chatSystemPromptTemplate,
	docxParserSystemPrompt,
	docxParserUserPrompt,
	pdfParserSystemPrompt,
	pdfParserUserPrompt,
} from "./prompts";

describe("prompts", () => {
	it("loads markdown prompts as strings in Node runtimes", () => {
		expect(atsReviewSystemPrompt).toContain("resume");
		expect(atsReviewUserPromptTemplate).toContain("{{EXTRACTED_TEXT}}");
		expect(chatSystemPromptTemplate).toContain("resume");
		expect(docxParserSystemPrompt).toContain("DOCX");
		expect(docxParserUserPrompt).toContain("Microsoft Word");
		expect(pdfParserSystemPrompt).toContain("PDF");
		expect(pdfParserUserPrompt).toContain("PDF");
	});

	it("forbids the ATS review from inventing a score", () => {
		expect(atsReviewSystemPrompt).toContain("Never output a score");
		expect(atsReviewUserPromptTemplate).toContain("{{FINDINGS}}");
		expect(atsReviewUserPromptTemplate).toContain("{{JOB_DESCRIPTION_SECTION}}");
	});

	it("explains the ATS review's redaction placeholders and forbids echoing them", () => {
		for (const placeholder of ["[OSOBA]", "[EMAIL]", "[TELEFON]", "[URL]", "[ADRES]"]) {
			expect(atsReviewSystemPrompt).toContain(placeholder);
		}
		expect(atsReviewSystemPrompt).toContain("Never quote, repeat, rewrite or mention these placeholders");
		expect(atsReviewSystemPrompt).toContain("Do not comment on contact details");
		expect(atsReviewUserPromptTemplate).toContain("{{CONTACT_PRESENCE}}");
	});
});
