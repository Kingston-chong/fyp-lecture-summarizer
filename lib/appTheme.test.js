import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeAppTheme,
  APP_THEME_STORAGE_KEY,
  APP_THEME_COOKIE,
} from "./appTheme.js";

describe("normalizeAppTheme", () => {
  it("accepts light and dark", () => {
    assert.equal(normalizeAppTheme("light"), "light");
    assert.equal(normalizeAppTheme("dark"), "dark");
  });

  it("defaults invalid values to dark", () => {
    assert.equal(normalizeAppTheme(null), "dark");
    assert.equal(normalizeAppTheme("system"), "dark");
  });
});

describe("app theme constants", () => {
  it("uses stable storage and cookie keys", () => {
    assert.equal(APP_THEME_STORAGE_KEY, "slide2notes-theme");
    assert.equal(APP_THEME_COOKIE, "slide2notes-theme");
  });
});
