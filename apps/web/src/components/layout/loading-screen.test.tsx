// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoadingScreen } from "./loading-screen";

describe("LoadingScreen", () => {
	it("renders the CVMate brand and spinner", () => {
		render(<LoadingScreen />);

		expect(screen.getByText("CVMate")).toBeInTheDocument();
		expect(screen.getByLabelText("Loading")).toBeInTheDocument();
	});

	it("uses the CVMate brand in the initial HTML loader", () => {
		const html = readFileSync("index.html", "utf8");

		expect(html).toContain('<div class="initial-loader__brand" aria-label="CVMate">CVMate</div>');
		expect(html).not.toContain('alt="Reactive Resume"');
	});

	it("fills the viewport (fixed inset-0)", () => {
		const { container } = render(<LoadingScreen />);

		const wrapper = container.firstChild as HTMLElement;
		expect(wrapper.className).toContain("fixed");
		expect(wrapper.className).toContain("inset-0");
	});
});
