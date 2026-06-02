import { useRef, useState } from "react";
import { useTenseyStore } from "../store/graph";
import { loadGraph } from "../lib/persistence";

export function Topbar() {
  const {
    clearGraph, saveGraph, loadGraph: load, graphName, setGraphName,
    undo, redo, canUndo, canRedo,
  } = useTenseyStore();
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { load(await loadGraph(file)); setErr(null); }
    catch (ex) { setErr((ex as Error).message); }
    finally { e.target.value = ""; }
  };

  return (
    <header className="h-11 bg-surface-0 border-b border-border flex items-center px-4 gap-3 shrink-0 font-mono">
      <div className="flex items-baseline gap-2 min-w-0">
        <span className="text-sm font-mono font-semibold text-text-primary tracking-tight">tensey</span>
        <span className="text-border-strong text-sm">/</span>

        {editing ? (
          <input
            autoFocus
            className="text-sm font-mono text-text-primary bg-surface-2 border border-accent/40 rounded px-2 py-1 outline-none w-40"
            value={graphName}
            onChange={(e) => setGraphName(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-sm font-mono text-text-tertiary hover:text-text-secondary transition-colors truncate max-w-56"
          >
            {graphName}
          </button>
        )}
      </div>

      {err && <span className="text-2xs font-mono text-error ml-1">{err}</span>}

      <div className="ml-auto flex items-center gap-1.5">
        <Btn onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">undo</Btn>
        <Btn onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y / Shift+Ctrl+Z)">redo</Btn>
        <div className="w-px h-4 bg-border mx-1.5" />
        <Btn onClick={saveGraph} title="Save graph (Ctrl+S)">save</Btn>
        <Btn onClick={() => fileRef.current?.click()}>load</Btn>
        <div className="w-px h-4 bg-border mx-1.5" />
        <Btn onClick={clearGraph} muted>clear</Btn>
      </div>

      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleLoad} />
    </header>
  );
}

function Btn({
  onClick, children, muted, disabled, title,
}: { onClick: () => void; children: React.ReactNode; muted?: boolean; disabled?: boolean; title?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`text-xs font-mono px-2.5 py-1 rounded transition-colors border ${
        disabled
          ? "text-text-disabled/60 border-border/60 bg-surface-1 cursor-default"
          :
        muted
          ? "text-text-disabled border-transparent hover:text-text-tertiary hover:bg-surface-2"
          : "text-text-tertiary hover:text-text-secondary bg-surface-2 hover:bg-surface-3 border border-border"
      }`}
    >
      {children}
    </button>
  );
}
