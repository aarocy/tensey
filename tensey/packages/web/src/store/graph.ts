import { create } from "zustand";
import {
  type Node, type Edge,
  applyNodeChanges, applyEdgeChanges,
  type NodeChange, type EdgeChange,
} from "@xyflow/react";
import { nanoid } from "nanoid";
import {
  validateGraph, analyzeShapes, computeTelemetry, listOps,
  type IRGraph, type IRNode, type IREdge,
  type ParamValue, type ShapeAnalysisResult, type TelemetryReport, type ValidationResult,
} from "@tensey/engine";
import {
  clearWorkspaceGraph,
  loadWorkspaceGraph,
  saveGraph as saveGraphFile,
  saveWorkspaceGraph,
} from "../lib/persistence";
import { createDemoGraph } from "../lib/demoGraph";
import { getExampleGraph, type ExampleGraphSpec } from "../lib/examples";

export interface TenseyNodeData extends Record<string, unknown> {
  irNode: IRNode;
  hasError: boolean;
}

interface GraphSnapshot {
  nodes: Node<TenseyNodeData>[];
  edges: Edge[];
  graphName: string;
  selectedNodeId: string | null;
  selectedNodeIds: string[];
}

const HISTORY_LIMIT = 80;
const DEFAULT_PALETTE_WIDTH = 244;
const DEFAULT_INSPECTOR_WIDTH = 280;
const PALETTE_WIDTH_KEY = "tensey:paletteWidth";
const INSPECTOR_WIDTH_KEY = "tensey:inspectorWidth";
const TUTORIAL_SEEN_KEY = "tensey:tutorialSeen";
const DEMO_SESSION_COOKIE = "tensey_demo_seen";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readStoredNumber(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  const value = raw ? Number(raw) : fallback;
  return Number.isFinite(value) ? value : fallback;
}

function shouldShowTutorial(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(TUTORIAL_SEEN_KEY) !== "1";
}

function markTutorialSeen(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TUTORIAL_SEEN_KEY, "1");
}

function setSessionCookie(name: string): void {
  if (typeof window === "undefined") return;
  document.cookie = `${name}=1; path=/; SameSite=Lax`;
}

function markDemoSeen(): void {
  if (typeof window === "undefined") return;
  setSessionCookie(DEMO_SESSION_COOKIE);
}

function persistWorkspaceState(state: Pick<TenseyStore, "nodes" | "edges" | "graphName">): void {
  saveWorkspaceGraph(rfToIrGraph(state.nodes, state.edges, state.graphName));
}

function createWorkspaceFromGraph(graph: IRGraph) {
  return {
    nodes: graph.nodes.map(irToRfNode),
    edges: graph.edges.map(irToRfEdge),
    graphName: graph.name,
    selectedNodeId: null,
    selectedNodeIds: [],
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,
  } satisfies Pick<TenseyStore, "nodes" | "edges" | "graphName" | "selectedNodeId" | "selectedNodeIds" | "past" | "future" | "canUndo" | "canRedo">;
}

function createEmptyWorkspace() {
  return {
    nodes: [],
    edges: [],
    graphName: "Untitled",
    selectedNodeId: null,
    selectedNodeIds: [],
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,
  } satisfies Pick<TenseyStore, "nodes" | "edges" | "graphName" | "selectedNodeId" | "selectedNodeIds" | "past" | "future" | "canUndo" | "canRedo">;
}

function cloneNode(node: Node<TenseyNodeData>): Node<TenseyNodeData> {
  const irNode = node.data.irNode;
  return {
    ...node,
    position: { ...node.position },
    data: {
      ...node.data,
      irNode: {
        ...irNode,
        position: irNode.position ? { ...irNode.position } : undefined,
        params: { ...irNode.params },
        inputs: irNode.inputs.map((p) => ({ ...p, shape: p.shape ? [...p.shape] : null })),
        outputs: irNode.outputs.map((p) => ({ ...p, shape: p.shape ? [...p.shape] : null })),
      },
    },
  };
}

function cloneEdge(edge: Edge): Edge {
  return { ...edge };
}

function snapshotFromState(state: Pick<TenseyStore, "nodes" | "edges" | "graphName" | "selectedNodeId" | "selectedNodeIds">): GraphSnapshot {
  return {
    nodes: state.nodes.map(cloneNode),
    edges: state.edges.map(cloneEdge),
    graphName: state.graphName,
    selectedNodeId: state.selectedNodeId,
    selectedNodeIds: [...state.selectedNodeIds],
  };
}

