import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getAlaiSlideGenLoadingMessage,
  ALAI_WAIT_MSG_30,
  ALAI_WAIT_MSG_60,
  ALAI_WAIT_MSG_90,
  ALAI_WAIT_MSG_5MIN,
} from "./alaiSlideGenLoadingMessage.js";

describe("getAlaiSlideGenLoadingMessage", () => {
  it("uses API status before 30s", () => {
    assert.equal(
      getAlaiSlideGenLoadingMessage(10_000, "Rendering slides…"),
      "Rendering slides…",
    );
  });

  it("shows staged messages at 30s, 60s, and 90s", () => {
    assert.equal(getAlaiSlideGenLoadingMessage(30_000), ALAI_WAIT_MSG_30);
    assert.equal(getAlaiSlideGenLoadingMessage(60_000), ALAI_WAIT_MSG_60);
    assert.equal(getAlaiSlideGenLoadingMessage(90_000), ALAI_WAIT_MSG_90);
  });

  it("loops 30/60/90 messages after 2 minutes", () => {
    assert.equal(getAlaiSlideGenLoadingMessage(120_000), ALAI_WAIT_MSG_30);
    assert.equal(getAlaiSlideGenLoadingMessage(150_000), ALAI_WAIT_MSG_60);
    assert.equal(getAlaiSlideGenLoadingMessage(180_000), ALAI_WAIT_MSG_90);
    assert.equal(getAlaiSlideGenLoadingMessage(210_000), ALAI_WAIT_MSG_30);
  });

  it("shows almost there at 5 minutes", () => {
    assert.equal(getAlaiSlideGenLoadingMessage(300_000), ALAI_WAIT_MSG_5MIN);
    assert.equal(getAlaiSlideGenLoadingMessage(600_000), ALAI_WAIT_MSG_5MIN);
  });
});
