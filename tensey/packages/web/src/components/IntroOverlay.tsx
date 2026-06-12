import { EXAMPLE_GRAPHS } from "../lib/examples";
import { useTenseyStore } from "../store/graph";

const CONTROL_NOTES = [
  {
    title: "Logo Menu",
    body: "Open the logo menu for file actions, edit commands, templates, and help. The main chrome stays quiet until you need it.",
  },
  {
    title: "Selection",
    body: "Left click selects a block. Hold Ctrl or Command while clicking to build a multi-selection. Drag on the canvas to marquee-select.",
  },
  {
    title: "Inspector",
    body: "The right panel only fills with information when something is selected, so the workspace stays readable.",
  },
];

export function IntroOverlay() {
  const activeDialog = useTenseyStore((s) => s.activeDialog);
  const closeIntro = useTenseyStore((s) => s.closeIntro);
  const loadExampleGraph = useTenseyStore((s) => s.loadExampleGraph);
  const loadDemoGraph = useTenseyStore((s) => s.loadDemoGraph);
  const openTemplates = useTenseyStore((s) => s.openTemplates);

  if (!activeDialog) return null;

  const isTemplates = activeDialog === "templates";

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[rgba(10,12,15,0.56)] px-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-4xl rounded-xl border border-border bg-surface-1/98 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-text-disabled">
              {isTemplates ? "templates" : "workspace guide"}
            </div>
            <h1 className="mt-2 text-lg font-medium text-text-primary">
              {isTemplates ? "Start from a clean template." : "A quieter workspace with the controls where they belong."}
            </h1>
          </div>
          <button
            onClick={closeIntro}
            className="rounded border border-border px-2 py-1 font-mono text-xs text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
          >
            close
          </button>
        </div>

        {isTemplates ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-surface-0 px-4 py-3 text-sm leading-6 text-text-secondary">
              Templates remain available from the logo menu at any time. The demo is intentionally separate and only marked for the current session.
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {EXAMPLE_GRAPHS.map((example) => (
                <button
                  key={example.id}
                  onClick={() => loadExampleGraph(example.id)}
                  className="group rounded-lg border border-border bg-surface-0 p-4 text-left transition-colors hover:border-accent/40 hover:bg-surface-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-text-primary">{example.name}</div>
                      <div className="mt-1 text-xs leading-5 text-text-secondary">{example.subtitle}</div>
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-tertiary group-hover:text-text-primary">load</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_1.05fr]">
            <div className="space-y-3">
              {CONTROL_NOTES.map((note) => (
                <div key={note.title} className="rounded-lg border border-border bg-surface-0 px-4 py-3">
                  <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-text-disabled">{note.title}</div>
                  <div className="mt-1.5 text-sm leading-6 text-text-secondary">{note.body}</div>
                </div>
              ))}

              <div className="rounded-lg border border-border bg-surface-0 px-4 py-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-text-disabled">Minimal Demo</div>
                <div className="mt-2 text-sm leading-6 text-text-secondary">
                  Load a restrained four-step example to see the canvas, inspector, and export path without a wall of nodes.
                </div>
                <button
                  onClick={loadDemoGraph}
                  className="mt-3 rounded border border-accent/40 bg-accent/10 px-3 py-2 font-mono text-xs text-text-primary transition-colors hover:bg-accent/15"
                >
                  load demo
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface-0 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-text-disabled">Templates</div>
                  <div className="mt-1 text-sm text-text-primary">Use structured starting points when you need them.</div>
                </div>
                <div className="text-xs text-text-tertiary">always under the logo</div>
              </div>

              <div className="mt-4 space-y-2">
                {EXAMPLE_GRAPHS.slice(0, 3).map((example) => (
                  <button
                    key={example.id}
                    onClick={() => loadExampleGraph(example.id)}
                    className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2.5 text-left transition-colors hover:border-accent/35 hover:bg-surface-2"
                  >
                    <div className="text-sm font-medium text-text-primary">{example.name}</div>
                    <div className="mt-1 text-xs leading-5 text-text-secondary">{example.subtitle}</div>
                  </button>
                ))}
              </div>

              <button
                onClick={openTemplates}
                className="mt-4 rounded border border-border px-3 py-2 font-mono text-xs text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
              >
                browse all templates
              </button>
            </div>
          </div>
        )}

        {!isTemplates && (
          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              onClick={closeIntro}
              className="rounded border border-border px-3 py-2 font-mono text-xs text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
            >
              start blank
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
