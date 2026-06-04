import { describe, it, expect } from "vitest";
import { stripMarkdownFence } from "./stripMarkdownFence.js";

describe("stripMarkdownFence", () => {
  it("removes markdown code fences", () => {
    expect(stripMarkdownFence("```markdown\n# Hi\n```")).toBe("# Hi");
  });

  it("returns plain text unchanged", () => {
    expect(stripMarkdownFence("# Title")).toBe("# Title");
  });
});
