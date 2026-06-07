import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { exportGraphToPyTorch } from "@tensey/engine";
import { rfToIrGraph, useTenseyStore } from "../store/graph";
import { downloadTextFile, loadGraph } from "../lib/persistence";

export function Topbar() {
  const {
    clearGraph,
    saveGraph,
    loadGraph: load,
    loadDemoGraph,
    openIntro,
    graphName,
    setGraphName,
    undo,
    redo,
    canUndo,
    canRedo,
    nodes,
    edges,
    dagResult,
    shapeResult,
  } = useTenseyStore();

  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const canExport = nodes.length > 0 && Boolean(dagResult?.valid) && Boolean(shapeResult?.valid);

  const handleLoad = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      load(await loadGraph(file));
      setErr(null);
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      e.target.value = "";
    }
  };

  const handleExport = () => {
    if (!canExport) return;
    try {
      const graph = rfToIrGraph(nodes, edges, graphName);
      const { code } = exportGraphToPyTorch(graph, graphName);
      const filename = `${graph.name.replace(/\s+/g, "-").toLowerCase() || "untitled"}.py`;
      downloadTextFile(filename, code, "text/x-python");
      setErr(null);
    } catch (ex) {
      setErr((ex as Error).message);
    }
  };

  return (
    <header className="relative z-20 h-12 bg-surface-0/95 backdrop-blur border-b border-border flex items-center px-4 gap-3 shrink-0">
      <div className="flex items-baseline gap-2 min-w-0">
        <span className="text-sm font-semibold text-text-primary tracking-tight">tensey</span>
        <span className="text-border-strong text-sm">/</span>
        {editing ? (
          <input
            autoFocus
            className="text-sm text-text-primary bg-surface-2 border border-accent/40 rounded px-2 py-1 outline-none w-44"
            value={graphName}
            onChange={(e) => setGraphName(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-sm text-text-tertiary hover:text-text-secondary transition-colors truncate max-w-56"
          >
            {graphName}
          </button>
        )}
      </div>

      {err && <span className="text-2xs font-mono text-error">{err}</span>}

      <div className="ml-auto flex items-center gap-2">
        <Group>
          <ToolButton onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">Undo</ToolButton>
          <ToolButton onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y / Shift+Ctrl+Z)">Redo</ToolButton>
        </Group>

        <Group>
          <ToolButton onClick={saveGraph} title="Save graph (Ctrl+S)">Save</ToolButton>
          <ToolButton onClick={() => fileRef.current?.click()} title="Load graph from JSON">Load</ToolButton>
          <ToolButton onClick={handleExport} disabled={!canExport} title={canExport ? "Export as PyTorch" : "Fix graph errors before exporting"}>Export</ToolButton>
        </Group>

        <Group>
          <ToolButton onClick={loadDemoGraph} title="Load the intro demo graph">Demo</ToolButton>
          <ToolButton onClick={openIntro} title="Open the intro tour">Intro</ToolButton>
        </Group>

        <ToolButton onClick={clearGraph} muted title="Clear the graph">Clear</ToolButton>
      </div>

      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleLoad} />
    </header>
  );
}

function Group({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-1 rounded-md border border-border bg-surface-1 p-1">{children}</div>;
}

function ToolButton({
  onClick,
  children,
  muted,
  disabled,
  title,
}: {
  onClick: () => void;
  children: ReactNode;
  muted?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        "px-2.5 py-1 rounded text-xs font-medium transition-colors border",
        disabled
          ? "text-text-disabled border-border/70 bg-surface-1 cursor-default"
          : muted
            ? "text-text-secondary border-transparent hover:text-text-primary hover:bg-surface-2"
            : "text-text-secondary border-border bg-surface-2 hover:bg-surface-3 hover:text-text-primary",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
