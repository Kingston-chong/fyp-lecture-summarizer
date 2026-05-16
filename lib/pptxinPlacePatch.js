/**
 * pptxInPlacePatch.js
 *
 * Patch an existing .pptx buffer IN-PLACE: update slide text + speaker notes
 * while keeping every visual element (backgrounds, shapes, images, fonts,
 * layout) exactly as the user designed it.
 *
 * Strategy:
 *  1. Open the .pptx with JSZip.
 *  2. For each slide returned by the LLM, locate the matching slideN.xml.
 *  3. Replace the text content of the FIRST title placeholder (<p:ph type="title">
 *     or <p:ph type="ctrTitle">) and the FIRST body placeholder (<p:ph type="body">
 *     or no-type) while leaving all <a:rPr> run-property elements intact so that
 *     fonts, sizes, bold, colours are preserved.
 *  4. Replace / create the speaker notes (ppt/notesSlides/notesSlideN.xml).
 *  5. For NEW slides (index > original count), duplicate the last content slide's
 *     XML, inject the new content, and wire up relationships + presentation.xml.
 *  6. Repack and return the patched buffer.
 *
 * What is NOT changed:
 *  - Slide backgrounds, master, layout, theme
 *  - All shapes, images, charts, tables outside the two main placeholders
 *  - Font faces, sizes, colours (run properties are preserved)
 *  - Paragraph spacing, alignment, indentation inside existing paragraphs
 */

import JSZip from "jszip";

// ── Tiny XML helpers ───────────────────────────────────────────────────────────

function encodeXml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Extract the first <a:rPr .../> or <a:rPr ...>...</a:rPr> from an XML string.
 * We reuse it so the patched runs inherit the original formatting.
 */
function extractFirstRpr(xml) {
  const m = xml.match(/<a:rPr\b[^>]*(?:\/>|>[\s\S]*?<\/a:rPr>)/);
  return m ? m[0] : "";
}

/**
 * Build a single <a:p> paragraph containing one run with the given text.
 * Reuses `rPrXml` (existing run properties) so fonts/sizes are preserved.
 */
function buildParagraph(text, rPrXml) {
  const rpr = rPrXml || '<a:rPr lang="en-US" dirty="0"/>';
  // Self-close if needed
  const rprTag = rpr.replace(/<a:rPr([^>]*)><\/a:rPr>/, "<a:rPr$1/>");
  return `<a:p><a:r>${rprTag}<a:t>${encodeXml(text)}</a:t></a:r></a:p>`;
}

/**
 * Replace all text content inside a placeholder <p:sp> block.
 * Keeps the placeholder's <p:spPr>, <p:nvSpPr>, and the very first <a:rPr>
 * found (to preserve formatting), but replaces all <a:p> children of <a:txBody>.
 *
 * @param {string} spXml   Full <p:sp>…</p:sp> XML string for this placeholder
 * @param {string[]} lines  Lines to write (one paragraph each)
 * @returns {string}        Patched <p:sp>…</p:sp>
 */
function replaceSpText(spXml, lines) {
  // Extract the first run-property block to reuse its font/size/colour
  const rPrXml = extractFirstRpr(spXml);

  const newParas = lines.map((l) => buildParagraph(l, rPrXml)).join("\n");

  // Replace everything inside <a:txBody> after the lstStyle/bodyPr/etc. preamble
  // Strategy: keep everything up to and including the last non-<a:p> tag, then
  // inject new paragraphs, then close txBody.
  return spXml.replace(
    /(<a:txBody[\s\S]*?>)([\s\S]*?)(<\/a:txBody>)/,
    (_, open, _body, close) => {
      // Keep bodyPr / lstStyle preamble (everything before first <a:p>)
      const preamble = open.replace(/<a:txBody[^>]*>/, ""); // tags inside open
      // Find preamble content: all non-<a:p> children
      const preambleMatch = _body.match(/^([\s\S]*?)(?=<a:p[ >]|$)/);
      const preambleContent = preambleMatch ? preambleMatch[1] : "";
      return `${open}${preambleContent}${newParas}${close}`;
    },
  );
}

/**
 * Find all <p:sp> blocks in a slide XML that are placeholders (contain <p:ph>).
 * Returns array of { type, xml, start, end } objects.
 */
