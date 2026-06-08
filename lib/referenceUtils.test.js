import test from "node:test";
import assert from "node:assert/strict";
import {
  extractCitationMarkers,
  filterReferencesToCitedInBody,
  stripCitationMarkersNotInSet,
} from "./referenceCitationCore.js";

const refs = [
  { id: 1, marker: 1, title: "First" },
  { id: 2, marker: 2, title: "Second" },
  { id: 3, marker: 3, title: "Third" },
];

test("filterReferencesToCitedInBody keeps markers cited in body", () => {
  const md = "Claim one [1] and claim two [2].\n\n## References\n- [3] Unused";
  const filtered = filterReferencesToCitedInBody(refs, md);
  assert.deepEqual(
    filtered.map((r) => r.marker),
    [1, 2],
  );
});

test("filterReferencesToCitedInBody drops markers only in References section", () => {
  const md =
    "No inline citations here.\n\n## References\n- [1] Only in bibliography";
  const filtered = filterReferencesToCitedInBody(refs, md);
  assert.equal(filtered.length, 0);
});

test("filterReferencesToCitedInBody returns empty when no markers in body", () => {
  const md = "Summary without citations.";
  assert.deepEqual(extractCitationMarkers(md), []);
  assert.equal(filterReferencesToCitedInBody(refs, md).length, 0);
});

test("stripCitationMarkersNotInSet removes all markers when allowed is empty", () => {
  assert.equal(
    stripCitationMarkersNotInSet("Claim [1] and [2] here.", []),
    "Claim  and  here.",
  );
});

test("stripCitationMarkersNotInSet keeps allowed markers only", () => {
  assert.equal(
    stripCitationMarkersNotInSet("A [1] and [2] and [3].", [2]),
    "A  and [2] and .",
  );
});
