// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoadingScreen } from "./loading-screen";

describe("LoadingScreen", () => {
	it("renders the 1story brand and spinner", () => {
		render(<LoadingScreen />);

		expect(screen.getByText("1story")).toBeInTheDocument();
		expect(screen.getByLabelText("Loading")).toBeInTheDocument();
	});

	it("uses the 1story brand in the initial HTML loader", () => {
		const html = readFileSync("index.html", "utf8");

		expect(html).toContain('<img class="initial-loader__brand" src="/logo/light.svg" alt="1story" />');
		expect(html).not.toContain('alt="Reactive Resume"');
		expect(html).toContain('<span class="initial-loader__sr-only">Ładowanie</span>');
	});

	it("fills the viewport (fixed inset-0)", () => {
		const { container } = render(<LoadingScreen />);

		const wrapper = container.firstChild as HTMLElement;
		expect(wrapper.className).toContain("fixed");
		expect(wrapper.className).toContain("inset-0");
	});
});
