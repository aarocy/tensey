import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { exportGraphToPyTorch } from "@tensey/engine";
import {
  CheckCircle2,
  Clipboard,
  Copy,
  FileCode2,
  FolderOpen,
  HelpCircle,
  LayoutTemplate,
  Menu,
  RotateCcw,
  Save,
  Scissors,
  Trash2,
  Undo2,
  Redo2,
  type LucideIcon,
} from "lucide-react";
import { rfToIrGraph, useTenseyStore } from "../store/graph";
import { downloadTextFile, loadGraph } from "../lib/persistence";
import { Button } from "./ui/button";

type MenuSection = "file" | "edit" | "templates" | "help";

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<MenuSection>("file");
  const fileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const canExport = nodes.length > 0 && Boolean(dagResult?.valid) && Boolean(shapeResult?.valid);
  const selectedCount = selectedNodeIds.length;
  const statusLabel = nodes.length === 0 ? "Blank workspace" : `${nodes.length} blocks`;

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
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

  const openMenuSection = (section: MenuSection) => {
    setActiveSection(section);
    setMenuOpen(true);
  };

  const withClose = (action: () => void) => () => {
    action();
    setMenuOpen(false);
  };

  return (
    <header className="relative z-20 shrink-0 border-b border-border bg-surface-0">
      <div className="flex items-start justify-between gap-4 px-3 py-2">
        <div ref={menuRef} className="relative min-w-0">
          <Button
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
            className="h-10 px-3"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
            <span className="text-sm font-semibold text-text-primary">Tensey</span>
          </Button>

          {menuOpen && (
            <div className="absolute left-0 top-full mt-2 w-[24rem] overflow-hidden rounded-md border border-border bg-surface-1 shadow-[0_12px_34px_rgba(0,0,0,0.28)]">
              <div className="flex border-b border-border bg-surface-0 p-1">
                {(["file", "edit", "templates", "help"] as MenuSection[]).map((section) => (
                  <button
                    key={section}
                    type="button"
                    onClick={() => openMenuSection(section)}
                    className={[
                      "rounded px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                      activeSection === section
                        ? "bg-surface-2 text-text-primary"
                        : "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
                    ].join(" ")}
                  >
                    {section}
                  </button>
                ))}
              </div>

              <div className="p-2">
                {activeSection === "file" && (
                  <div className="space-y-1">
                    <MenuButton icon={Save} label="Save graph" detail="Save the current graph as a .tensey.json file." shortcut="Ctrl+S" onClick={withClose(saveGraph)} />
                    <MenuButton icon={FolderOpen} label="Load graph" detail="Open a saved graph file." onClick={withClose(() => fileRef.current?.click())} />
                    <MenuButton icon={FileCode2} label="Export PyTorch" detail="Generate Python after validation passes." disabled={!canExport} onClick={withClose(handleExport)} />
                    <MenuButton icon={RotateCcw} label="Start blank" detail="Clear the current workspace." danger onClick={withClose(clearGraph)} />
                  </div>
                )}

                {activeSection === "edit" && (
                  <div className="space-y-1">
                    <MenuButton icon={Undo2} label="Undo" detail="Reverse the last change." shortcut="Ctrl+Z" disabled={!canUndo} onClick={withClose(undo)} />
                    <MenuButton icon={Redo2} label="Redo" detail="Reapply the last undone change." shortcut="Ctrl+Y" disabled={!canRedo} onClick={withClose(redo)} />
                    <MenuButton icon={Copy} label="Duplicate selection" detail="Create offset copies of selected blocks." shortcut="Ctrl+D" disabled={selectedCount === 0} onClick={withClose(duplicateSelected)} />
                    <MenuButton icon={Clipboard} label="Copy selection" detail="Copy selected blocks." shortcut="Ctrl+C" disabled={selectedCount === 0} onClick={withClose(copySelected)} />
                    <MenuButton icon={Scissors} label="Cut selection" detail="Copy and remove selected blocks." shortcut="Ctrl+X" disabled={selectedCount === 0} onClick={withClose(cutSelected)} />
                    <MenuButton icon={Clipboard} label="Paste" detail="Paste copied blocks." shortcut="Ctrl+V" disabled={clipboard.length === 0} onClick={withClose(() => pasteNode())} />
                    <MenuButton icon={Trash2} label="Delete selection" detail="Remove selected blocks." danger disabled={selectedCount === 0} onClick={withClose(deleteSelected)} />
                    <MenuButton
                      icon={CheckCircle2}
                      label="Selection guide"
                      detail={
                        selectedCount === 0
                          ? "Left click to select. Hold Ctrl or Command to add more."
                          : `${selectedCount} block${selectedCount === 1 ? "" : "s"} selected.`
                      }
                      disabled
                      onClick={() => {}}
                    />
                    <MenuButton icon={LayoutTemplate} label="Templates" detail="Open starter graphs." onClick={withClose(openTemplates)} />
                  </div>
                )}

                {activeSection === "templates" && (
                  <div className="space-y-1">
                    <MenuButton icon={CheckCircle2} label="Minimal demo" detail="Load a small validation-ready example." onClick={withClose(loadDemoGraph)} />
                    <MenuButton icon={LayoutTemplate} label="Browse templates" detail="Open ResNet, ViT, BERT, and UNet starters." onClick={withClose(openTemplates)} />
                  </div>
                )}

                {activeSection === "help" && (
                  <div className="space-y-1">
                    <MenuButton icon={HelpCircle} label="Workspace guide" detail="Open the workspace guide." onClick={withClose(openIntro)} />
                    <MenuButton
                      icon={CheckCircle2}
                      label="Selection"
                      detail="Use left click for single select, Ctrl or Command for multi-select, and drag on the canvas for box selection."
                      disabled
                      onClick={() => {}}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              className="h-8 w-full max-w-sm rounded border border-accent/45 bg-surface-1 px-2.5 text-sm text-text-primary outline-none"
              value={graphName}
              onChange={(e) => setGraphName(e.target.value)}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="max-w-sm truncate text-left text-sm font-medium text-text-primary transition-colors hover:text-white"
            >
              {graphName}
            </button>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
            <span>{statusLabel}</span>
            <span>Validation {canExport ? "ready" : "pending"}</span>
            {err && <span className="text-error">{err}</span>}
          </div>
        </div>
      </div>

      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleLoad} />
    </header>
  );
}

function MenuButton({
  icon: Icon,
  label,
  detail,
  shortcut,
  onClick,
  disabled,
  danger,
}: {
  icon: LucideIcon;
  label: string;
  detail: string;
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
        "flex w-full items-start justify-between gap-3 rounded border px-2.5 py-2 text-left transition-colors",
        disabled
          ? "cursor-default border-border bg-surface-1 text-text-disabled"
          : danger
            ? "border-transparent text-error hover:bg-error/10"
            : "border-transparent text-text-secondary hover:border-border hover:bg-surface-2 hover:text-text-primary",
      ].join(" ")}
    >
      <span className="flex min-w-0 gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0">
          <span className="block text-sm font-medium">{label}</span>
          <span className="mt-0.5 block text-xs leading-5 text-text-tertiary">{detail}</span>
        </span>
      </span>
      {shortcut && <span className="shrink-0 pt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-text-disabled">{shortcut}</span>}
    </button>
  );
}
