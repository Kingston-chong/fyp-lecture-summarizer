import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  revisionSheetSourceHash,
  readRevisionSheetCache,
  writeRevisionSheetCache,
  clearRevisionSheetCache,
} from "./revisionSheetCache.js";

describe("revisionSheetCache", () => {
  const hasStorage =
    typeof globalThis.localStorage !== "undefined" &&
    typeof globalThis.localStorage.getItem === "function";

  beforeEach(() => {
    if (hasStorage) globalThis.localStorage.clear();
  });

  afterEach(() => {
    if (hasStorage) clearRevisionSheetCache(42);
  });

  it("invalidates when source hash differs", () => {
    const hashA = revisionSheetSourceHash("hello");
    const hashB = revisionSheetSourceHash("hello world");
    expect(hashA).not.toBe(hashB);

    if (!hasStorage) return;

    writeRevisionSheetCache(42, {
      markdown: "# Notes",
      title: "Lecture",
      sourceHash: hashA,
    });
    expect(readRevisionSheetCache(42, hashA)?.markdown).toBe("# Notes");
    expect(readRevisionSheetCache(42, hashB)).toBeNull();
  });
});
