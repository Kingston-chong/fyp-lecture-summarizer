import { describe, it, expect } from "vitest";
import {
  buildChatShareSnapshot,
  dbMessageToShareMessage,
  parsePublicChatSnapshot,
} from "./chatShareSnapshot.js";

describe("chatShareSnapshot", () => {
  it("parses v1 user JSON content", () => {
    const row = dbMessageToShareMessage({
      role: "user",
      content: JSON.stringify({ v: 1, t: "explain this", n: 0 }),
    });
    expect(row?.content).toBe("explain this");
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
