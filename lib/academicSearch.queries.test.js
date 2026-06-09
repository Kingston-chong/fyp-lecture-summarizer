import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildSearchQueries,
  compactAcademicSearchQuery,
  expandToShortSearchQueries,
  mergeSearchQueries,
} from "./academicSearch.js";

describe("compactAcademicSearchQuery", () => {
  it("keeps 1–2 word queries", () => {
    assert.deepEqual(compactAcademicSearchQuery("greenhouse"), ["greenhouse"]);
    assert.deepEqual(compactAcademicSearchQuery("greenhouse gases"), [
      "greenhouse gases",
      "greenhouse",
      "gases",
    ]);
  });

  it("shortens long phrases into keyword searches", () => {
    const out = compactAcademicSearchQuery(
      "shared socioeconomic pathways greenhouse gas emissions implications overview",
    );
    assert.ok(out.every((q) => q.split(" ").length <= 2));
    assert.equal(out[0], "shared socioeconomic");
    assert.equal(out[1], "shared");
  });
});

describe("expandToShortSearchQueries", () => {
  it("dedupes and caps query count", () => {
    const out = expandToShortSearchQueries(
      ["greenhouse gases", "greenhouse", "climate change mitigation strategies"],
      4,
    );
    assert.ok(out.includes("greenhouse"));
    assert.ok(out.includes("greenhouse gases"));
    assert.ok(out.every((q) => q.split(" ").length <= 2));
    assert.ok(out.length <= 4);
  });
});

describe("buildSearchQueries", () => {
  it("does not emit long word-soup queries", () => {
    const text = `
# Climate Change and Greenhouse Gases
Greenhouse gases trap heat in the atmosphere. Carbon dioxide and methane
are major greenhouse gases driving global warming and climate change.
    `.trim();
    const queries = buildSearchQueries(text, [{ name: "lecture-climate.pptx" }]);
    assert.ok(queries.length >= 2);
    assert.ok(
      queries.some((q) => /greenhouse/i.test(q)),
      `expected greenhouse keyword, got: ${queries.join(" | ")}`,
    );
    assert.ok(
      queries.every((q) => q.split(/\s+/).length <= 2),
      `queries should be 1–2 words: ${queries.join(" | ")}`,
    );
    assert.ok(
      !queries.some((q) => q.split(/\s+/).length >= 5),
      `should not join many terms: ${queries.join(" | ")}`,
    );
  });
});

describe("mergeSearchQueries", () => {
  it("merges LLM and fallback into short queries", () => {
    const out = mergeSearchQueries(
      [
        "white box software testing verification techniques",
        "unit testing",
      ],
      ["greenhouse gases carbon dioxide warming"],
    );
    assert.ok(out.every((q) => q.split(" ").length <= 2));
    assert.ok(out.some((q) => /white box/i.test(q) || q === "white"));
  });
});
