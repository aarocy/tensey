import type { IRGraph, IRNode, IREdge } from "./ir.js";
import { getOp } from "./registry.js";

let _nodeCounter = 0;
let _edgeCounter = 0;

export function resetCounters(): void {
  _nodeCounter = 0;
  _edgeCounter = 0;
}

export function makeNode(opType: string, overrides: Partial<IRNode> = {}): IRNode {
  const def = getOp(opType);
  const id = overrides.id ?? `node_${++_nodeCounter}`;
  return {
    id,
    opType,
    label: def?.label ?? opType,
    params: { ...(def?.defaultParams ?? {}), ...overrides.params },
    inputs: (def?.inputPorts ?? []).map((name) => ({ name, shape: null, dtype: "float32" })),
    outputs: (def?.outputPorts ?? []).map((name) => ({ name, shape: null, dtype: "float32" })),
    ...overrides,
  };
}

export function makeEdge(
  sourceNodeId: string,
  targetNodeId: string,
  sourcePort = "out",
  targetPort = "in",
  overrides: Partial<IREdge> = {}
): IREdge {
  return {
    id: `edge_${++_edgeCounter}`,
    sourceNodeId,
    sourcePort,
    targetNodeId,
    targetPort,
    ...overrides,
  };
}

export function makeGraph(
  nodes: IRNode[],
  edges: IREdge[],
  overrides: Partial<IRGraph> = {}
): IRGraph {
  const now = new Date().toISOString();
  return {
    id: "graph_test",
    name: "Test Graph",
    nodes,
    edges,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
