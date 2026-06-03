import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildOpenAlexWorksSearchParams,
  resolveOpenAlexApiKey,
} from "./academicSearch.js";

describe("resolveOpenAlexApiKey", () => {
  it("reads OPENALEX_API_KEY from env", () => {
    const prev = process.env.OPENALEX_API_KEY;
    process.env.OPENALEX_API_KEY = "test-key-abc";
    try {
      assert.equal(resolveOpenAlexApiKey(), "test-key-abc");
    } finally {
      if (prev === undefined) delete process.env.OPENALEX_API_KEY;
      else process.env.OPENALEX_API_KEY = prev;
    }
  });
});

describe("buildOpenAlexWorksSearchParams", () => {
  it("includes api_key when configured", () => {
    const prev = process.env.OPENALEX_API_KEY;
    process.env.OPENALEX_API_KEY = "my-openalex-key";
    try {
      const params = buildOpenAlexWorksSearchParams("white box testing", 5, {
        from: 2022,
        to: null,
        active: true,
      });
      assert.equal(params.get("api_key"), "my-openalex-key");
      assert.equal(params.get("search"), "white box testing");
      assert.ok(params.get("filter")?.includes("publication_year:>2021"));
      assert.equal(params.get("mailto"), null);
    } finally {
      if (prev === undefined) delete process.env.OPENALEX_API_KEY;
      else process.env.OPENALEX_API_KEY = prev;
    }
  });
});
