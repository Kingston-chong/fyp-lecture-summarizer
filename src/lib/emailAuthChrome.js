/**
 * Reusable inline HTML fragments for transactional emails (not React).
 * Keep styles inline for client compatibility.
 */

export function emailBrandedHeaderHtml() {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:480px;margin:0 auto;background:#0e0e12;border-radius:12px 12px 0 0;border-bottom:1px solid rgba(255,255,255,0.06);">
  <tr>
    <td style="padding:16px 20px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle;padding-right:10px;">
          <div style="width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,#6366f1,#8b5cf6);text-align:center;line-height:34px;color:#ffffff;font-size:12px;font-weight:700;font-family:Georgia,'Times New Roman',serif;">S2</div>
        </td>
        <td style="vertical-align:middle;font-family:Georgia,'Times New Roman',serif;font-size:17px;font-weight:600;color:#e8e8f0;">Slide2Notes</td>
      </tr></table>
    </td>
  </tr>
</table>`;
}

/**
 * Wrap main email body HTML with branded header + outer container.
 * @param {string} innerHtml — already-escaped or trusted HTML for the message body
 */
export function wrapEmailWithAuthChrome(innerHtml) {
  return `
${emailBrandedHeaderHtml()}
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:24px 20px 32px;background:#14141c;border-radius:0 0 12px 12px;color:#e8e8f0;">
${innerHtml}
</div>`;
}
