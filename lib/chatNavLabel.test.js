import { describe, it, expect } from "vitest";
import { getChatNavItems, getUserMessageNavLabel } from "./chatNavLabel.js";

describe("chatNavLabel", () => {
  it("extracts text from v1 user payload", () => {
    const label = getUserMessageNavLabel({
      content: JSON.stringify({ v: 1, t: "explain the algorithm", n: 0 }),
    });
    expect(label).toBe("explain the algorithm");
  });

  it("builds nav items for user messages only", () => {
    const items = getChatNavItems([
      { id: 1, role: "user", content: "first question" },
      { id: 2, role: "ai", content: "answer" },
      { id: 3, role: "user", content: "second question" },
    ]);
    expect(items).toHaveLength(2);
    expect(items[0].label).toBe("first question");
  });
});
