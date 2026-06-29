import { CheckCircle2, LayoutTemplate, PanelRight, X } from "lucide-react";
import { EXAMPLE_GRAPHS } from "../lib/examples";
import { useTenseyStore } from "../store/graph";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

const CONTROL_NOTES = [
  {
    title: "Menu",
    body: "File actions, edit commands, templates, and help are grouped under the main menu.",
  },
  {
    title: "Selection",
    body: "Left click selects a block. Hold Ctrl or Command while clicking to build a multi-selection. Drag on the canvas to marquee-select.",
  },
  {
    title: "Inspector",
    body: "The right panel shows block details only when a block is selected.",
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
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[rgba(10,12,15,0.42)] px-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-3xl rounded-md border border-border bg-surface-1 p-4 shadow-[0_12px_36px_rgba(0,0,0,0.32)]"
      >
        <div className="mb-3 flex items-start justify-between gap-4 border-b border-border pb-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-text-disabled">
              {isTemplates ? <LayoutTemplate className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {isTemplates ? "Templates" : "Workspace"}
            </div>
            <h1 className="mt-2 text-base font-medium text-text-primary">
              {isTemplates ? "Choose a starter graph" : "Workspace guide"}
            </h1>
          </div>
          <Button size="icon" variant="ghost" onClick={closeIntro} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {isTemplates ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {EXAMPLE_GRAPHS.map((example) => (
                <button
                  key={example.id}
                  onClick={() => loadExampleGraph(example.id)}
                  className="group rounded-md border border-border bg-surface-0 p-3 text-left transition-colors hover:border-border-strong hover:bg-surface-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-text-primary">{example.name}</div>
                      <div className="mt-1 text-xs leading-5 text-text-secondary">{example.subtitle}</div>
                    </div>
                    <LayoutTemplate className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary group-hover:text-text-primary" aria-hidden="true" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
            <div className="space-y-3">
              {CONTROL_NOTES.map((note) => (
                <Card key={note.title} className="px-3 py-2.5">
                  <div className="text-xs font-medium uppercase tracking-[0.18em] text-text-disabled">{note.title}</div>
                  <div className="mt-1.5 text-sm leading-6 text-text-secondary">{note.body}</div>
                </Card>
              ))}

              <Card className="px-3 py-2.5">
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-text-disabled">Minimal Demo</div>
                <div className="mt-2 text-sm leading-6 text-text-secondary">
                  Load a small graph to check the canvas, inspector, and export path.
                </div>
                <Button onClick={loadDemoGraph} className="mt-3" size="sm">
                  <CheckCircle2 className="h-4 w-4" />
                  Load demo
                </Button>
              </Card>
            </div>

            <Card className="p-3">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-[0.18em] text-text-disabled">Templates</div>
                  <div className="mt-1 text-sm text-text-primary">Structured starting points</div>
                </div>
                <PanelRight className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
              </div>

              <div className="mt-3 space-y-2">
                {EXAMPLE_GRAPHS.slice(0, 3).map((example) => (
                  <button
                    key={example.id}
                    onClick={() => loadExampleGraph(example.id)}
                    className="w-full rounded border border-border bg-surface-1 px-3 py-2.5 text-left transition-colors hover:border-border-strong hover:bg-surface-2"
                  >
                    <div className="text-sm font-medium text-text-primary">{example.name}</div>
                    <div className="mt-1 text-xs leading-5 text-text-secondary">{example.subtitle}</div>
                  </button>
                ))}
              </div>

              <Button onClick={openTemplates} className="mt-3" size="sm">
                <LayoutTemplate className="h-4 w-4" />
                Browse all
              </Button>
            </Card>
          </div>
        )}

        {!isTemplates && (
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button onClick={closeIntro} size="sm" variant="secondary">
              Close
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