function pushSnapshot(s: TenseyStore): Pick<TenseyStore, "past" | "future"> {
  return {
    past: [...s.past.slice(-(HISTORY_LIMIT - 1)), snapshotFromState(s)],
    future: [],
  };
}

export function irToRfNode(irNode: IRNode): Node<TenseyNodeData> {
  return {
    id: irNode.id,
    type: "tenseyNode",
    position: irNode.position ?? { x: 0, y: 0 },
    data: { irNode, hasError: false },
  };
}

export function irToRfEdge(irEdge: IREdge): Edge {
  return {
    id: irEdge.id,
    source: irEdge.sourceNodeId,
    sourceHandle: irEdge.sourcePort,
    target: irEdge.targetNodeId,
    targetHandle: irEdge.targetPort,
    type: "default",
  };
}

export function rfToIrGraph(nodes: Node<TenseyNodeData>[], edges: Edge[], name = "Untitled"): IRGraph {
  const now = new Date().toISOString();
  return {
    id: "main", name,
    nodes: nodes.map((n) => ({ ...n.data.irNode, position: n.position })),
    edges: edges.map((e) => ({
      id: e.id,
      sourceNodeId: e.source, sourcePort: e.sourceHandle ?? "out",
      targetNodeId: e.target, targetPort: e.targetHandle ?? "in",
    })),
    createdAt: now, updatedAt: now,
  };
}

const storedWorkspaceGraph = loadWorkspaceGraph();
const initialWorkspace = storedWorkspaceGraph ? createWorkspaceFromGraph(storedWorkspaceGraph) : createEmptyWorkspace();

interface TenseyStore {
  nodes: Node<TenseyNodeData>[];
  edges: Edge[];
  graphName: string;
  paletteWidth: number;
  inspectorWidth: number;
  activeDialog: "welcome" | "templates" | null;
  dagResult: ValidationResult | null;
  shapeResult: ShapeAnalysisResult | null;
  telemetry: TelemetryReport | null;
  selectedNodeId: string | null;
  selectedNodeIds: string[];
  clipboard: Node<TenseyNodeData>[];
  past: GraphSnapshot[];
  future: GraphSnapshot[];
  canUndo: boolean;
  canRedo: boolean;

  checkpoint: () => void;
  undo: () => void;
  redo: () => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (params: { source: string; sourceHandle?: string | null; target: string; targetHandle?: string | null }) => void;
  addNode: (opType: string, position: { x: number; y: number }) => void;
  deleteNode: (nodeId: string) => void;
  deleteSelected: () => void;
  duplicateNode: (nodeId: string) => void;
  duplicateSelected: () => void;
  copyNode: (nodeId: string) => void;
  copySelected: () => void;
  cutNode: (nodeId: string) => void;
  cutSelected: () => void;
  pasteNode: (position?: { x: number; y: number }) => void;
  updateNodeParams: (nodeId: string, params: Record<string, ParamValue>) => void;
  selectNode: (nodeId: string | null) => void;
  setSelectedNodes: (nodeIds: string[]) => void;
  toggleNodeSelection: (nodeId: string) => void;
  selectAll: () => void;
  runAnalysis: () => void;
  clearGraph: () => void;
  setGraphName: (name: string) => void;
  setPaletteWidth: (width: number) => void;
  setInspectorWidth: (width: number) => void;
  openIntro: () => void;
  openTemplates: () => void;
  closeIntro: () => void;
  loadDemoGraph: () => void;
  loadExampleGraph: (id: ExampleGraphSpec["id"]) => void;
  saveGraph: () => void;
  loadGraph: (irGraph: IRGraph) => void;
}

function runFullAnalysis(nodes: Node<TenseyNodeData>[], edges: Edge[]) {
  const graph = rfToIrGraph(nodes, edges);
  const dagResult = validateGraph(graph);
  const shapeResult = analyzeShapes(graph);
  const telemetry = computeTelemetry(shapeResult);
  const errorNodeIds = new Set(
    shapeResult.diagnostics.filter((d) => d.severity === "error" && d.nodeId).map((d) => d.nodeId!)
  );
  const annotatedNodes = nodes.map((n) => ({
    ...n,
    data: {
      ...n.data,
      irNode: shapeResult.annotatedGraph.nodes.find((an) => an.id === n.id) ?? n.data.irNode,
      hasError: errorNodeIds.has(n.id),
    },
  }));
  return { dagResult, shapeResult, telemetry, annotatedNodes };
}

