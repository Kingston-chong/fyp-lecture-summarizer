import { normalizeTemplateSpec } from "@/lib/pptxTemplateSpec";
import { selectSafeTemplateSpec } from "@/lib/improvePptTemplateSpecGuard";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function run() {
  const complexPromptLikeSpec = {
    name: "Dark Green Modular Roadmap",
    cover: {
      shapes: [
        { type: "rect", x: 0, y: 0, w: "100%", h: "100%", fill: "#0b2f22" },
      ],
      title: { x: 0.5, y: 1.8, w: 8.5, h: 1.2 },
      subtitle: { x: 0.5, y: 3.4, w: 8.5, h: 0.8 },
    },
    content: {
      shapes: [
        { type: "rect", x: 0, y: 0, w: "100%", h: "100%", fill: "#0f3f2b" },
      ],
      title: { x: 0.4, y: 0.18, w: 9.1, h: 0.7 },
      body: { x: 0.5, y: 1.05, w: 9, h: 5.5 },
    },
  };

  const normalized = normalizeTemplateSpec(complexPromptLikeSpec);
  assert(normalized.ok, "complex mixed-unit spec should normalize");
  assert(
    normalized.spec.content.body.h <= 1,
    "body height should be clamped into normalized bounds",
  );
  assert(
    normalized.spec.cover.shapes[0].w <= 2,
    "shape width should be finite and clamped",
  );

  const malformedIncoming = {
    cover: { title: { x: "abc" } },
    content: { body: { x: -999, y: 99, w: 0, h: 0 } },
  };
  const resolvedSpec = {
    cover: {
      shapes: [],
      title: { x: 0.08, y: 0.24, w: 0.74, h: 0.34 },
      subtitle: { x: 0.08, y: 0.6, w: 0.7, h: 0.18 },
    },
    content: {
      shapes: [],
      title: { x: 0.07, y: 0.1, w: 0.88, h: 0.16 },
      body: { x: 0.07, y: 0.27, w: 0.88, h: 0.64 },
    },
  };

  const picked = selectSafeTemplateSpec({
    incomingSpec: malformedIncoming,
    resolvedSpec,
    builtinFallback: resolvedSpec,
  });
  assert(Boolean(picked.spec), "should always select a valid fallback spec");
}

run();
