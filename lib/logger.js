const isDev = process.env.NODE_ENV !== "production";

function formatMsg(level, scope, msg, meta) {
  const ts = new Date().toISOString();
  if (isDev) {
    console[level](`[${ts}] [${scope}]`, msg, meta || "");
  } else {
    console[level](JSON.stringify({ ts, level, scope, msg, ...(meta || {}) }));
  }
}

export const logger = {
  info: (scope, msg, meta) => formatMsg("log", scope, msg, meta),
  warn: (scope, msg, meta) => formatMsg("warn", scope, msg, meta),
  error: (scope, msg, meta) => formatMsg("error", scope, msg, meta),
};
