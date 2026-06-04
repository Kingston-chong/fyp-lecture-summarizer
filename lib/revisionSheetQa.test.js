import { describe, it, expect } from "vitest";
import {
  formatRevisionSheetQaMarkdown,
  splitRevisionSheetAtQuickQa,
} from "./revisionSheetQa.js";

describe("revisionSheetQa", () => {
  it("strips Q:/A: labels", () => {
    const md = `# Quick Q&A

**Q:** What is entropy?
**A:** A measure of disorder.

**Q:** Define heat
**A:** Energy transfer.`;
    const out = formatRevisionSheetQaMarkdown(md);
    expect(out).toContain("**What is entropy?**");
    expect(out).not.toContain("**Q:**");
    expect(out).toContain("A measure of disorder.");
  });

  it("splits at Quick Q&A heading", () => {
    const md = "# Topic\n\nBody\n\n# Quick Q&A\n\n**Q?**";
    const { before, qa } = splitRevisionSheetAtQuickQa(md);
    expect(before).toContain("Topic");
    expect(qa).toMatch(/Quick Q&A/i);
  });
});
