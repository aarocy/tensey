import { useEffect, useLayoutEffect, useState, type CSSProperties } from "react";
import { LayoutTemplate, X } from "lucide-react";
import { EXAMPLE_GRAPHS } from "../lib/examples";
import { useTenseyStore } from "../store/graph";

const TUTORIAL_STEPS = [
  {
    target: "palette",
    title: "Node Palette",
    body: "Drag operators from this list onto the graph, or click one to add it quickly.",
    side: "right",
  },
  {
    target: "canvas",
    title: "Canvas",
    body: "Pan, zoom, select, and arrange nodes here. The graph stays as the main workspace.",
    side: "center",
  },
  {
    target: "canvas",
    title: "Connecting Nodes",
    body: "Drag from an output handle to an input handle to connect tensor flow.",
    side: "center",
  },
  {
    target: "inspector",
    title: "Inspector",
    body: "Select a node to edit parameters, check shapes, and inspect diagnostics.",
    side: "left",
  },
  {
    target: "export",
    title: "Export",
    body: "Export becomes available after the graph validates successfully.",
    side: "bottom",
  },
] as const;

type TutorialStep = (typeof TUTORIAL_STEPS)[number];

export function IntroOverlay() {
  const activeDialog = useTenseyStore((s) => s.activeDialog);
  const closeIntro = useTenseyStore((s) => s.closeIntro);
  const loadExampleGraph = useTenseyStore((s) => s.loadExampleGraph);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const isTutorial = activeDialog === "welcome";
  const isTemplates = activeDialog === "templates";
  const step = TUTORIAL_STEPS[stepIndex];

  useLayoutEffect(() => {
    if (!isTutorial) return;
    const update = () => {
      const el = document.querySelector<HTMLElement>(`[data-tutorial="${step.target}"]`);
      setRect(el?.getBoundingClientRect() ?? null);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [isTutorial, step.target]);

  useEffect(() => {
    if (isTutorial) setStepIndex(0);
  }, [isTutorial]);

  if (!activeDialog) return null;

  if (isTemplates) {
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center bg-[rgba(0,0,0,0.42)] px-4">
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-2xl border border-border bg-surface-1 shadow-none"
        >
          <div className="flex h-10 items-center justify-between border-b border-border px-3">
            <div className="flex items-center gap-2 text-[13px] text-text-primary">
              <LayoutTemplate className="h-4 w-4 text-text-secondary" aria-hidden="true" />
              <span>Templates</span>
            </div>
            <button
              type="button"
              onClick={closeIntro}
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-0 divide-y divide-border p-2">
            {EXAMPLE_GRAPHS.map((example) => (
              <button
                key={example.id}
                onClick={() => loadExampleGraph(example.id)}
                className="group flex items-start gap-3 px-2 py-2 text-left transition-colors hover:bg-surface-2"
              >
                <LayoutTemplate className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary group-hover:text-text-primary" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-[13px] text-text-primary">{example.name}</span>
                  <span className="mt-0.5 block text-[12px] leading-5 text-text-secondary">{example.subtitle}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const done = stepIndex === TUTORIAL_STEPS.length - 1;
  const style = getPopoverStyle(step, rect);

  return (
    <div className="absolute inset-0 z-40 bg-[rgba(0,0,0,0.22)]">
      {rect && (
        <div
          className="pointer-events-none absolute border border-accent"
          style={{ left: rect.left - 2, top: rect.top - 2, width: rect.width + 4, height: rect.height + 4 }}
        />
      )}
      <div
        role="dialog"
        aria-modal="true"
        className="absolute w-72 rounded-lg bg-accent p-3 text-white shadow-none"
        style={style}
      >
        <Arrow side={step.side} />
        <div className="text-[13px] font-medium">{step.title}</div>
        <div className="mt-1.5 text-[13px] leading-5 text-white/90">{step.body}</div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <button type="button" onClick={closeIntro} className="text-[12px] text-white/80 hover:text-white">
            Skip
          </button>
          <button
            type="button"
            onClick={done ? closeIntro : () => setStepIndex((i) => i + 1)}
            className="h-7 rounded bg-white px-3 text-[13px] font-medium text-accent hover:bg-white/90"
          >
            {done ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

function getPopoverStyle(step: TutorialStep, rect: DOMRect | null): CSSProperties {
  const width = 288;
  const gap = 12;
  const fallback = {
    left: `calc(50% - ${width / 2}px)`,
    top: "96px",
  };
  if (!rect) return fallback;

  if (step.side === "right") {
    return { left: rect.right + gap, top: clamp(rect.top + 48, 48, window.innerHeight - 190) };
  }
  if (step.side === "left") {
    return { left: rect.left - width - gap, top: clamp(rect.top + 48, 48, window.innerHeight - 190) };
  }
  if (step.side === "bottom") {
    return { left: clamp(rect.left - width / 2 + rect.width / 2, 12, window.innerWidth - width - 12), top: rect.bottom + gap };
  }
  return {
    left: clamp(rect.left + rect.width / 2 - width / 2, 12, window.innerWidth - width - 12),
    top: clamp(rect.top + 48, 48, window.innerHeight - 190),
  };
}

function Arrow({ side }: { side: TutorialStep["side"] }) {
  const className =
    side === "right"
      ? "absolute left-[-6px] top-8 h-3 w-3 rotate-45 bg-accent"
      : side === "left"
        ? "absolute right-[-6px] top-8 h-3 w-3 rotate-45 bg-accent"
        : side === "bottom"
          ? "absolute left-1/2 top-[-6px] h-3 w-3 -translate-x-1/2 rotate-45 bg-accent"
          : "hidden";
  return <div className={className} />;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
