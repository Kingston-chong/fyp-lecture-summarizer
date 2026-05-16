// Provider = which API (ChatGPT / DeepSeek / Gemini). Variant = exact model.
export const MODEL_PROVIDERS = [
  {
    id: "chatgpt",
    label: "ChatGPT",
    variants: [
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o mini" },
      { id: "gpt-4", label: "GPT-4" },
    ],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    variants: [{ id: "deepseek-chat", label: "DeepSeek Chat (V3)" }],
  },
  {
    id: "gemini",
    label: "Gemini",
    variants: [
      {
        id: "gemini-3-flash-preview",
        label: "3 Flash (Preview)",
        desc: "Fast & capable - best for quick, everyday tasks",
      },
      {
        id: "gemini-3.1-flash-lite-preview",
        label: "3.1 Flash Lite (Preview)",
        desc: "Lightweight & efficient - ideal for simple, high-volume tasks",
      },
      {
        id: "gemini-2.5-flash",
        label: "2.5 Flash",
        desc: "Balanced speed & intelligence - great for general-purpose use",
      },
      {
        id: "gemini-2.5-pro",
        label: "2.5 Pro",
        desc: "Highest quality & deep reasoning - best for complex analysis",
      },
    ],
  },
];

export const ACCEPTED = ".pdf,.pptx,.ppt,.docx,.doc,.txt,.xlsx,.xls,.csv,.md";
export const IMPROVE_ACCEPT = ".pptx,.pdf";

const OFFICE_PREVIEW_EXT = new Set([
  "pptx",
  "ppt",
  "docx",
  "doc",
  "xlsx",
  "xls",
]);

export const DASH_PROMPT_SUGGESTIONS = {
  summarizeStudent: [
    "Focus on key concepts and definitions. Keep it structured with headings.",
    "Extract formulas/theorems and explain what each variable means.",
    "Give a 10-bullet executive summary, then a detailed explanation.",
    "List likely exam questions + model answers based on the notes.",
    "Create a glossary of important terms with simple explanations.",
    "Highlight common mistakes/misconceptions and clarify them.",
  ],
  summarizeLecturer: [
    "Use inline citation markers [n] for substantive claims and end with a ## References section.",
    "Expand with lecturer-level depth: methods, assumptions, limitations, and implications.",
    "Keep slide bullets tight; put elaboration and citations in speaker notes where helpful.",
    "Flag thin or unsupported claims in the source materials instead of inventing detail.",
    "Prioritize evidence-oriented phrasing suitable for a graduate-level lecture.",
    "Map each major section to 1–2 related academic or authoritative sources when possible.",
  ],
  improve: [
    "Tighten bullets for clarity. Use parallel phrasing and remove repetition.",
    "Make the design modern: consistent typography, spacing, and alignment.",
    "Add relevant visuals/icons (but avoid clutter). Keep 1 key image per slide max.",
    "Turn dense paragraphs into concise bullets and add speaker notes for details.",
    "Improve slide flow: add section dividers and stronger slide titles.",
    "Fix contrast/readability: bigger fonts, fewer colors, consistent theme.",
  ],
};

export function isImproveSourceType(type) {
  const u = String(type || "").toUpperCase();
  return u === "PPTX" || u === "PDF";
}

export function isOfficePreviewName(name) {
  const ext =
    String(name || "")
      .split(".")
      .pop()
      ?.toLowerCase() || "";
  return OFFICE_PREVIEW_EXT.has(ext);
}

export function getDefaultVariant(providerId) {
  const p = MODEL_PROVIDERS.find((m) => m.id === providerId);
  return p?.variants?.[0]?.id ?? "gpt-4o";
}

export function modelDisplayName(saved) {
  if (!saved) return "";
  const [providerId, variantId] = saved.split(":");
  const prov = MODEL_PROVIDERS.find((m) => m.id === providerId);
  if (!variantId) return prov?.label ?? saved;
  const variant = prov?.variants?.find((v) => v.id === variantId);
  return variant ? `${prov?.label ?? providerId} · ${variant.label}` : saved;
}

export function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
