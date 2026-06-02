/** Shared option lists aligned with provider API docs. */

/** 2slides Fast PPT — `responseLanguage` (https://2slides.com/api) */
export const TWOSLIDES_RESPONSE_LANGUAGES = [
  { value: "Auto", label: "Auto (detect from content)" },
  { value: "English", label: "English" },
  { value: "Spanish", label: "Spanish" },
  { value: "Arabic", label: "Arabic" },
  { value: "Portuguese", label: "Portuguese" },
  { value: "Indonesian", label: "Indonesian" },
  { value: "Japanese", label: "Japanese" },
  { value: "Russian", label: "Russian" },
  { value: "Hindi", label: "Hindi" },
  { value: "French", label: "French" },
  { value: "German", label: "German" },
  { value: "Greek", label: "Greek" },
  { value: "Vietnamese", label: "Vietnamese" },
  { value: "Turkish", label: "Turkish" },
  { value: "Thai", label: "Thai" },
  { value: "Polish", label: "Polish" },
  { value: "Italian", label: "Italian" },
  { value: "Korean", label: "Korean" },
  { value: "Simplified Chinese", label: "Simplified Chinese" },
  { value: "Traditional Chinese", label: "Traditional Chinese" },
];

/**
 * Alai — `text_options.language` (https://docs.getalai.com/api/generations)
 * Empty value = omit field (API matches input language).
 */
export const ALAI_OUTPUT_LANGUAGES = [
  { value: "", label: "Auto (match input)" },
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "ar", label: "Arabic" },
  { value: "hi", label: "Hindi" },
  { value: "ru", label: "Russian" },
  { value: "vi", label: "Vietnamese" },
  { value: "th", label: "Thai" },
  { value: "id", label: "Indonesian" },
  { value: "tr", label: "Turkish" },
  { value: "pl", label: "Polish" },
  { value: "nl", label: "Dutch" },
];

export const ALAI_SLIDE_RANGE_HINT =
  "Maps to Alai slide-range buckets (approximate count, not exact).";

export const TWOSLIDES_SLIDE_COUNT_HINT =
  "Included as guidance in slide content; Fast PPT has no exact slide-count field.";
