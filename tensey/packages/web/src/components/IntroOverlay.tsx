import { EXAMPLE_GRAPHS } from "../lib/examples";
import { useTenseyStore } from "../store/graph";

const NOTES = [
  {
    title: "Workspace",
    body: "Blocks on the left, graph in the center, inspector on the right.",
  },
  {
    title: "Editing",
    body: "Resize panels with the double-arrow seams and keep the canvas clean.",
  },
  {
    title: "Output",
    body: "Undo, save, load, and export stay in the top bar.",
  },
];

export function IntroOverlay() {
  const isOpen = useTenseyStore((s) => s.isIntroOpen);
  const closeIntro = useTenseyStore((s) => s.closeIntro);
  const loadExampleGraph = useTenseyStore((s) => s.loadExampleGraph);
  const loadDemoGraph = useTenseyStore((s) => s.loadDemoGraph);

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-40 bg-black/55 backdrop-blur-[1px] flex items-center justify-center px-4">
      <div className="w-full max-w-5xl border border-border bg-surface-1/96 rounded-xl shadow-2xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-text-disabled font-mono">tensey intro</div>
            <h1 className="mt-2 text-lg font-medium text-text-primary">Minimal, readable, loadable.</h1>
          </div>
          <button
            onClick={closeIntro}
            className="text-xs font-mono px-2 py-1 rounded border border-border text-text-tertiary hover:text-text-primary hover:bg-surface-2 transition-colors"
          >
            close
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-3">
            {NOTES.map((note) => (
              <div
                key={note.title}
                className="rounded-lg border border-sky-400/25 bg-sky-400/10 px-4 py-3 text-sky-50 shadow-[0_0_0_1px_rgba(56,189,248,0.06)]"
              >
                <div className="text-[10px] uppercase tracking-[0.24em] text-sky-200/80 font-mono">{note.title}</div>
                <div className="mt-1.5 text-sm leading-5 text-sky-50/90">{note.body}</div>
              </div>
            ))}

            <div className="rounded-lg border border-border bg-surface-0 px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.24em] text-text-disabled font-mono">demo graph</div>
              <div className="mt-2 text-sm text-text-primary leading-5">
                A simple starter architecture is still available if you want the lightweight walkthrough.
              </div>
              <button
                onClick={loadDemoGraph}
                className="mt-3 text-xs font-mono px-3 py-2 rounded border border-accent/40 bg-accent/10 text-text-primary hover:bg-accent/15 transition-colors"
              >
                load demo
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface-0 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.24em] text-text-disabled font-mono">example gallery</div>
                <div className="mt-1 text-sm text-text-primary">Pre-built and loadable.</div>
              </div>
              <div className="text-xs text-text-tertiary">click one to load</div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {EXAMPLE_GRAPHS.map((example) => (
                <button
                  key={example.id}
                  onClick={() => loadExampleGraph(example.id)}
                  className="group text-left rounded-lg border border-border bg-surface-1 hover:bg-surface-2 hover:border-sky-400/30 transition-colors p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-text-primary">{example.name}</div>
                      <div className="mt-1 text-xs text-text-tertiary leading-4">{example.subtitle}</div>
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-sky-300/80 font-mono group-hover:text-sky-200">load</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-lg border border-border bg-surface-0 px-3 py-2 text-xs text-text-tertiary">
              Double-arrow handles resize the side panels directly.
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={closeIntro}
            className="text-xs font-mono px-3 py-2 rounded border border-border text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
          >
            start blank
          </button>
        </div>
      </div>
    </div>
  );
}
