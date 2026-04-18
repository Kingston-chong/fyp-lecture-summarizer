import JSZip from "jszip";

const EMU = 914400; // 1 inch in EMUs
// Standard 16:9 slide = 10 inches wide × 5.625 inches tall
const SLIDE_W_IN = 10;
const SLIDE_H_IN = 5.625;

function detectImage(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: "jpg", contentType: "image/jpeg" };
  }
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { ext: "png", contentType: "image/png" };
  }
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return { ext: "gif", contentType: "image/gif" };
  }
  return null;
}

function nextImageNum(paths) {
  let max = 0;
  for (const p of paths) {
    const m = p.match(/\/image(\d+)\.[a-z0-9]+$/i);
    if (!m) continue;
    const n = Number.parseInt(m[1], 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

function nextRelId(relsXml) {
  const re = /Id="rId(\d+)"/g;
  let max = 0;
  let m;
  while ((m = re.exec(relsXml)) !== null) {
    const n = Number.parseInt(m[1], 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `rId${max + 1}`;
}

function nextShapeId(slideXml) {
  const re = /<p:cNvPr[^>]*\sid="(\d+)"/g;
  let max = 1;
  let m;
  while ((m = re.exec(slideXml)) !== null) {
    const n = Number.parseInt(m[1], 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

function ensureContentTypeDefault(contentTypesXml, ext, contentType) {
  const exists = new RegExp(`<Default\\s+Extension="${ext}"\\s+ContentType="[^"]+"\\s*\\/?>`, "i");
  if (exists.test(contentTypesXml)) return contentTypesXml;
  return contentTypesXml.replace(
    /<\/Types>/i,
    `  <Default Extension="${ext}" ContentType="${contentType}"/>\n</Types>`,
  );
}

function appendRelationship(relsXml, relId, targetPath) {
  const rel = `  <Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${targetPath}"/>`;
  return relsXml.replace(/<\/Relationships>/i, `${rel}\n</Relationships>`);
}

/**
 * Parse slide dimensions from presentation.xml, defaulting to 16:9.
 * @param {JSZip} zip
 * @returns {Promise<{ wIn: number; hIn: number }>}
 */
async function getSlideDimensions(zip) {
  try {
    const presXml = await zip.file("ppt/presentation.xml")?.async("string");
    if (!presXml) return { wIn: SLIDE_W_IN, hIn: SLIDE_H_IN };
    const sldSzMatch = presXml.match(/<p:sldSz\s[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
    if (!sldSzMatch) return { wIn: SLIDE_W_IN, hIn: SLIDE_H_IN };
    return {
      wIn: Number.parseInt(sldSzMatch[1], 10) / EMU,
      hIn: Number.parseInt(sldSzMatch[2], 10) / EMU,
    };
  } catch {
    return { wIn: SLIDE_W_IN, hIn: SLIDE_H_IN };
  }
}

/**
 * Estimate the bounding box of text content on the slide by scanning spPr xfrm elements.
 * Returns the rightmost x + width so we know the safe text zone width.
 * @param {string} slideXml
 * @param {{ wIn: number; hIn: number }} dims
 * @returns {{ textRightIn: number; textBottomIn: number }}
 */
function estimateTextBounds(slideXml, dims) {
  // Find all <a:off x="..." y="..."/> + <a:ext cx="..." cy="..."/> pairs
  const xfrmRe = /<a:off\s+x="(\d+)"\s+y="(\d+)"\s*\/>[\s\S]*?<a:ext\s+cx="(\d+)"\s+cy="(\d+)"\s*\/>/g;
  let maxRight = 0;
  let maxBottom = 0;
  let m;
  while ((m = xfrmRe.exec(slideXml)) !== null) {
    const xIn = Number.parseInt(m[1], 10) / EMU;
    const yIn = Number.parseInt(m[2], 10) / EMU;
    const wIn = Number.parseInt(m[3], 10) / EMU;
    const hIn = Number.parseInt(m[4], 10) / EMU;
    const right = xIn + wIn;
    const bottom = yIn + hIn;
    if (right > maxRight) maxRight = right;
    if (bottom > maxBottom) maxBottom = bottom;
  }
  // Clamp to slide bounds; if nothing found use full slide
  return {
    textRightIn: Math.min(maxRight || dims.wIn, dims.wIn),
    textBottomIn: Math.min(maxBottom || dims.hIn, dims.hIn),
  };
}

/**
 * Choose the best corner for image placement so it doesn't cover text.
 * Image is placed in one of the four corners; we pick the corner where
 * the text bounding box leaves the most clear space.
 *
 * Corner candidates (top-right, bottom-right, bottom-left, top-left):
 *   - top-right:    least likely to collide if text starts from left
 *   - bottom-right: good if content ends before bottom-right
 *   - bottom-left:  fallback
 *   - top-left:     last resort
 *
 * @param {string} slideXml
 * @param {{ wIn: number; hIn: number }} dims
 * @param {{ wIn: number; hIn: number }} imgSize - desired image size in inches
 * @returns {{ xIn: number; yIn: number }}
 */
function chooseImageCorner(slideXml, dims, imgSize) {
  const MARGIN = 0.18; // inches from slide edge
  const { wIn: sw, hIn: sh } = dims;
  const { wIn: iw, hIn: ih } = imgSize;

  const corners = [
    // top-right  — preferred for most lecture slides (title left, bullets left)
    { xIn: sw - iw - MARGIN, yIn: MARGIN },
    // bottom-right
    { xIn: sw - iw - MARGIN, yIn: sh - ih - MARGIN },
    // bottom-left
    { xIn: MARGIN, yIn: sh - ih - MARGIN },
    // top-left
    { xIn: MARGIN, yIn: MARGIN },
  ];

  // Score each corner by how much it overlaps with text shapes
  const xfrmRe = /<a:off\s+x="(\d+)"\s+y="(\d+)"\s*\/>[\s\S]*?<a:ext\s+cx="(\d+)"\s+cy="(\d+)"\s*\/>/g;
  const shapes = [];
  let m;
  while ((m = xfrmRe.exec(slideXml)) !== null) {
    shapes.push({
      x1: Number.parseInt(m[1], 10) / EMU,
      y1: Number.parseInt(m[2], 10) / EMU,
      x2: (Number.parseInt(m[1], 10) + Number.parseInt(m[3], 10)) / EMU,
      y2: (Number.parseInt(m[2], 10) + Number.parseInt(m[4], 10)) / EMU,
    });
  }

  let bestCorner = corners[0];
  let bestScore = Infinity;

  for (const corner of corners) {
    const ix1 = corner.xIn;
    const iy1 = corner.yIn;
    const ix2 = corner.xIn + iw;
    const iy2 = corner.yIn + ih;

    // Sum of overlap areas with all text shapes
    let overlapScore = 0;
    for (const s of shapes) {
      const ox = Math.max(0, Math.min(ix2, s.x2) - Math.max(ix1, s.x1));
      const oy = Math.max(0, Math.min(iy2, s.y2) - Math.max(iy1, s.y1));
      overlapScore += ox * oy;
    }

    if (overlapScore < bestScore) {
      bestScore = overlapScore;
      bestCorner = corner;
    }
  }

  return bestCorner;
}

/**
 * Build the OOXML for a picture shape placed at a specific corner.
 * @param {string} relId
 * @param {number} shapeId
 * @param {{ xIn: number; yIn: number; wIn: number; hIn: number }} pos
 */
function buildPictureXml(relId, shapeId, pos) {
  const x = Math.round(pos.xIn * EMU);
  const y = Math.round(pos.yIn * EMU);
  const cx = Math.round(pos.wIn * EMU);
  const cy = Math.round(pos.hIn * EMU);

  return `    <p:pic>
      <p:nvPicPr>
        <p:cNvPr id="${shapeId}" name="Inserted Image ${shapeId}"/>
        <p:cNvPicPr>
          <a:picLocks noChangeAspect="1"/>
        </p:cNvPicPr>
        <p:nvPr/>
      </p:nvPicPr>
      <p:blipFill>
        <a:blip r:embed="${relId}">
          <a:extLst>
            <a:ext uri="{28A0092B-C50C-407E-A947-70E740481C1C}">
              <a14:useLocalDpi xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main" val="0"/>
            </a:ext>
          </a:extLst>
        </a:blip>
        <a:stretch><a:fillRect/></a:stretch>
      </p:blipFill>
      <p:spPr>
        <a:xfrm>
          <a:off x="${x}" y="${y}"/>
          <a:ext cx="${cx}" cy="${cy}"/>
        </a:xfrm>
        <a:prstGeom prst="roundRect">
          <a:avLst>
            <a:gd name="adj" fmla="val 16667"/>
          </a:avLst>
        </a:prstGeom>
        <a:effectLst>
          <a:outerShdw blurRad="38100" dist="23000" dir="5400000" algn="ctr" rotWithShape="0">
            <a:srgbClr val="000000">
              <a:alpha val="40000"/>
            </a:srgbClr>
          </a:outerShdw>
        </a:effectLst>
      </p:spPr>
    </p:pic>`;
}

/**
 * Insert images into a .pptx buffer without rebuilding the deck.
 * Images are placed in the corner with least text overlap.
 *
 * @param {Buffer} sourceBuffer
 * @param {{ slideIndex: number; data: Buffer }[]} images
 * @returns {Promise<Buffer>}
 */
export async function buildPptxWithImagesInPlace(sourceBuffer, images) {
  if (!images || images.length === 0) return sourceBuffer;

  const zip = await JSZip.loadAsync(sourceBuffer);
  const files = Object.keys(zip.files);
  let imageNum = nextImageNum(files.filter((p) => /^ppt\/media\/image\d+\.[a-z0-9]+$/i.test(p)));

  const contentTypesPath = "[Content_Types].xml";
  let contentTypesXml = await zip.file(contentTypesPath)?.async("string");
  if (!contentTypesXml) throw new Error("Invalid PPTX package: missing [Content_Types].xml");

  // Read slide dimensions once
  const dims = await getSlideDimensions(zip);

  // Image thumbnail size: ~22% of slide width, maintaining 3:2 landscape ratio
  const IMG_W_IN = Math.round(dims.wIn * 0.22 * 100) / 100;
  const IMG_H_IN = Math.round((IMG_W_IN * 2) / 3 * 100) / 100;

  for (const im of images || []) {
    const slideIndex = Number(im?.slideIndex);
    const data = im?.data instanceof Buffer ? im.data : null;
    if (!Number.isFinite(slideIndex) || slideIndex <= 0 || !data) continue;

    const kind = detectImage(data);
    if (!kind) continue;

    const slidePath = `ppt/slides/slide${slideIndex}.xml`;
    const relsPath = `ppt/slides/_rels/slide${slideIndex}.xml.rels`;
    const slideFile = zip.file(slidePath);
    const relsFile = zip.file(relsPath);
    if (!slideFile || !relsFile) continue;

    const slideXml = await slideFile.async("string");
    const relsXml = await relsFile.async("string");

    // Pick the corner with least overlap against existing shapes
    const corner = chooseImageCorner(slideXml, dims, { wIn: IMG_W_IN, hIn: IMG_H_IN });

    const mediaName = `image${imageNum}.${kind.ext}`;
    imageNum += 1;
    const mediaPath = `ppt/media/${mediaName}`;
    zip.file(mediaPath, data);

    contentTypesXml = ensureContentTypeDefault(contentTypesXml, kind.ext, kind.contentType);

    const relId = nextRelId(relsXml);
    const shapeId = nextShapeId(slideXml);

    const picXml = buildPictureXml(relId, shapeId, {
      xIn: corner.xIn,
      yIn: corner.yIn,
      wIn: IMG_W_IN,
      hIn: IMG_H_IN,
    });

    zip.file(relsPath, appendRelationship(relsXml, relId, `../media/${mediaName}`));
    zip.file(slidePath, slideXml.replace(/<\/p:spTree>/i, `${picXml}\n  </p:spTree>`));
  }

  zip.file(contentTypesPath, contentTypesXml);
  const out = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}