import { useCallback, useRef, useState, useEffect } from "react";
import {
  ReactFlow, Background, Controls, MiniMap,
  BackgroundVariant, type OnConnect, type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTenseyStore, type TenseyNodeData } from "../store/graph";
import { TenseyNode } from "./TenseyNode";
import { ContextMenu, type ContextMenuEntry } from "./ContextMenu";
import type { Node } from "@xyflow/react";

const nodeTypes: NodeTypes = { tenseyNode: TenseyNode as React.ComponentType<any> };

interface CtxMenu {
  x: number;
  y: number;
  nodeId?: string;
  flowPosition?: { x: number; y: number };
}

export function Canvas() {
  const nodes = useTenseyStore((s) => s.nodes);
  const edges = useTenseyStore((s) => s.edges);
  const checkpoint = useTenseyStore((s) => s.checkpoint);
  const undo = useTenseyStore((s) => s.undo);
  const redo = useTenseyStore((s) => s.redo);
  const onNodesChange = useTenseyStore((s) => s.onNodesChange);
  const onEdgesChange = useTenseyStore((s) => s.onEdgesChange);
  const onConnect = useTenseyStore((s) => s.onConnect);
  const addNode = useTenseyStore((s) => s.addNode);
  const deleteNode = useTenseyStore((s) => s.deleteNode);
  const deleteSelected = useTenseyStore((s) => s.deleteSelected);
  const duplicateNode = useTenseyStore((s) => s.duplicateNode);
  const duplicateSelected = useTenseyStore((s) => s.duplicateSelected);
  const copyNode = useTenseyStore((s) => s.copyNode);
  const copySelected = useTenseyStore((s) => s.copySelected);
  const cutNode = useTenseyStore((s) => s.cutNode);
  const cutSelected = useTenseyStore((s) => s.cutSelected);
  const pasteNode = useTenseyStore((s) => s.pasteNode);
  const selectNode = useTenseyStore((s) => s.selectNode);
  const toggleNodeSelection = useTenseyStore((s) => s.toggleNodeSelection);
  const selectAll = useTenseyStore((s) => s.selectAll);
  const saveGraph = useTenseyStore((s) => s.saveGraph);
  const selectedNodeIds = useTenseyStore((s) => s.selectedNodeIds);
  const clipboard = useTenseyStore((s) => s.clipboard);
  const canUndo = useTenseyStore((s) => s.canUndo);
  const canRedo = useTenseyStore((s) => s.canRedo);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const rfRef = useRef<any>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);

  const getFlowPosition = useCallback((x: number, y: number) => {
    if (!rfRef.current || !wrapperRef.current) return undefined;
    const bounds = wrapperRef.current.getBoundingClientRect();
    return rfRef.current.screenToFlowPosition({ x: x - bounds.left, y: y - bounds.top });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (isInputFocused()) return;

      if (ctrl && key === "z" && e.shiftKey) { e.preventDefault(); redo(); return; }
      if (ctrl && key === "z") { e.preventDefault(); undo(); return; }
      if (ctrl && key === "y") { e.preventDefault(); redo(); return; }
      if (ctrl && key === "s") { e.preventDefault(); saveGraph(); return; }
      if (ctrl && key === "a") { e.preventDefault(); selectAll(); return; }
      if (ctrl && key === "c" && selectedNodeIds.length > 0) { e.preventDefault(); copySelected(); return; }
      if (ctrl && key === "x" && selectedNodeIds.length > 0) { e.preventDefault(); cutSelected(); return; }
      if (ctrl && key === "v") { e.preventDefault(); pasteNode(); return; }
      if (ctrl && key === "d" && selectedNodeIds.length > 0) { e.preventDefault(); duplicateSelected(); return; }
      if (e.key === "Escape") { e.preventDefault(); selectNode(null); setCtxMenu(null); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedNodeIds.length > 0) {
        e.preventDefault(); deleteSelected();
      }
    };
    window.addEventListener("keydown", handler);
    return () => { window.removeEventListener("keydown", handler); };
  }, [undo, redo, saveGraph, selectAll, selectedNodeIds, copySelected, cutSelected, pasteNode, duplicateSelected, deleteSelected, selectNode]);

  const handleNodeContextMenu = useCallback((e: React.MouseEvent, node: Node<TenseyNodeData>) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, nodeId: node.id, flowPosition: getFlowPosition(e.clientX, e.clientY) });
    if (!selectedNodeIds.includes(node.id)) selectNode(node.id);
  }, [getFlowPosition, selectNode, selectedNodeIds]);

  const handlePaneContextMenu = useCallback((e: MouseEvent | React.MouseEvent) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, flowPosition: getFlowPosition(e.clientX, e.clientY) });
  }, [getFlowPosition]);

  const ctxItems = useCallback((): ContextMenuEntry[] => {
    if (!ctxMenu) return [];
    const id = ctxMenu.nodeId;
    const pasteAtCursor = () => pasteNode(ctxMenu.flowPosition);
    if (!id) {
      return [
        { label: "Paste", shortcut: "⌘V", onClick: pasteAtCursor, disabled: clipboard.length === 0 },
        { label: "Select all", shortcut: "⌘A", onClick: selectAll, disabled: nodes.length === 0 },
        { separator: true },
        { label: "Undo", shortcut: "⌘Z", onClick: undo, disabled: !canUndo },
        { label: "Redo", shortcut: "⇧⌘Z", onClick: redo, disabled: !canRedo },
      ];
    }
    const selectedLabel = selectedNodeIds.length > 1 ? `${selectedNodeIds.length} selected` : "Node";
    return [
      { label: selectedLabel, disabled: true, onClick: () => {} },
      { separator: true },
      { label: "Duplicate", shortcut: "⌘D", onClick: selectedNodeIds.length > 1 ? duplicateSelected : () => duplicateNode(id) },
      { label: "Copy", shortcut: "⌘C", onClick: selectedNodeIds.length > 1 ? copySelected : () => copyNode(id) },
      { label: "Cut", shortcut: "⌘X", onClick: selectedNodeIds.length > 1 ? cutSelected : () => cutNode(id) },
      { separator: true },
      { label: "Paste", shortcut: "⌘V", onClick: pasteAtCursor, disabled: clipboard.length === 0 },
      { separator: true },
      { label: "Undo", shortcut: "⌘Z", onClick: undo, disabled: !canUndo },
      { label: "Redo", shortcut: "⇧⌘Z", onClick: redo, disabled: !canRedo },
      { separator: true },
      { label: "Delete", shortcut: "Del", onClick: selectedNodeIds.length > 1 ? deleteSelected : () => deleteNode(id), danger: true },
    ];
  }, [
    ctxMenu, clipboard.length, selectAll, nodes.length, undo, redo, canUndo, canRedo,
    selectedNodeIds, duplicateSelected, duplicateNode, copySelected, copyNode,
    cutSelected, cutNode, pasteNode, deleteSelected, deleteNode,
  ]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const opType = e.dataTransfer.getData("tensey/opType");
    if (!opType || !rfRef.current || !wrapperRef.current) return;
    const bounds = wrapperRef.current.getBoundingClientRect();
    const position = rfRef.current.screenToFlowPosition({ x: e.clientX - bounds.left, y: e.clientY - bounds.top });
    addNode(opType, position);
  }, [addNode]);

  return (
    <div ref={wrapperRef} className="flex-1 relative figma-cursor">
      <ReactFlow
        nodes={nodes} edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect as OnConnect}
        onInit={(i) => { rfRef.current = i; }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onNodeDragStart={() => checkpoint()}
        onPaneClick={() => { selectNode(null); setCtxMenu(null); }}
        onPaneContextMenu={handlePaneContextMenu}
        onNodeContextMenu={handleNodeContextMenu as any}
        onNodeClick={(e, node) => {
          if (e.ctrlKey || e.metaKey) toggleNodeSelection(node.id);
          else selectNode(node.id);
        }}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.15}
        maxZoom={2.5}
        deleteKeyCode={null}
        selectionKeyCode={null}
        multiSelectionKeyCode={["Control", "Meta"]}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#222226" />
        <Controls showInteractive={false} />
        <MiniMap nodeStrokeWidth={0} zoomable pannable style={{ bottom: 8, right: 8 }} />
      </ReactFlow>

      {nodes.length === 0 && <EmptyState />}

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x} y={ctxMenu.y}
          items={ctxItems()}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}

function isInputFocused() {
  const el = document.activeElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

function EmptyState() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
      <div className="text-center space-y-1.5">
        <div className="text-xs font-mono text-text-disabled">drop a layer or click from the palette</div>
      </div>
    </div>
  );
}