function findPlaceholders(slideXml) {
  const results = [];
  // Match each <p:sp>…</p:sp> block
  const spRe = /<p:sp\b[\s\S]*?<\/p:sp>/g;
  let m;
  while ((m = spRe.exec(slideXml)) !== null) {
    const xml = m[0];
    if (!xml.includes("<p:ph")) continue;

    // Determine placeholder type
    const typeMatch = xml.match(/<p:ph\b[^>]*\btype="([^"]+)"/);
    const type = typeMatch ? typeMatch[1] : "body"; // no type attr = body
    results.push({ type, xml, start: m.index, end: m.index + xml.length });
  }
  return results;
}

/**
 * Identify the title placeholder and body placeholder from a list.
 */
function classifyPlaceholders(phs) {
  const titleTypes = new Set(["title", "ctrTitle"]);
  const bodyTypes = new Set(["body", "obj", "subTitle"]);

  let title = phs.find((p) => titleTypes.has(p.type));
  let body = phs.find((p) => bodyTypes.has(p.type));

  // Fallback: if we couldn't classify, use positional order
  if (!title && !body && phs.length >= 2) {
    [title, body] = phs;
  } else if (!title && phs.length === 1) {
    body = phs[0];
  } else if (!body && phs.length === 1) {
    title = phs[0];
  }

  return { title, body };
}

/**
 * Patch a single slide's XML with new title + lines.
 * Only the text content of the two main placeholders is changed.
 * All other elements remain untouched.
 */
function patchSlideXml(slideXml, titleText, lines) {
  const phs = findPlaceholders(slideXml);
  const { title: titlePh, body: bodyPh } = classifyPlaceholders(phs);

  let out = slideXml;

  // We patch from the end backward so indices stay valid
  const patches = [];

  if (bodyPh && lines.length > 0) {
    const patched = replaceSpText(bodyPh.xml, lines);
    patches.push({
      start: bodyPh.start,
      end: bodyPh.end,
      replacement: patched,
    });
  }

  if (titlePh && titleText) {
    const patched = replaceSpText(titlePh.xml, [titleText]);
    patches.push({
      start: titlePh.start,
      end: titlePh.end,
      replacement: patched,
    });
  }

  // Apply patches from rightmost to leftmost so offsets stay valid
  patches.sort((a, b) => b.start - a.start);
  for (const p of patches) {
    out = out.slice(0, p.start) + p.replacement + out.slice(p.end);
  }

  return out;
}

// ── Speaker notes helpers ──────────────────────────────────────────────────────

/**
 * Build a minimal notesSlide XML containing the given notes text.
 * Used both for updating existing notes and creating new ones.
 */
function buildNotesXml(notesText, slideRelId) {
  const lines = String(notesText || "").split("\n");
  const paras = lines
    .map(
      (l) =>
        `<a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>${encodeXml(l)}</a:t></a:r></a:p>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
         xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
         xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Notes Placeholder 1"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr><p:ph type="body" idx="1"/></p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          ${paras}
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
  <p:notesStyle/>
</p:notes>`;
}

/**
 * Replace notes text inside an existing notesSlide XML body placeholder.
 */
function patchNotesXml(notesXml, notesText) {
  const lines = String(notesText || "").split("\n");
  const paras = lines
    .map(
      (l) =>
        `<a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>${encodeXml(l)}</a:t></a:r></a:p>`,
    )
    .join("\n");

  // Replace content of body placeholder (idx="1")
  const patched = notesXml.replace(
    /(<p:sp[\s\S]*?<p:ph\b[^>]*\bidx="1"[\s\S]*?<a:txBody[\s\S]*?>)([\s\S]*?)(<\/a:txBody>)/,
    (_, open, _old, close) => {
      const preambleMatch = _old.match(/^([\s\S]*?)(?=<a:p[ >]|$)/);
      const preamble = preambleMatch ? preambleMatch[1] : "";
      return `${open}${preamble}${paras}${close}`;
    },
  );
  return patched;
}

// ── Slide ordering helpers ─────────────────────────────────────────────────────

/**
 * Read ppt/presentation.xml and return the ordered list of slide rId references.
 */
function parseSldIdLst(presXml) {
  const ids = [];
  const re = /<p:sldId\b[^>]*\br:id="([^"]+)"[^>]*/g;
  let m;
  while ((m = re.exec(presXml)) !== null) ids.push(m[1]);
  return ids;
}

