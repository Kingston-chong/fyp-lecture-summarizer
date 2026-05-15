import { DEFAULT_HL_HEX, hexToRgba } from "../helpers";

export function unwrapHighlightMarks(root) {
  if (!root) return;
  root.querySelectorAll("mark.s2n-hl").forEach((m) => {
    const parent = m.parentNode;
    if (!parent) return;
    while (m.firstChild) parent.insertBefore(m.firstChild, m);
    parent.removeChild(m);
  });
}

export function applyHighlightBlockStyle(mark, colorHex) {
  const color =
    colorHex && /^#[0-9a-f]{6}$/i.test(colorHex) ? colorHex : DEFAULT_HL_HEX;
  const fill = hexToRgba(color, 0.38);
  mark.style.background = "none";
  mark.style.backgroundColor = fill;
  mark.style.color = "inherit";
  mark.style.boxDecorationBreak = "clone";
  mark.style.webkitBoxDecorationBreak = "clone";
  mark.style.padding = "0.12em 0.14em";
  mark.style.borderRadius = "2px";
}

function collectTextNodesInOrder(root) {
  const nodes = [];
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let n;
  while ((n = w.nextNode())) {
    if (n.parentElement?.closest?.("script,style")) continue;
    nodes.push(n);
  }
  return nodes;
}

function findRangeForSubstring(root, quote) {
  if (!root || !quote) return null;
  const nodes = collectTextNodesInOrder(root);
  if (!nodes.length) return null;
  const big = nodes
    .map((node) => node.textContent ?? "")
    .join("")
    .replace(/\s+/g, " ");
  const normalizedQuote = quote.replace(/\s+/g, " ").trim();
  const idx = big.indexOf(normalizedQuote);
  if (idx === -1) return null;
  const endIdx = idx + normalizedQuote.length;
  let pos = 0;
  let startNode = null;
  let startOff = 0;
  let endNode = null;
  let endOff = 0;
  for (const node of nodes) {
    const t = node.textContent ?? "";
    const len = t.length;
    const a = pos;
    const b = pos + len;
    if (startNode === null && idx >= a && idx < b) {
      startNode = node;
      startOff = idx - a;
    }
    if (endIdx > a && endIdx <= b) {
      endNode = node;
      endOff = endIdx - a;
    }
    pos = b;
  }
  if (!startNode || endNode == null) return null;
  const range = document.createRange();
  range.setStart(startNode, startOff);
  range.setEnd(endNode, endOff);
  return range;
}

export function wrapQuoteInRoot(root, quote, hlId, colorHex, pending) {
  if (!root || !quote) return false;
  const color =
    colorHex && /^#[0-9a-f]{6}$/i.test(colorHex) ? colorHex : DEFAULT_HL_HEX;
  const range = findRangeForSubstring(root, quote);
  if (!range) return false;
  const mark = document.createElement("mark");
  mark.className = pending ? "s2n-hl s2n-hl-pending" : "s2n-hl";
  mark.dataset.hlId = String(hlId);
  mark.dataset.hlColor = color;
  applyHighlightBlockStyle(mark, color);
  try {
    const contents = range.extractContents();
    mark.appendChild(contents);
    mark.querySelectorAll("*").forEach((el) => {
      if (
        el.style.backgroundColor &&
        el.style.backgroundColor !== "transparent"
      ) {
        el.style.backgroundColor = "transparent";
      }
    });
    range.insertNode(mark);
    return true;
  } catch {
    return false;
  }
}
