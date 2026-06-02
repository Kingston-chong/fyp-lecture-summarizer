export function themeOptionLabel(theme) {
  return (
    String(theme?.name || theme?.title || theme?.label || "").trim() ||
    String(theme?.id || theme?.theme_id || "Theme")
  );
}

export function themeOptionId(theme) {
  return String(theme?.id || theme?.theme_id || "").trim();
}

export function themesToSelectOptions(themes) {
  return (Array.isArray(themes) ? themes : [])
    .map((t) => ({
      value: themeOptionId(t),
      label: themeOptionLabel(t),
    }))
    .filter((o) => o.value);
}
