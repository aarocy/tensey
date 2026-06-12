import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { exportGraphToPyTorch } from "@tensey/engine";
import { rfToIrGraph, useTenseyStore } from "../store/graph";
import { downloadTextFile, loadGraph } from "../lib/persistence";

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
    <header className="relative z-20 shrink-0 border-b border-border bg-surface-0/95 backdrop-blur">
      <div className="flex items-start justify-between gap-4 px-4 py-3">
        <div ref={menuRef} className="relative min-w-0">
          <button
            type="button"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
            className="rounded-lg border border-border bg-surface-1 px-3 py-2 text-left shadow-sm transition-colors hover:bg-surface-2"
          >
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-text-disabled">tensey</div>
            <div className="mt-1 text-sm font-semibold text-text-primary">Workspace</div>
          </button>

          {menuOpen && (
            <div className="absolute left-0 top-full mt-2 w-[25rem] overflow-hidden rounded-xl border border-border bg-surface-1 shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
              <div className="flex border-b border-border bg-surface-0 px-2 py-2">
                {(["file", "edit", "templates", "help"] as MenuSection[]).map((section) => (
                  <button
                    key={section}
                    type="button"
                    onClick={() => openMenuSection(section)}
                    className={[
                      "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors",
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
                    <MenuButton label="Save graph" detail="Write the current graph to a .tensey.json file." shortcut="Ctrl+S" onClick={withClose(saveGraph)} />
                    <MenuButton label="Load graph" detail="Open a saved graph file from disk." onClick={withClose(() => fileRef.current?.click())} />
                    <MenuButton label="Export PyTorch" detail="Generate Python once the graph validates cleanly." disabled={!canExport} onClick={withClose(handleExport)} />
                    <MenuButton label="Start blank" detail="Clear the current workspace and begin from scratch." danger onClick={withClose(clearGraph)} />
                  </div>
                )}

                {activeSection === "edit" && (
                  <div className="space-y-1">
                    <MenuButton label="Undo" detail="Reverse the last workspace change." shortcut="Ctrl+Z" disabled={!canUndo} onClick={withClose(undo)} />
                    <MenuButton label="Redo" detail="Reapply the change you just undid." shortcut="Ctrl+Y" disabled={!canRedo} onClick={withClose(redo)} />
                    <MenuButton label="Duplicate selection" detail="Create offset copies of the selected blocks." shortcut="Ctrl+D" disabled={selectedCount === 0} onClick={withClose(duplicateSelected)} />
                    <MenuButton label="Copy selection" detail="Copy the selected blocks to the workspace clipboard." shortcut="Ctrl+C" disabled={selectedCount === 0} onClick={withClose(copySelected)} />
                    <MenuButton label="Cut selection" detail="Copy and remove the selected blocks." shortcut="Ctrl+X" disabled={selectedCount === 0} onClick={withClose(cutSelected)} />
                    <MenuButton label="Paste" detail="Paste copied blocks back into the canvas." shortcut="Ctrl+V" disabled={clipboard.length === 0} onClick={withClose(() => pasteNode())} />
                    <MenuButton label="Delete selection" detail="Remove the selected blocks from the graph." danger disabled={selectedCount === 0} onClick={withClose(deleteSelected)} />
                    <MenuButton
                      label="Selection guide"
                      detail={
                        selectedCount === 0
                          ? "Left click to select. Hold Ctrl or Command to add more."
                          : `${selectedCount} block${selectedCount === 1 ? "" : "s"} selected.`
                      }
                      disabled
                      onClick={() => {}}
                    />
                    <MenuButton label="Templates" detail="Open the template browser at any time." onClick={withClose(openTemplates)} />
                  </div>
                )}

                {activeSection === "templates" && (
                  <div className="space-y-1">
                    <MenuButton label="Minimal demo" detail="Load the restrained demo and mark it for this browser session." onClick={withClose(loadDemoGraph)} />
                    <MenuButton label="Browse templates" detail="Open ResNet, ViT, BERT, and UNet starter graphs." onClick={withClose(openTemplates)} />
                  </div>
                )}

                {activeSection === "help" && (
                  <div className="space-y-1">
                    <MenuButton label="Workspace guide" detail="Reopen the control-focused introduction dialog." onClick={withClose(openIntro)} />
                    <MenuButton
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

        <div className="min-w-0 flex-1 pt-1">
          {editing ? (
            <input
              autoFocus
              className="w-full max-w-sm rounded-md border border-accent/45 bg-surface-2 px-2.5 py-1.5 text-sm text-text-primary outline-none"
              value={graphName}
              onChange={(e) => setGraphName(e.target.value)}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="max-w-sm truncate text-left text-sm text-text-primary transition-colors hover:text-white"
            >
              {graphName}
            </button>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
            <span className="rounded-full border border-border bg-surface-1 px-2 py-1">{statusLabel}</span>
            <span className="rounded-full border border-border bg-surface-1 px-2 py-1">Muted, high-contrast workspace</span>
            {err && <span className="rounded-full border border-error/30 bg-error/10 px-2 py-1 text-error">{err}</span>}
          </div>
        </div>
      </div>

      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleLoad} />
    </header>
  );
}

function MenuButton({
  label,
  detail,
  shortcut,
  onClick,
  disabled,
  danger,
}: {
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
        "flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
        disabled
          ? "cursor-default border-border bg-surface-1 text-text-disabled"
          : danger
            ? "border-transparent text-error hover:bg-error/10"
            : "border-transparent text-text-secondary hover:border-border hover:bg-surface-2 hover:text-text-primary",
      ].join(" ")}
    >
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-text-tertiary">{detail}</span>
      </span>
      {shortcut && <span className="shrink-0 pt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-text-disabled">{shortcut}</span>}
    </button>
  );
}
