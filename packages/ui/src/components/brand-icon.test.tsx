import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandIcon } from "./brand-icon";

describe("BrandIcon", () => {
it("renders one approved 1story asset in V1", () => {
render(<BrandIcon />);

expect(screen.getAllByRole("img")).toHaveLength(1);
expect(screen.getByRole("img", { name: "1story" })).toBeInTheDocument();
});

it("uses the primary wordmark by default", () => {
render(<BrandIcon />);

expect(screen.getByRole("img").getAttribute("src")).toBe("/logo/light.svg");
expect(screen.getByRole("img")).toHaveClass("h-12");
expect(screen.getByRole("img")).toHaveClass("w-auto");
});

it("uses the approved symbol for the icon variant", () => {
render(<BrandIcon variant="icon" />);

expect(screen.getByRole("img").getAttribute("src")).toBe("/icon/light.svg");
expect(screen.getByRole("img")).toHaveClass("size-10");
});

it("merges a custom className", () => {
render(<BrandIcon className="my-custom" />);

expect(screen.getByRole("img")).toHaveClass("my-custom");
});

it("allows decorative usage with an empty alt", () => {
const { container } = render(
<BrandIcon variant="icon" alt="" aria-hidden="true" />,
);

const image = container.querySelector("img");

expect(image?.getAttribute("alt")).toBe("");
expect(image?.getAttribute("aria-hidden")).toBe("true");
});
});