/**
 * Read ppt/_rels/presentation.xml.rels and build a map: rId → slide path.
 */
function parsePresRels(relsXml) {
  const map = new Map(); // rId → target (e.g. "slides/slide3.xml")
  const re = /<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"[^>]*/g;
  let m;
  while ((m = re.exec(relsXml)) !== null) {
    if (
      m[2].includes("slide") &&
      !m[2].includes("slideLayout") &&
      !m[2].includes("slideMaster")
    ) {
      map.set(m[1], m[2]);
    }
  }
  return map;
}

/**
 * Read a slide's _rels file and return the notes rId + path (if any).
 */
async function getNotesRef(zip, slidePath) {
  const relsPath = slidePath.replace(
    /^(ppt\/slides\/)(slide\d+\.xml)$/,
    "$1_rels/$2.rels",
  );
  const relsFile = zip.file(relsPath);
  if (!relsFile) return null;
  const relsXml = await relsFile.async("string");
  const m = relsXml.match(
    /<Relationship\b[^>]*\bTarget="[^"]*notesSlides\/notesSlide(\d+)\.xml"[^>]*\bId="([^"]+)"/,
  );
  if (!m) return null;
  return {
    notesIndex: Number(m[1]),
    notesPath: `ppt/notesSlides/notesSlide${m[1]}.xml`,
    rId: m[2],
  };
}

// ── New slide helpers ──────────────────────────────────────────────────────────

/**
 * Find the highest slide index number currently in the zip.
 */
function maxSlideIndex(zip) {
  let max = 0;
  for (const name of Object.keys(zip.files)) {
    const m = name.match(/^ppt\/slides\/slide(\d+)\.xml$/i);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
}

/**
 * Find the highest notes slide index number currently in the zip.
 */
function maxNotesIndex(zip) {
  let max = 0;
  for (const name of Object.keys(zip.files)) {
    const m = name.match(/^ppt\/notesSlides\/notesSlide(\d+)\.xml$/i);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
}

/**
 * Find the highest rId number used across ALL relationship files, so we can
 * assign a fresh unique rId.
 */
async function maxRIdAcrossZip(zip) {
  let max = 0;
  for (const [name, file] of Object.entries(zip.files)) {
    if (!name.endsWith(".rels")) continue;
    const xml = await file.async("string");
    const re = /\bId="rId(\d+)"/g;
    let m;
    while ((m = re.exec(xml)) !== null) max = Math.max(max, Number(m[1]));
  }
  return max;
}

/**
 * Add a brand-new slide to the zip by duplicating `templateSlidePath`, injecting
 * content, and wiring up presentation.xml + rels.
 *
 * Returns the new slide's path.
 */
async function addNewSlide(
  zip,
  templateSlidePath,
  titleText,
  lines,
  notesText,
  presXml,
  presRelsXml,
) {
  const newSlideNum = maxSlideIndex(zip) + 1;
  const newNotesNum = maxNotesIndex(zip) + 1;
  const newSlidePath = `ppt/slides/slide${newSlideNum}.xml`;
  const newNotesPath = `ppt/notesSlides/notesSlide${newNotesNum}.xml`;
  const newSlideRelsPath = `ppt/slides/_rels/slide${newSlideNum}.xml.rels`;

  // 1. Clone template slide XML and patch content
  const templateXml = await zip.file(templateSlidePath).async("string");
  const patchedSlideXml = patchSlideXml(templateXml, titleText, lines);
  zip.file(newSlidePath, patchedSlideXml);

  // 2. Clone template slide's rels (keeps layout reference, drops notes ref)
  const templateRelsPath = templateSlidePath.replace(
    /^(ppt\/slides\/)(slide\d+\.xml)$/,
    "$1_rels/$2.rels",
  );
  let slideRelsXml = "";
  const templateRelsFile = zip.file(templateRelsPath);
  if (templateRelsFile) {
    slideRelsXml = await templateRelsFile.async("string");
    // Remove any existing notes relationship — we'll add a fresh one
    slideRelsXml = slideRelsXml.replace(
      /<Relationship\b[^>]*notesSlides[^>]*\/>/g,
      "",
    );
  } else {
    // Minimal rels if template has none
    slideRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;
  }

  // 3. Find a free rId for the notes relationship
  const globalMaxRId = await maxRIdAcrossZip(zip);
  const notesRId = `rId${globalMaxRId + 1}`;

  // 4. Add notes relationship to the new slide's rels
  const notesRelEntry = `<Relationship Id="${notesRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide${newNotesNum}.xml"/>`;
  slideRelsXml = slideRelsXml.replace(
    "</Relationships>",
    `${notesRelEntry}\n</Relationships>`,
  );
  zip.file(newSlideRelsPath, slideRelsXml);

  // 5. Create notes slide
  const notesXml = buildNotesXml(notesText, notesRId);
  zip.file(newNotesPath, notesXml);

  // 6. Create notes slide rels (points back to the slide)
  const notesRelsPath = `ppt/notesSlides/_rels/notesSlide${newNotesNum}.xml.rels`;
  const slideBackRId = `rId${globalMaxRId + 2}`;
  const notesRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="${slideBackRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="../slides/slide${newSlideNum}.xml"/>
</Relationships>`;
  zip.file(notesRelsPath, notesRelsXml);

  // 7. Wire into presentation.xml: add <p:sldId> entry
  // Find the next free id (must be > 255 and unique)
  const existingIds = [...presXml.matchAll(/<p:sldId\b[^>]*\bid="(\d+)"/g)].map(
    (m) => Number(m[1]),
  );
  const nextId = Math.max(256, ...existingIds) + 1;

  // Find the rId for the new slide in presentation.xml.rels — we need to add it
  const presRelsNextRId = `rId${globalMaxRId + 3}`;

  const newSldIdEl = `<p:sldId id="${nextId}" r:id="${presRelsNextRId}"/>`;
  const updatedPresXml = presXml.replace(
    "</p:sldIdLst>",
    `${newSldIdEl}\n  </p:sldIdLst>`,
  );

  // 8. Add to presentation.xml.rels
  const newPresRel = `<Relationship Id="${presRelsNextRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${newSlideNum}.xml"/>`;
  const updatedPresRelsXml = presRelsXml.replace(
    "</Relationships>",
    `${newPresRel}\n</Relationships>`,
  );

  // 9. Register new slide in [Content_Types].xml
  const ctFile = zip.file("[Content_Types].xml");
  if (ctFile) {
    let ctXml = await ctFile.async("string");
    const slidePartName = `/ppt/slides/slide${newSlideNum}.xml`;
    if (!ctXml.includes(slidePartName)) {
      const slideContentType =
        "application/vnd.openxmlformats-officedocument.presentationml.slide+xml";
      ctXml = ctXml.replace(
        "</Types>",
        `<Override PartName="${slidePartName}" ContentType="${slideContentType}"/>\n</Types>`,
      );
      zip.file("[Content_Types].xml", ctXml);
    }
    // Also register notes slide
    const notesPartName = `/ppt/notesSlides/notesSlide${newNotesNum}.xml`;
    if (!ctXml.includes(notesPartName)) {
      let ctXml2 = await zip.file("[Content_Types].xml").async("string");
      const notesContentType =
        "application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml";
      ctXml2 = ctXml2.replace(
        "</Types>",
        `<Override PartName="${notesPartName}" ContentType="${notesContentType}"/>\n</Types>`,
      );
      zip.file("[Content_Types].xml", ctXml2);
    }
  }

  return { newSlidePath, updatedPresXml, updatedPresRelsXml };
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Patch an existing .pptx in-place:
 *  - Update text content of existing slides (title + body placeholders only)
 *  - Update / create speaker notes
 *  - Add new slides (duplicated from last content slide) for any index beyond original count
 *
 * @param {Buffer} sourceBuffer  Original .pptx bytes
 * @param {{ index: number; title: string; lines: string[]; notes: string }[]} slides
 *   LLM-output slides. index is 1-based. Indices ≤ original slide count are patched
 *   in-place; indices beyond are added as new slides.
 * @returns {Promise<Buffer>}
 */
export async function patchPptxInPlace(sourceBuffer, slides) {
  const zip = await JSZip.loadAsync(sourceBuffer);

  // ── Load presentation manifest ─────────────────────────────────────────────
  const presPath = "ppt/presentation.xml";
  const presRelsPath = "ppt/_rels/presentation.xml.rels";

  let presXml = await zip.file(presPath).async("string");
  let presRelsXml = await zip.file(presRelsPath).async("string");

  // Map rId → slide path (relative to ppt/)
  const rIdToPath = parsePresRels(presRelsXml);
  // Ordered list of rIds (preserves slide order)
  const orderedRIds = parseSldIdLst(presXml);
  // Ordered slide paths
  const orderedSlidePaths = orderedRIds
    .map((rid) => rIdToPath.get(rid))
    .filter(Boolean)
    .map((rel) => (rel.startsWith("ppt/") ? rel : `ppt/${rel}`));

  const originalCount = orderedSlidePaths.length;

  // Sort LLM slides by index
  const sorted = [...slides].sort((a, b) => a.index - b.index);

  for (const slide of sorted) {
    const idx = slide.index; // 1-based
    const titleText = slide.title || `Slide ${idx}`;
    const lines = Array.isArray(slide.lines) ? slide.lines : [];
    const notesText = slide.notes || "";

    if (idx <= originalCount) {
      // ── Patch existing slide ───────────────────────────────────────────────
      const slidePath = orderedSlidePaths[idx - 1];
      if (!slidePath || !zip.file(slidePath)) continue;

      const slideXml = await zip.file(slidePath).async("string");
      const patchedXml = patchSlideXml(slideXml, titleText, lines);
      zip.file(slidePath, patchedXml);

      // Update speaker notes
      if (notesText) {
        const notesRef = await getNotesRef(zip, slidePath);
        if (notesRef && zip.file(notesRef.notesPath)) {
          const existingNotes = await zip
            .file(notesRef.notesPath)
            .async("string");
          const patchedNotes = patchNotesXml(existingNotes, notesText);
          zip.file(notesRef.notesPath, patchedNotes);
        } else {
          // No existing notes file — create one and wire it up
          const slideNum = idx;
          const newNotesNum = maxNotesIndex(zip) + 1;
          const newNotesPath = `ppt/notesSlides/notesSlide${newNotesNum}.xml`;
          zip.file(newNotesPath, buildNotesXml(notesText, "rId99"));

          // Add to slide rels
          const slideRelsPath = slidePath.replace(
            /^(ppt\/slides\/)(slide\d+\.xml)$/,
            "$1_rels/$2.rels",
          );
          const globalMaxRId = await maxRIdAcrossZip(zip);
          const notesRId = `rId${globalMaxRId + 1}`;
          let slideRels = "";
          const relsFile = zip.file(slideRelsPath);
          if (relsFile) {
            slideRels = await relsFile.async("string");
          } else {
            slideRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
          }
          slideRels = slideRels.replace(
            "</Relationships>",
            `<Relationship Id="${notesRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide${newNotesNum}.xml"/>\n</Relationships>`,
          );
          zip.file(slideRelsPath, slideRels);

          // Register in Content_Types
          const ctFile = zip.file("[Content_Types].xml");
          if (ctFile) {
            let ctXml = await ctFile.async("string");
            const partName = `/ppt/notesSlides/notesSlide${newNotesNum}.xml`;
            if (!ctXml.includes(partName)) {
              ctXml = ctXml.replace(
                "</Types>",
                `<Override PartName="${partName}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>\n</Types>`,
              );
              zip.file("[Content_Types].xml", ctXml);
            }
          }
        }
      }
    } else {
      // ── Add new slide ──────────────────────────────────────────────────────
      // Use the last existing slide as the design template
      const templatePath =
        orderedSlidePaths[orderedSlidePaths.length - 1] ||
        `ppt/slides/slide${originalCount}.xml`;

      const result = await addNewSlide(
        zip,
        templatePath,
        titleText,
        lines,
        notesText,
        presXml,
        presRelsXml,
      );

      // Keep presXml + presRelsXml up to date for subsequent new slides
      presXml = result.updatedPresXml;
      presRelsXml = result.updatedPresRelsXml;

      // Update the zip's presentation files
      zip.file(presPath, presXml);
      zip.file(presRelsPath, presRelsXml);

      // Track the newly added slide so further additions can use it as template
      orderedSlidePaths.push(result.newSlidePath);
    }
  }

  // Final write of presentation.xml (may have been updated by new slide additions)
  zip.file(presPath, presXml);
  zip.file(presRelsPath, presRelsXml);

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}
