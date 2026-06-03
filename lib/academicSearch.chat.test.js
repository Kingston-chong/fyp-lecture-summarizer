import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildChatAcademicQueries,
  extractChatSearchTopic,
} from "./academicSearch.js";

describe("buildChatAcademicQueries", () => {
  it("prioritizes user topic over lecture word soup", () => {
    const qs = buildChatAcademicQueries(
      "find journals related to white-box",
      "Software Testing Lecture",
      "Software testing includes unit testing and integration testing.",
    );
    assert.ok(qs[0].toLowerCase().includes("white"));
    assert.ok(
      qs.some((q) => /white\s*box/i.test(q)),
      `expected white box query, got: ${qs.join(" | ")}`,
    );
    assert.doesNotMatch(qs[0], /find journals related/i);
  });

  it("extracts topic from request phrasing", () => {
    assert.equal(
      extractChatSearchTopic("find journals related to white-box"),
      "white-box",
    );
  });
});
