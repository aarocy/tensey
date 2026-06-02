import type { IRGraph, IRNode, Shape, Diagnostic, ValidationResult } from "./ir.js";
import { inferNodeShapes } from "./shape-rules.js";

// ---------------------------------------------------------------------------
// Topological sort (Kahn's algorithm)
// ---------------------------------------------------------------------------

function topoSort(graph: IRGraph): { order: string[]; hasCycle: boolean } {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>(); // nodeId → downstream node ids

  for (const node of graph.nodes) {
    inDegree.set(node.id, 0);
    adj.set(node.id, []);
  }

  for (const edge of graph.edges) {
    if (!inDegree.has(edge.sourceNodeId) || !inDegree.has(edge.targetNodeId)) continue;
    adj.get(edge.sourceNodeId)!.push(edge.targetNodeId);
    inDegree.set(edge.targetNodeId, (inDegree.get(edge.targetNodeId) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const neighbor of adj.get(id) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  return { order, hasCycle: order.length !== graph.nodes.length };
}

// ---------------------------------------------------------------------------
// Shape propagation result
// ---------------------------------------------------------------------------

export interface NodeShapeResult {
  nodeId: string;
  /** Inferred output shapes keyed by port name */
  outputShapes: Record<string, Shape>;
  /** Set if inference failed for this node */
  error?: string;
}

export interface ShapeAnalysisResult extends ValidationResult {
  /** Per-node results in topological order */
  nodeResults: NodeShapeResult[];
  /** Fully annotated copy of the graph (nodes have shapes filled in) */
  annotatedGraph: IRGraph;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function analyzeShapes(graph: IRGraph): ShapeAnalysisResult {
  const diagnostics: Diagnostic[] = [];
  const nodeResults: NodeShapeResult[] = [];

  const { order, hasCycle } = topoSort(graph);

  if (hasCycle) {
    diagnostics.push({
      severity: "error",
      code: "CYCLE_DETECTED",
      message: "Cannot propagate shapes: graph contains a cycle. Run validateGraph first.",
    });
    return {
      valid: false,
      diagnostics,
      nodeResults: [],
      annotatedGraph: graph,
    };
  }

  // Build fast lookups
  const nodeMap = new Map<string, IRNode>(graph.nodes.map((n) => [n.id, n]));

  // portKey → resolved shape: "nodeId:portName" → Shape
  const resolvedShapes = new Map<string, Shape>();

  // Build edge lookup: targetNodeId+targetPort → sourceNodeId+sourcePort
  const edgeToSource = new Map<string, { sourceNodeId: string; sourcePort: string }>();
  for (const edge of graph.edges) {
    const key = `${edge.targetNodeId}:${edge.targetPort}`;
    edgeToSource.set(key, { sourceNodeId: edge.sourceNodeId, sourcePort: edge.sourcePort });
  }

  // Deep-clone nodes so we can annotate without mutating the input graph
  const annotatedNodes: IRNode[] = graph.nodes.map((n) => ({
    ...n,
    inputs: n.inputs.map((p) => ({ ...p })),
    outputs: n.outputs.map((p) => ({ ...p })),
  }));
  const annotatedNodeMap = new Map(annotatedNodes.map((n) => [n.id, n]));

  for (const nodeId of order) {
    const node = nodeMap.get(nodeId);
    if (!node) continue;
    const annotated = annotatedNodeMap.get(nodeId)!;

    // Gather input shapes for this node
    const inputShapes: Record<string, Shape | null> = {};
    for (const port of node.inputs) {
      const edgeKey = `${nodeId}:${port.name}`;
      const source = edgeToSource.get(edgeKey);
      if (source) {
        const shape = resolvedShapes.get(`${source.sourceNodeId}:${source.sourcePort}`) ?? null;
        inputShapes[port.name] = shape;
        // Annotate input port
        const inputPort = annotated.inputs.find((p) => p.name === port.name);
        if (inputPort) inputPort.shape = shape;
      } else {
        inputShapes[port.name] = null;
      }
    }

    // Run inference
    const result = inferNodeShapes(node.opType, inputShapes, node.params);

    if (result.error) {
      diagnostics.push({
        severity: "error",
        code: "SHAPE_INFERENCE_FAILED",
        message: `[${node.label ?? node.opType}] ${result.error}`,
        nodeId,
      });
      nodeResults.push({ nodeId, outputShapes: {}, error: result.error });
      continue;
    }

    // Store resolved output shapes
    for (const [portName, shape] of Object.entries(result.outputShapes)) {
      resolvedShapes.set(`${nodeId}:${portName}`, shape);
      // Annotate output port
      const outputPort = annotated.outputs.find((p) => p.name === portName);
      if (outputPort) outputPort.shape = shape;
    }

    nodeResults.push({ nodeId, outputShapes: result.outputShapes });
  }

  const hasErrors = diagnostics.some((d) => d.severity === "error");
  return {
    valid: !hasErrors,
    diagnostics,
    nodeResults,
    annotatedGraph: { ...graph, nodes: annotatedNodes },
  };
}
