/**
 * twoSlidesGenerate.js
 *
 * Server-side adapter for the 2slides REST API.
 * Turns text input + themeId into a generated .pptx buffer.
 *
 * API docs: https://2slides.com/api
 */
const TWOSLIDES_BASE = "https://2slides.com";

function authHeaders() {
  const key = process.env.TWOSLIDES_API_KEY;
  if (!key)
    throw new Error("TWOSLIDES_API_KEY is not configured on the server.");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text().catch(() => "");
  const data = safeJsonParse(text);
  if (!res.ok) {
    const msg =
      (data && (data.error || data.message)) ||
      text.slice(0, 200) ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data ?? {};
}

function extractDownloadUrl(payload) {
  // Be defensive: docs show { success, data: { downloadUrl } } but blog posts vary.
  return (
    payload?.downloadUrl ||
    payload?.data?.downloadUrl ||
    payload?.result?.downloadUrl ||
    payload?.data?.fileUrl ||
    payload?.fileUrl ||
    null
  );
}

function extractJobId(payload) {
  return (
    payload?.jobId ||
    payload?.data?.jobId ||
    payload?.data?.id ||
    payload?.id ||
    null
  );
}

/**
 * Generate a PowerPoint via 2slides and return its bytes.
 *
 * @param {object} opts
 * @param {string} opts.userInput - Plain text / outline to convert to slides
 * @param {string} opts.themeId - Theme ID from /api/v1/themes/search
 * @param {string} [opts.responseLanguage="Auto"]
 * @param {"sync"|"async"} [opts.mode="sync"]
 * @param {number} [opts.pollTimeoutMs=120000]
 */
export async function generatePptxWithTwoSlides({
  userInput,
  themeId,
  responseLanguage = "Auto",
  mode = "sync",
  pollTimeoutMs = 120_000,
}) {
  const input = String(userInput || "").trim();
  const theme = String(themeId || "").trim();
  if (!input) throw new Error("2slides: userInput is required");
  if (!theme) throw new Error("2slides: themeId is required");

  const start = await fetchJson(`${TWOSLIDES_BASE}/api/v1/slides/generate`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      userInput: input,
      themeId: theme,
      responseLanguage,
      mode,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  const directUrl = extractDownloadUrl(start);
  if (directUrl) {
    const fileRes = await fetch(directUrl, {
      signal: AbortSignal.timeout(60_000),
    });
    if (!fileRes.ok) {
      throw new Error(`2slides: download failed (${fileRes.status})`);
    }
    const ab = await fileRes.arrayBuffer();
    return Buffer.from(ab);
  }

  const jobId = extractJobId(start);
  if (!jobId)
    throw new Error("2slides: no downloadUrl/jobId returned from generate");

  const t0 = Date.now();
  while (Date.now() - t0 < pollTimeoutMs) {
    await sleep(1500);
    const check = await fetchJson(
      `${TWOSLIDES_BASE}/api/v1/jobs/${encodeURIComponent(String(jobId))}`,
      {
        method: "GET",
        headers: { Authorization: authHeaders().Authorization },
        signal: AbortSignal.timeout(20_000),
      },
    );
    const status = String(
      check?.data?.status || check?.status || "",
    ).toLowerCase();
    const url = extractDownloadUrl(check);
    if (
      url &&
      (status === "success" ||
        status === "completed" ||
        status === "done" ||
        status === "")
    ) {
      const fileRes = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!fileRes.ok)
        throw new Error(`2slides: download failed (${fileRes.status})`);
      const ab = await fileRes.arrayBuffer();
      return Buffer.from(ab);
    }
    if (status === "failed" || status === "error") {
      throw new Error(
        check?.data?.error || check?.error || "2slides: job failed",
      );
    }
  }

  throw new Error("2slides: timed out waiting for job completion");
}

/**
 * Convert your improve-PPT JSON into a compact outline that 2slides can ingest.
 * Keep it text-only; 2slides handles layout/design.
 */
export function improvedSlidesToTwoSlidesUserInput({
  title,
  subtitle,
  slides,
  references,
}) {
  const lines = [];
  const deckTitle = String(title || "Presentation").trim();
  const deckSubtitle = String(subtitle || "").trim();
  lines.push(deckTitle);
  if (deckSubtitle) lines.push(deckSubtitle);
  lines.push("");

  for (const s of Array.isArray(slides) ? slides : []) {
    const idx = Number(s?.index);
    const heading = String(
      s?.title || (Number.isFinite(idx) ? `Slide ${idx}` : "Slide"),
    ).trim();
    lines.push(`Slide ${Number.isFinite(idx) ? idx : ""}: ${heading}`.trim());

    const bullets = Array.isArray(s?.lines) ? s.lines : [];
    for (const b of bullets) {
      const t = String(b || "").trim();
      if (t) lines.push(`- ${t}`);
    }

    const notes = String(s?.notes || "").trim();
    if (notes) {
      // Keep notes brief; they improve generation but can bloat prompts.
      const compact = notes.replace(/\s+/g, " ").slice(0, 800);
      lines.push(`Notes: ${compact}`);
    }
    lines.push("");
  }

  const refs = Array.isArray(references) ? references : [];
  if (refs.length) {
    lines.push("References:");
    for (const r of refs.slice(0, 12)) {
      const t = String(r?.title || "").trim();
      const u = String(r?.url || "").trim();
      if (t || u) lines.push(`- ${t}${t && u ? " — " : ""}${u}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}

/** @param {unknown} maxSlides */
export function parseTwoSlidesPage(maxSlides) {
  const n = Number.parseInt(String(maxSlides ?? ""), 10);
  if (!Number.isFinite(n) || n < 1) return 0;
  return Math.min(100, n);
}

/**
 * Submit async slide generation (Fast PPT — POST /api/v1/slides/generate).
 * @param {{ inputText: string, themeId: string, responseLanguage?: string, page?: number }} opts
 */
export async function submitTwoSlidesGeneration({
  inputText,
  themeId,
  responseLanguage = "Auto",
  page = 0,
}) {
  if (!process.env.TWOSLIDES_API_KEY) {
    return { ok: false, error: "TWOSLIDES_API_KEY is not configured." };
  }

  const userInput = String(inputText || "").trim();
  const theme = String(themeId || "").trim();
  if (!userInput) {
    return { ok: false, error: "2slides: input text is required." };
  }
  if (!theme) {
    return {
      ok: false,
      error: "A theme is required for 2slides. Search and select a theme first.",
    };
  }

  const payload = {
    userInput,
    themeId: theme,
    responseLanguage,
    mode: "async",
  };
  if (page > 0) payload.page = page;

  const res = await fetch(`${TWOSLIDES_BASE}/api/v1/slides/generate`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60_000),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      ok: false,
      error: data?.message || data?.error || `2slides error ${res.status}`,
    };
  }

  const jobId = extractJobId(data);
  if (!jobId) {
    return { ok: false, error: "2slides returned no job ID." };
  }

  return { ok: true, presentationId: String(jobId) };
}

/**
 * Poll Fast PPT job status (GET /api/v1/jobs/{jobId}).
 * @param {string} jobId
 */
export async function pollTwoSlidesGeneration(jobId) {
  if (!process.env.TWOSLIDES_API_KEY) {
    return { status: "failed", error: "TWOSLIDES_API_KEY is not configured." };
  }

  // Always live-fetch; presigned download URLs expire after ~1 hour.
  const jobUrl = new URL(
    `${TWOSLIDES_BASE}/api/v1/jobs/${encodeURIComponent(String(jobId))}`,
  );
  jobUrl.searchParams.set("_", String(Date.now()));

  const res = await fetch(jobUrl.toString(), {
    headers: { Authorization: authHeaders().Authorization },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      status: "failed",
      error: data?.message || data?.error || `2slides poll error ${res.status}`,
    };
  }

  const rawStatus = String(
    data?.data?.status || data?.status || "processing",
  ).toLowerCase();
  const downloadUrl = extractDownloadUrl(data) || undefined;

  if (rawStatus === "failed" || rawStatus === "error") {
    return {
      status: "failed",
      error: data?.data?.error || data?.error || "2slides job failed.",
    };
  }

  if (
    rawStatus === "success" ||
    rawStatus === "completed" ||
    rawStatus === "done"
  ) {
    return { status: "completed", downloadUrl };
  }

  return {
    status: rawStatus === "pending" ? "pending" : "processing",
    downloadUrl,
  };
}
