import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { exportGraphToPyTorch } from "@tensey/engine";
import {
  Check,
  Copy,
  Download,
  FilePlus2,
  FolderOpen,
  HelpCircle,
  LayoutTemplate,
  Redo2,
  Save,
  Scissors,
  Trash2,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { rfToIrGraph, useTenseyStore } from "../store/graph";
import { downloadTextFile, loadGraph } from "../lib/persistence";

type MenuSection = "file" | "edit" | "view" | "help";

export function Topbar() {
  const {
    clearGraph,
    saveGraph,
    loadGraph: load,
    loadDemoGraph,
    openIntro,
    openTemplates,
    graphName,
    setGraphName,
    undo,
    redo,
    duplicateSelected,
    copySelected,
    cutSelected,
    pasteNode,
    deleteSelected,
    canUndo,
    canRedo,
    nodes,
    edges,
    selectedNodeIds,
    clipboard,
    dagResult,
    shapeResult,
  } = useTenseyStore();

  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<MenuSection | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const canExport = nodes.length > 0 && Boolean(dagResult?.valid) && Boolean(shapeResult?.valid);
  const selectedCount = selectedNodeIds.length;

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(null);
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [menuOpen]);

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

  const withClose = (action: () => void) => () => {
    action();
    setMenuOpen(null);
  };

  return (
    <header className="relative z-20 flex h-10 shrink-0 items-center border-b border-border bg-surface-0 px-3 text-[13px] text-text-secondary">
      <div ref={menuRef} className="flex h-full items-center gap-1.5">
        <div className="mr-3 flex h-full items-center px-1 text-text-primary">Tensey</div>
        <MenuTrigger label="File" active={menuOpen === "file"} onClick={() => setMenuOpen(menuOpen === "file" ? null : "file")} />
        <MenuTrigger label="Edit" active={menuOpen === "edit"} onClick={() => setMenuOpen(menuOpen === "edit" ? null : "edit")} />
        <MenuTrigger label="View" active={menuOpen === "view"} onClick={() => setMenuOpen(menuOpen === "view" ? null : "view")} />
        <MenuTrigger label="Help" active={menuOpen === "help"} onClick={() => setMenuOpen(menuOpen === "help" ? null : "help")} />

        {menuOpen && (
          <div className="absolute left-2 top-full w-60 border border-border bg-surface-1 py-1 shadow-none">
            {menuOpen === "file" && (
              <>
                <MenuItem icon={FilePlus2} label="New" shortcut="Ctrl+N" onClick={withClose(clearGraph)} />
                <MenuItem icon={Save} label="Save Graph" shortcut="Ctrl+S" onClick={withClose(saveGraph)} />
                <MenuItem icon={FolderOpen} label="Load Graph" onClick={withClose(() => fileRef.current?.click())} />
                <Divider />
                <MenuItem icon={Download} label="Export PyTorch" disabled={!canExport} onClick={withClose(handleExport)} />
              </>
            )}

            {menuOpen === "edit" && (
              <>
                <MenuItem icon={Undo2} label="Undo" shortcut="Ctrl+Z" disabled={!canUndo} onClick={withClose(undo)} />
                <MenuItem icon={Redo2} label="Redo" shortcut="Ctrl+Y" disabled={!canRedo} onClick={withClose(redo)} />
                <Divider />
                <MenuItem icon={Copy} label="Duplicate" shortcut="Ctrl+D" disabled={selectedCount === 0} onClick={withClose(duplicateSelected)} />
                <MenuItem icon={Copy} label="Copy" shortcut="Ctrl+C" disabled={selectedCount === 0} onClick={withClose(copySelected)} />
                <MenuItem icon={Scissors} label="Cut" shortcut="Ctrl+X" disabled={selectedCount === 0} onClick={withClose(cutSelected)} />
                <MenuItem icon={Copy} label="Paste" shortcut="Ctrl+V" disabled={clipboard.length === 0} onClick={withClose(() => pasteNode())} />
                <Divider />
                <MenuItem icon={Trash2} label="Delete" shortcut="Del" danger disabled={selectedCount === 0} onClick={withClose(deleteSelected)} />
              </>
            )}

            {menuOpen === "view" && (
              <>
                <MenuItem icon={LayoutTemplate} label="Templates" onClick={withClose(openTemplates)} />
                <MenuItem icon={Check} label="Load Minimal Demo" onClick={withClose(loadDemoGraph)} />
              </>
            )}

            {menuOpen === "help" && (
              <MenuItem icon={HelpCircle} label="Tutorial" onClick={withClose(openIntro)} />
            )}
          </div>
        )}
      </div>

      <div className="mx-4 h-4 w-px bg-border" />

      <ToolbarButton icon={Undo2} label="Undo" disabled={!canUndo} onClick={undo} />
      <ToolbarButton icon={Redo2} label="Redo" disabled={!canRedo} onClick={redo} />

      <div className="mx-3 h-4 w-px bg-border" />

      <ToolbarButton dataAttr="export" icon={Download} label="Export" disabled={!canExport} onClick={handleExport} />
      <ToolbarButton icon={LayoutTemplate} label="Templates" onClick={openTemplates} />

      <div className="mx-3 h-4 w-px bg-border" />

      {editing ? (
        <input
          autoFocus
          className="h-6 w-56 border border-accent bg-surface-1 px-2 text-[13px] text-text-primary outline-none"
          value={graphName}
          onChange={(e) => setGraphName(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="max-w-56 truncate px-1 text-left text-[13px] text-text-secondary hover:text-text-primary"
        >
          {graphName}
        </button>
      )}

      {err && <span className="ml-3 truncate text-[12px] text-error">{err}</span>}

      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleLoad} />
    </header>
  );
}

function MenuTrigger({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "h-7 px-2 text-[13px] transition-colors hover:bg-surface-2 hover:text-text-primary",
        active ? "bg-surface-2 text-text-primary" : "text-text-secondary",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  active,
  dataAttr,
}: {
  icon?: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  dataAttr?: string;
}) {
  return (
    <button
      type="button"
      data-tutorial={dataAttr}
      onClick={onClick}
      disabled={disabled}
      className={[
        "flex h-7 items-center gap-1.5 px-2 text-[13px] transition-colors disabled:pointer-events-none disabled:text-text-disabled/55",
        active ? "bg-surface-2 text-accent" : "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
      ].join(" ")}
    >
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      <span>{label}</span>
    </button>
  );
}

function MenuItem({
  icon: Icon,
  label,
  shortcut,
  onClick,
  disabled,
  danger,
}: {
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "flex h-7 w-full items-center gap-2 px-2 text-left text-[13px] transition-colors disabled:pointer-events-none disabled:text-text-disabled/55",
        danger ? "text-error hover:bg-error-bg" : "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
      ].join(" ")}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {shortcut && <span className="text-[11px] text-text-disabled">{shortcut}</span>}
    </button>
  );
}

function Divider() {
  return <div className="my-1 border-t border-border" />;
}
