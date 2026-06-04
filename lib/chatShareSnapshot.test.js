import { describe, it, expect } from "vitest";
import {
  buildChatShareSnapshot,
  canPublishSummaryShare,
  dbMessageToShareMessage,
  parsePublicChatSnapshot,
  shareSnapshotContentEqual,
} from "./chatShareSnapshot.js";

describe("chatShareSnapshot", () => {
  it("parses v1 user JSON content", () => {
    const row = dbMessageToShareMessage({
      role: "user",
      content: JSON.stringify({ v: 1, t: "explain this", n: 0 }),
    });
    expect(row?.content).toBe("explain this");
  });

  it("treats snapshots with same content as equal regardless of sharedAt", () => {
    const base = buildChatShareSnapshot(
      { title: "T", output: "Hello", model: "m", summarizeFor: "student" },
      [{ role: "user", content: "Hi" }],
    );
    const again = { ...base, sharedAt: "2099-01-01T00:00:00.000Z" };
    expect(shareSnapshotContentEqual(base, again)).toBe(true);
    const changed = buildChatShareSnapshot(
      { title: "T", output: "Hello world", model: "m", summarizeFor: "student" },
      [{ role: "user", content: "Hi" }],
    );
    expect(shareSnapshotContentEqual(base, changed)).toBe(false);
  });

  it("allows publish when summary output exists without chat", () => {
    expect(canPublishSummaryShare({ output: "## Notes\n\nDone" }, [])).toBe(true);
    expect(canPublishSummaryShare({ output: "   " }, [])).toBe(false);
    expect(
      canPublishSummaryShare(
        { output: "" },
        [{ role: "user", content: "Hi" }],
      ),
    ).toBe(true);
  });

  it("builds snapshot with summary only", () => {
    const snap = buildChatShareSnapshot(
      {
        title: "Lecture 1",
        model: "chatgpt",
        summarizeFor: "student",
        output: "## Intro\n\nHello",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      [],
    );
    expect(snap.messages).toHaveLength(0);
    expect(snap.summaryOutput).toContain("Intro");
    const parsed = parsePublicChatSnapshot(snap);
    expect(parsed?.messages).toHaveLength(0);
    expect(parsed?.summaryOutput).toContain("Intro");
  });

  it("builds and parses round-trip snapshot", () => {
    const snap = buildChatShareSnapshot(
      {
        title: "Lecture 1",
        model: "chatgpt",
        summarizeFor: "student",
        output: "## Intro\n\nHello",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello!", modelLabel: "ChatGPT" },
      ],
    );
    const parsed = parsePublicChatSnapshot(snap);
    expect(parsed?.title).toBe("Lecture 1");
    expect(parsed?.messages).toHaveLength(2);
    expect(parsed?.summaryOutput).toContain("Intro");
  });
});