export const useTenseyStore = create<TenseyStore>((set, get) => ({
  ...initialWorkspace,
  paletteWidth: readStoredNumber(PALETTE_WIDTH_KEY, DEFAULT_PALETTE_WIDTH),
  inspectorWidth: readStoredNumber(INSPECTOR_WIDTH_KEY, DEFAULT_INSPECTOR_WIDTH),
  activeDialog: shouldShowTutorial() ? "welcome" : null,
  dagResult: null, shapeResult: null, telemetry: null,
  selectedNodeId: null, selectedNodeIds: [], clipboard: [],
  past: [], future: [], canUndo: false, canRedo: false,

  checkpoint: () => {
    set((s) => {
      const next = pushSnapshot(s);
      return { ...next, canUndo: next.past.length > 0, canRedo: false };
    });
  },

  undo: () => {
    const { past, future } = get();
    const previous = past[past.length - 1];
    if (!previous) return;
    const current = snapshotFromState(get());
    const nextPast = past.slice(0, -1);
    const nextFuture = [current, ...future].slice(0, HISTORY_LIMIT);
    set({
      ...previous,
      nodes: previous.nodes.map(cloneNode),
      edges: previous.edges.map(cloneEdge),
      past: nextPast,
      future: nextFuture,
      canUndo: nextPast.length > 0,
      canRedo: nextFuture.length > 0,
    });
    get().runAnalysis();
  },

  redo: () => {
    const { past, future } = get();
    const next = future[0];
    if (!next) return;
    const current = snapshotFromState(get());
    const nextPast = [...past, current].slice(-HISTORY_LIMIT);
    const nextFuture = future.slice(1);
    set({
      ...next,
      nodes: next.nodes.map(cloneNode),
      edges: next.edges.map(cloneEdge),
      past: nextPast,
      future: nextFuture,
      canUndo: nextPast.length > 0,
      canRedo: nextFuture.length > 0,
    });
    get().runAnalysis();
  },

  onNodesChange: (changes) => {
    set((s) => {
      const nodes = applyNodeChanges(changes, s.nodes) as Node<TenseyNodeData>[];
      const selectedNodeIds = nodes.filter((n) => n.selected).map((n) => n.id);
      return {
        nodes,
        selectedNodeIds,
        selectedNodeId: selectedNodeIds[selectedNodeIds.length - 1] ?? null,
      };
    });
    get().runAnalysis();
  },
  onEdgesChange: (changes) => {
    const shouldCheckpoint = changes.some((c) => c.type === "remove");
    set((s) => ({
      ...(shouldCheckpoint ? pushSnapshot(s) : {}),
      edges: applyEdgeChanges(changes, s.edges),
      ...(shouldCheckpoint ? { canUndo: true, canRedo: false } : {}),
    }));
    get().runAnalysis();
  },
  onConnect: (params) => {
    const edge: Edge = {
      id: nanoid(8), source: params.source,
      sourceHandle: params.sourceHandle ?? "out",
      target: params.target, targetHandle: params.targetHandle ?? "in",
      type: "default",
    };
    set((s) => ({ ...pushSnapshot(s), edges: [...s.edges, edge], canUndo: true, canRedo: false }));
    get().runAnalysis();
  },

  addNode: (opType, position) => {
    const def = listOps().find((o) => o.opType === opType);
    if (!def) return;
    const id = nanoid(8);
    const irNode: IRNode = {
      id, opType, label: def.label,
      params: { ...def.defaultParams },
      inputs: def.inputPorts.map((name) => ({ name, shape: null, dtype: "float32" })),
      outputs: def.outputPorts.map((name) => ({ name, shape: null, dtype: "float32" })),
      position,
    };
    const rfNode = { ...irToRfNode(irNode), selected: true };
    set((s) => ({
      ...pushSnapshot(s),
      nodes: [...s.nodes.map((n) => ({ ...n, selected: false })), rfNode],
      selectedNodeId: id,
      selectedNodeIds: [id],
      canUndo: true,
      canRedo: false,
    }));
    get().runAnalysis();
  },

  deleteNode: (nodeId) => {
    set((s) => ({
      ...pushSnapshot(s),
      nodes: s.nodes.filter((n) => n.id !== nodeId),
      edges: s.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedNodeId: s.selectedNodeId === nodeId ? null : s.selectedNodeId,
      selectedNodeIds: s.selectedNodeIds.filter((id) => id !== nodeId),
      canUndo: true,
      canRedo: false,
    }));
    get().runAnalysis();
  },

  deleteSelected: () => {
    const ids = get().selectedNodeIds;
    if (ids.length === 0) return;
    const selected = new Set(ids);
    set((s) => ({
      ...pushSnapshot(s),
      nodes: s.nodes.filter((n) => !selected.has(n.id)),
      edges: s.edges.filter((e) => !selected.has(e.source) && !selected.has(e.target)),
      selectedNodeId: null,
      selectedNodeIds: [],
      canUndo: true,
      canRedo: false,
    }));
    get().runAnalysis();
  },

  duplicateNode: (nodeId) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const id = nanoid(8);
    const newNode: Node<TenseyNodeData> = {
      ...node,
      id,
      position: { x: node.position.x + 40, y: node.position.y + 40 },
      data: {
        ...node.data,
        irNode: { ...node.data.irNode, id, position: { x: node.position.x + 40, y: node.position.y + 40 } },
      },
      selected: true,
    };
    set((s) => ({
      ...pushSnapshot(s),
      nodes: [...s.nodes.map((n) => ({ ...n, selected: false })), newNode],
      selectedNodeId: id,
      selectedNodeIds: [id],
      canUndo: true,
      canRedo: false,
    }));
    get().runAnalysis();
  },

  duplicateSelected: () => {
    const selected = get().selectedNodeIds;
    if (selected.length <= 1) {
      if (selected[0]) get().duplicateNode(selected[0]);
      return;
    }
    const selectedSet = new Set(selected);
    const copies = get().nodes.filter((n) => selectedSet.has(n.id)).map((node) => {
      const id = nanoid(8);
      const position = { x: node.position.x + 40, y: node.position.y + 40 };
      return {
        ...cloneNode(node),
        id,
        position,
        selected: true,
        data: {
          ...node.data,
          irNode: { ...node.data.irNode, id, position },
        },
      };
    });
    set((s) => ({
      ...pushSnapshot(s),
      nodes: [...s.nodes.map((n) => ({ ...n, selected: false })), ...copies],
      selectedNodeId: copies[copies.length - 1]?.id ?? null,
      selectedNodeIds: copies.map((n) => n.id),
      canUndo: true,
      canRedo: false,
    }));
    get().runAnalysis();
  },

  copyNode: (nodeId) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (node) set({ clipboard: [cloneNode(node)] });
  },

  copySelected: () => {
    const selected = new Set(get().selectedNodeIds);
    const nodes = get().nodes.filter((n) => selected.has(n.id)).map(cloneNode);
    if (nodes.length > 0) set({ clipboard: nodes });
  },

  cutNode: (nodeId) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (node) {
      set({ clipboard: [cloneNode(node)] });
      get().deleteNode(nodeId);
    }
  },

  cutSelected: () => {
    get().copySelected();
    get().deleteSelected();
  },

  pasteNode: (position) => {
    const { clipboard } = get();
    if (clipboard.length === 0) return;
    const anchor = clipboard[0].position;
    const pasted = clipboard.map((node) => {
      const id = nanoid(8);
      const pos = position
        ? { x: position.x + (node.position.x - anchor.x), y: position.y + (node.position.y - anchor.y) }
        : { x: node.position.x + 40, y: node.position.y + 40 };
      return {
        ...cloneNode(node),
        id,
        position: pos,
        selected: true,
        data: { ...node.data, irNode: { ...node.data.irNode, id, position: pos } },
      } satisfies Node<TenseyNodeData>;
    });
    set((s) => ({
      ...pushSnapshot(s),
      nodes: [...s.nodes.map((n) => ({ ...n, selected: false })), ...pasted],
      selectedNodeId: pasted[pasted.length - 1]?.id ?? null,
      selectedNodeIds: pasted.map((n) => n.id),
      canUndo: true,
      canRedo: false,
    }));
    get().runAnalysis();
  },

  updateNodeParams: (nodeId, params) => {
    set((s) => ({
      ...pushSnapshot(s),
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, irNode: { ...n.data.irNode, params: { ...n.data.irNode.params, ...params } } } }
          : n
      ),
      canUndo: true,
      canRedo: false,
    }));
    get().runAnalysis();
  },

  selectNode: (nodeId) => get().setSelectedNodes(nodeId ? [nodeId] : []),
  setSelectedNodes: (nodeIds) => set((s) => {
    const next = [...nodeIds].sort();
    const current = [...s.selectedNodeIds].sort();
    if (next.length === current.length && next.every((id, i) => id === current[i])) {
      return s;
    }
    return {
      nodes: s.nodes.map((n) => ({ ...n, selected: nodeIds.includes(n.id) })),
      selectedNodeIds: nodeIds,
      selectedNodeId: nodeIds[nodeIds.length - 1] ?? null,
    };
  }),
  toggleNodeSelection: (nodeId) => set((s) => {
    const exists = s.selectedNodeIds.includes(nodeId);
    const selectedNodeIds = exists
      ? s.selectedNodeIds.filter((id) => id !== nodeId)
      : [...s.selectedNodeIds, nodeId];
    const current = [...s.selectedNodeIds].sort();
    const next = [...selectedNodeIds].sort();
    if (next.length === current.length && next.every((id, i) => id === current[i])) {
      return s;
    }
    return {
      nodes: s.nodes.map((n) => ({ ...n, selected: selectedNodeIds.includes(n.id) })),
      selectedNodeIds,
      selectedNodeId: selectedNodeIds[selectedNodeIds.length - 1] ?? null,
    };
  }),
  selectAll: () => set((s) => {
    const selectedNodeIds = s.nodes.map((n) => n.id);
    if (selectedNodeIds.length === s.selectedNodeIds.length && selectedNodeIds.every((id) => s.selectedNodeIds.includes(id))) {
      return s;
    }
    return {
      nodes: s.nodes.map((n) => ({ ...n, selected: true })),
      selectedNodeIds,
      selectedNodeId: selectedNodeIds[selectedNodeIds.length - 1] ?? null,
    };
  }),
  setGraphName: (name) => {
    set((s) => ({ ...pushSnapshot(s), graphName: name, canUndo: true, canRedo: false }));
    persistWorkspaceState(get());
  },

  setPaletteWidth: (width) => {
    const next = clamp(Math.round(width), 200, 360);
    set({ paletteWidth: next });
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PALETTE_WIDTH_KEY, String(next));
    }
  },
  setInspectorWidth: (width) => {
    const next = clamp(Math.round(width), 240, 380);
    set({ inspectorWidth: next });
    if (typeof window !== "undefined") {
      window.localStorage.setItem(INSPECTOR_WIDTH_KEY, String(next));
    }
  },
  openIntro: () => {
    set({ activeDialog: "welcome" });
  },
  openTemplates: () => {
    set({ activeDialog: "templates" });
  },
  closeIntro: () => {
    if (get().activeDialog === "welcome") markTutorialSeen();
    set({ activeDialog: null });
  },
  loadDemoGraph: () => {
    markTutorialSeen();
    markDemoSeen();
    get().loadGraph(createDemoGraph());
    set({ activeDialog: null });
  },
  loadExampleGraph: (id) => {
    get().loadGraph(getExampleGraph(id).graph);
    set({ activeDialog: null });
  },

  runAnalysis: () => {
    const { nodes, edges } = get();
    if (nodes.length === 0) { set({ dagResult: null, shapeResult: null, telemetry: null }); return; }
    const { dagResult, shapeResult, telemetry, annotatedNodes } = runFullAnalysis(nodes, edges);
    set({ dagResult, shapeResult, telemetry, nodes: annotatedNodes });
    persistWorkspaceState(get());
  },

  clearGraph: () => {
    set((s) => ({
      ...pushSnapshot(s),
      nodes: [], edges: [], graphName: "Untitled",
      dagResult: null, shapeResult: null, telemetry: null, selectedNodeId: null,
      selectedNodeIds: [],
      canUndo: true,
      canRedo: false,
    }));
    clearWorkspaceGraph();
  },

  saveGraph: () => {
    const { nodes, edges, graphName } = get();
    saveGraphFile(rfToIrGraph(nodes, edges, graphName));
  },

  loadGraph: (irGraph) => {
    set((s) => ({
      ...pushSnapshot(s),
      ...createWorkspaceFromGraph(irGraph),
      canUndo: true,
      canRedo: false,
    }));
    get().runAnalysis();
  },
}));
