/**
 * Build a QR code data URL for sharing a link (client-only).
 * @param {string} text
 * @param {{ size?: number }} [opts]
 */
export async function qrDataUrlForText(text, { size = 200 } = {}) {
  if (typeof window === "undefined" || !text) return "";
  const QRCode = await import("qrcode");
  return QRCode.toDataURL(text, {
    width: size,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#0f172a", light: "#ffffff" },
  });
}
