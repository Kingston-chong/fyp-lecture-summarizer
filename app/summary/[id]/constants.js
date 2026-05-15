export const MODELS = ["ChatGPT", "DeepSeek", "Gemini"];
export const ACCEPTED = ".pdf,.pptx,.ppt,.docx,.doc,.txt,.xlsx,.xls,.csv,.md";
/** Documents + images (one file picker for the clip button) */
export const ATTACH_ACCEPT = `${ACCEPTED},image/*`;
export const MAX_CHAT_PASTE_IMAGES = 6;
export const CHAT_PASTE_MAX_EDGE = 1600;
export const CHAT_PASTE_JPEG_QUALITY = 0.88;

/** Stable object so React does not treat summary body props as changing every render */
export const SUMMARY_BODY_INNER_STYLE = { paddingTop: 8 };
