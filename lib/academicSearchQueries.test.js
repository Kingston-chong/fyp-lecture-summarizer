import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseLlmAcademicSearchPayload } from "./academicSearchQueries.js";

describe("parseLlmAcademicSearchPayload", () => {
  it("parses queries and keyTerms", () => {
    const out = parseLlmAcademicSearchPayload({
      queries: [
        "white box software testing",
        "unit testing verification",
        "x",
      ],
      keyTerms: ["white-box testing", "verification"],
    });
    assert.equal(out.queries.length, 2);
    assert.ok(out.queries[0].includes("white box"));
    assert.equal(out.keyTerms.length, 2);
  });

  it("caps list lengths", () => {
    const out = parseLlmAcademicSearchPayload({
      queries: Array.from({ length: 10 }, (_, i) => `query number ${i} topic`),
      keyTerms: Array.from({ length: 20 }, (_, i) => `term${i}`),
    });
    assert.equal(out.queries.length, 5);
    assert.equal(out.keyTerms.length, 16);
  });
});
