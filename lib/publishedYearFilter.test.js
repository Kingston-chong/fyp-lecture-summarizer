import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  filterPapersByPublishedYear,
  openAlexYearFilterParam,
  parseYearInput,
  resolvePublishedYearRange,
} from "./publishedYearFilter.js";

describe("resolvePublishedYearRange", () => {
  it("maps since presets", () => {
    assert.deepEqual(resolvePublishedYearRange({ mode: "since2022" }), {
      from: 2022,
      to: null,
      active: true,
    });
  });

  it("swaps inverted custom range", () => {
    assert.deepEqual(
      resolvePublishedYearRange({ mode: "custom", from: 2020, to: 2018 }),
      { from: 2018, to: 2020, active: true },
    );
  });

  it("all years is inactive", () => {
    assert.deepEqual(resolvePublishedYearRange({ mode: "all" }), {
      from: null,
      to: null,
      active: false,
    });
  });
});

describe("filterPapersByPublishedYear", () => {
  it("keeps papers in range", () => {
    const papers = [
      { year: 2021 },
      { year: 2023 },
      { year: null },
    ];
    const out = filterPapersByPublishedYear(papers, {
      from: 2022,
      to: null,
      active: true,
    });
    assert.equal(out.length, 1);
    assert.equal(out[0].year, 2023);
  });
});

describe("openAlexYearFilterParam", () => {
  it("builds comparator filter", () => {
    assert.equal(
      openAlexYearFilterParam({ from: 2022, to: null, active: true }),
      "publication_year:>2021",
    );
  });
});

describe("parseYearInput", () => {
  it("rejects invalid years", () => {
    assert.equal(parseYearInput("abc"), null);
    assert.equal(parseYearInput("1800"), null);
  });
});
