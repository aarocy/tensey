import type { IRGraph, ValidationResult, Diagnostic } from "./ir.js";
import { getOp } from "./registry.js";

/**
 * Validates the structural integrity of an IRGraph.
 * Does NOT do shape inference — that's the shape engine's job.
 *
 * Checks:
 * - All edge source/target node IDs exist
 * - All edge port names exist on their respective operator defs
 * - No duplicate node IDs
 * - No duplicate edge IDs
 * - No cycles (DFS-based)
 * - No isolated nodes (nodes with no edges, excluding input/output ops)
 * - Unknown opTypes are warned
 */
export function validateGraph(graph: IRGraph): ValidationResult {
  const diagnostics: Diagnostic[] = [];
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

  // Duplicate node IDs
  const seenNodeIds = new Set<string>();
  for (const node of graph.nodes) {
    if (seenNodeIds.has(node.id)) {
      diagnostics.push({
        severity: "error",
        code: "DUPLICATE_NODE_ID",
        message: `Duplicate node id: "${node.id}"`,
        nodeId: node.id,
      });
    }
    seenNodeIds.add(node.id);
  }

  // Duplicate edge IDs
  const seenEdgeIds = new Set<string>();
  for (const edge of graph.edges) {
    if (seenEdgeIds.has(edge.id)) {
      diagnostics.push({
        severity: "error",
        code: "DUPLICATE_EDGE_ID",
        message: `Duplicate edge id: "${edge.id}"`,
      });
    }
    seenEdgeIds.add(edge.id);
  }

  // Unknown opTypes
  for (const node of graph.nodes) {
    if (!getOp(node.opType)) {
      diagnostics.push({
        severity: "warning",
        code: "UNKNOWN_OP_TYPE",
        message: `Unknown opType "${node.opType}" on node "${node.id}". Shape analysis will be skipped for this node.`,
        nodeId: node.id,
      });
    }
  }

  // Edge endpoint validation
  const connectedNodeIds = new Set<string>();
  for (const edge of graph.edges) {
    const sourceNode = nodeMap.get(edge.sourceNodeId);
    const targetNode = nodeMap.get(edge.targetNodeId);

    if (!sourceNode) {
      diagnostics.push({
        severity: "error",
        code: "MISSING_SOURCE_NODE",
        message: `Edge "${edge.id}" references non-existent source node "${edge.sourceNodeId}"`,
        edgeId: edge.id,
      });
      continue;
    }

    if (!targetNode) {
      diagnostics.push({
        severity: "error",
        code: "MISSING_TARGET_NODE",
        message: `Edge "${edge.id}" references non-existent target node "${edge.targetNodeId}"`,
        edgeId: edge.id,
      });
      continue;
    }

    // Validate port names against operator defs
    const sourceDef = getOp(sourceNode.opType);
    if (sourceDef && !sourceDef.outputPorts.includes(edge.sourcePort)) {
      diagnostics.push({
        severity: "error",
        code: "INVALID_SOURCE_PORT",
        message: `Edge "${edge.id}": node "${edge.sourceNodeId}" (${sourceNode.opType}) has no output port "${edge.sourcePort}". Valid ports: [${sourceDef.outputPorts.join(", ")}]`,
        edgeId: edge.id,
        nodeId: edge.sourceNodeId,
      });
    }

    const targetDef = getOp(targetNode.opType);
    if (targetDef && !targetDef.inputPorts.includes(edge.targetPort)) {
      diagnostics.push({
        severity: "error",
        code: "INVALID_TARGET_PORT",
        message: `Edge "${edge.id}": node "${edge.targetNodeId}" (${targetNode.opType}) has no input port "${edge.targetPort}". Valid ports: [${targetDef.inputPorts.join(", ")}]`,
        edgeId: edge.id,
        nodeId: edge.targetNodeId,
      });
    }

    connectedNodeIds.add(edge.sourceNodeId);
    connectedNodeIds.add(edge.targetNodeId);
  }

  // Isolated nodes (warn for non-io nodes)
  for (const node of graph.nodes) {
    if (node.opType === "input" || node.opType === "output") continue;
    if (!connectedNodeIds.has(node.id)) {
      diagnostics.push({
        severity: "warning",
        code: "ISOLATED_NODE",
        message: `Node "${node.id}" (${node.opType}) has no connections`,
        nodeId: node.id,
      });
    }
  }

  // Cycle detection — DFS with coloring
  // Build adjacency list
  const adj = new Map<string, string[]>();
  for (const node of graph.nodes) adj.set(node.id, []);
  for (const edge of graph.edges) {
    if (nodeMap.has(edge.sourceNodeId) && nodeMap.has(edge.targetNodeId)) {
      adj.get(edge.sourceNodeId)!.push(edge.targetNodeId);
    }
  }

  const color = new Map<string, "white" | "gray" | "black">();
  for (const node of graph.nodes) color.set(node.id, "white");

  const cycleNodes = new Set<string>();

  function dfs(nodeId: string): boolean {
    color.set(nodeId, "gray");
    for (const neighbor of adj.get(nodeId) ?? []) {
      if (color.get(neighbor) === "gray") {
        cycleNodes.add(nodeId);
        cycleNodes.add(neighbor);
        return true;
      }
      if (color.get(neighbor) === "white" && dfs(neighbor)) {
        cycleNodes.add(nodeId);
        return true;
      }
    }
    color.set(nodeId, "black");
    return false;
  }

  for (const node of graph.nodes) {
    if (color.get(node.id) === "white") dfs(node.id);
  }

  if (cycleNodes.size > 0) {
    diagnostics.push({
      severity: "error",
      code: "CYCLE_DETECTED",
      message: `Cycle detected in graph. Involved nodes: [${[...cycleNodes].join(", ")}]. Neural networks must be DAGs.`,
    });
  }

  const hasErrors = diagnostics.some((d) => d.severity === "error");
  return { valid: !hasErrors, diagnostics };
}
