/**
 * Parse summarize SSE stream (authenticated or guest).
 * @param {ReadableStream<Uint8Array>} body
 * @param {{
 *   onStatus?: (payload: { phase?: string; step?: string; [key: string]: unknown }) => void;
 *   onChunk?: (text: string) => void;
 *   onMeta?: (payload: object) => void;
 *   onDone?: (payload: object) => void;
 *   onError?: (message: string) => void;
 * }} handlers
 */
export async function consumeSummarizeSse(body, handlers = {}) {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let streamError = "";
  let gotDone = false;

  const applySseBlock = (block) => {
    const lines = block.split(/\r?\n/);
    let event = "message";
    const dataLines = [];
    for (const ln of lines) {
      if (!ln) continue;
      if (ln.startsWith("event:")) event = ln.slice(6).trim();
      else if (ln.startsWith("data:")) dataLines.push(ln.slice(5).trimStart());
    }
    if (!dataLines.length) return;
    let payload = {};
    try {
      payload = JSON.parse(dataLines.join("\n"));
    } catch {
      payload = {};
    }
    if (event === "status" && payload?.phase) {
      handlers.onStatus?.(payload);
    } else if (event === "chunk" && payload?.text) {
      handlers.onChunk?.(payload.text);
    } else if (event === "meta") {
      handlers.onMeta?.(payload);
    } else if (event === "done") {
      gotDone = true;
      handlers.onDone?.(payload);
    } else if (event === "error") {
      streamError = payload?.error || "Summarization failed";
      handlers.onError?.(streamError);
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let splitIdx = buffer.indexOf("\n\n");
    while (splitIdx !== -1) {
      const block = buffer.slice(0, splitIdx);
      buffer = buffer.slice(splitIdx + 2);
      applySseBlock(block);
      splitIdx = buffer.indexOf("\n\n");
    }
  }

  if (buffer.trim()) applySseBlock(buffer.trim());
  if (streamError) throw new Error(streamError);
  if (!gotDone) {
    throw new Error(
      "Summarization stopped before completion. The AI may have hit a rate limit — try again or pick another model.",
    );
  }
}
