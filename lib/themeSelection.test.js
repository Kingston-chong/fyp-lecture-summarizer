import { describe, expect, it } from "vitest";
import {
  mergeSelectedThemeIntoList,
  pickThemeIdAfterListLoad,
  themeFromTemplateSpec,
  themeListIds,
} from "./themeSelection.js";

describe("pickThemeIdAfterListLoad", () => {
  it("keeps previous id when still in list", () => {
    const themes = [{ id: "a" }, { id: "b" }];
    expect(pickThemeIdAfterListLoad("b", themes)).toBe("b");
  });

  it("falls back to first when previous missing", () => {
    const themes = [{ id: "a" }, { id: "b" }];
    expect(pickThemeIdAfterListLoad("z", themes)).toBe("a");
  });
});

describe("themeListIds", () => {
  it("reads id and theme_id", () => {
    expect(themeListIds([{ id: "1" }, { theme_id: "2" }])).toEqual(["1", "2"]);
  });
});

describe("mergeSelectedThemeIntoList", () => {
  it("prepends missing selected theme", () => {
    const out = mergeSelectedThemeIntoList([{ id: "a", name: "A" }], "b", {
      name: "B",
      description: "desc",
    });
    expect(out).toHaveLength(2);
    expect(out[0].id).toBe("b");
    expect(out[0].name).toBe("B");
  });
});

describe("themeFromTemplateSpec", () => {
  it("extracts background and accent from shapes", () => {
    const theme = themeFromTemplateSpec({
      cover: { background: "#111111", shapes: [{ fill: "#ff0000" }] },
      content: { shapes: [{ fill: "#222222" }] },
    });
    expect(theme?.background).toBe("#111111");
    expect(theme?.accent).toBe("#ff0000");
  });
});
