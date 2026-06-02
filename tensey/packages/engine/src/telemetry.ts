/**
 * Tensey Telemetry Engine
 *
 * Computes per-node and total:
 *   - Parameter counts (exact where possible)
 *   - FLOPs — multiply-accumulate ops, labeled as estimates
 *   - VRAM — activations + parameters, labeled as estimates
 *
 * All VRAM/FLOP numbers are estimates. They are clearly marked as such
 * in the result types. Do not use for hardware procurement decisions.
 *
 * Assumes float32 (4 bytes) unless otherwise noted.
 */

import type { IRNode, Shape, ParamValue } from "./ir.js";
import type { ShapeAnalysisResult } from "./shape-engine.js";

const BYTES_PER_FLOAT32 = 4;

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface NodeTelemetry {
  nodeId: string;
  opType: string;
  label: string;
  /** Exact parameter count. 0 for ops with no learnable params. */
  paramCount: number;
  /**
   * Estimated multiply-accumulate operations for one forward pass.
   * null = not computable (unknown input shape).
   * This is an ESTIMATE.
   */
  flopsEstimate: number | null;
  /**
   * Estimated activation memory in bytes for this node's output tensor(s).
   * null = not computable.
   * This is an ESTIMATE — does not account for in-place ops or memory reuse.
   */
  activationBytesEstimate: number | null;
}

export interface TelemetryReport {
  nodes: NodeTelemetry[];
  totals: {
    paramCount: number;
    /** Summed FLOPs. null if any node had unknown FLOPs. */
    flopsEstimate: number | null;
    /** Summed activation bytes. null if any node had unknown activations. */
    activationBytesEstimate: number | null;
    /**
     * Estimated peak VRAM in bytes.
     * = param bytes (float32) + all activation bytes.
     * This is an ESTIMATE. Does not model gradient buffers, optimizer state,
     * or framework overhead.
     */
    peakVramBytesEstimate: number | null;
  };
  /** Human-readable summary strings, ready to display in the dashboard. */
  summary: {
    params: string;
    flops: string;
    activationMemory: string;
    peakVram: string;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function numP(params: Record<string, ParamValue>, key: string): number {
  const v = params[key];
  return typeof v === "number" ? v : 0;
}

function shapeVolume(shape: Shape): number | null {
  if (shape.some((d) => d === null)) return null;
  return (shape as number[]).reduce((a, b) => a * b, 1);
}

function formatCount(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return `${n}`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

// ---------------------------------------------------------------------------
// Per-op telemetry functions
// ---------------------------------------------------------------------------

interface OpTelemetry {
  paramCount: number;
  flopsEstimate: number | null;
}

function telemetryLinear(
  params: Record<string, ParamValue>,
  inputShape: Shape | null
): OpTelemetry {
  const inF = numP(params, "in_features");
  const outF = numP(params, "out_features");
  const bias = params["bias"] !== false;

  const paramCount = inF * outF + (bias ? outF : 0);

  if (!inputShape) return { paramCount, flopsEstimate: null };
  // FLOPs = batch * seq_dims * (2 * in * out)  [MACs × 2 for mul+add]
  const vol = shapeVolume(inputShape.slice(0, -1)); // all dims except last
  const flopsEstimate = vol === null ? null : vol * 2 * inF * outF;

  return { paramCount, flopsEstimate };
}

function telemetryConv2d(
  params: Record<string, ParamValue>,
  _inputShape: Shape | null,
  outputShape: Shape | null
): OpTelemetry {
  const inC = numP(params, "in_channels");
  const outC = numP(params, "out_channels");
  const k = numP(params, "kernel_size") || 3;
  const bias = params["bias"] !== false;

  const paramCount = outC * inC * k * k + (bias ? outC : 0);

  if (!outputShape || outputShape.length < 4) return { paramCount, flopsEstimate: null };
  const outH = outputShape[2];
  const outW = outputShape[3];
  if (outH === null || outW === null) return { paramCount, flopsEstimate: null };

  const batchDim = outputShape[0]; // may be null — treat as 1 for FLOPs
  const batch = batchDim ?? 1;

  // FLOPs = 2 * batch * outC * outH * outW * inC * k * k
  const flopsEstimate = 2 * batch * outC * outH * outW * inC * k * k;
  return { paramCount, flopsEstimate };
}

function telemetryBatchNorm2d(params: Record<string, ParamValue>, inputShape: Shape | null): OpTelemetry {
  const numFeatures = numP(params, "num_features");
  // weight + bias
  const paramCount = numFeatures * 2;
  if (!inputShape) return { paramCount, flopsEstimate: null };
  const vol = shapeVolume(inputShape);
  // ~2 ops per element (normalize + scale+shift)
  const flopsEstimate = vol === null ? null : vol * 2;
  return { paramCount, flopsEstimate };
}

function telemetryLayerNorm(params: Record<string, ParamValue>, inputShape: Shape | null): OpTelemetry {
  const normShape = params["normalized_shape"];
  const paramCount = Array.isArray(normShape)
    ? (normShape as number[]).reduce((a, b) => a * b, 1) * 2
    : 0;
  if (!inputShape) return { paramCount, flopsEstimate: null };
  const vol = shapeVolume(inputShape);
  const flopsEstimate = vol === null ? null : vol * 2;
  return { paramCount, flopsEstimate };
}

function telemetryEmbedding(params: Record<string, ParamValue>): OpTelemetry {
  const numEmb = numP(params, "num_embeddings");
  const embDim = numP(params, "embedding_dim");
  return { paramCount: numEmb * embDim, flopsEstimate: 0 }; // lookup, no MACs
}

function telemetryMHA(
  params: Record<string, ParamValue>,
  queryShape: Shape | null
): OpTelemetry {
  const embedDim = numP(params, "embed_dim");
  const bias = params["bias"] !== false;
  // Q, K, V projection + output projection
  const paramCount = 4 * embedDim * embedDim + (bias ? 4 * embedDim : 0);

  if (!queryShape || queryShape.length < 2) return { paramCount, flopsEstimate: null };
  const seqLen = queryShape[queryShape.length - 2];
  const batch = queryShape[0] ?? 1;
  if (seqLen === null) return { paramCount, flopsEstimate: null };

  // Q/K/V projections: 3 * 2 * batch * seq * embed^2
  // Attention scores: 2 * batch * heads * seq^2 * head_dim (approx)
  // Output projection: 2 * batch * seq * embed^2
  const qkvFlops = 3 * 2 * batch * seqLen * embedDim * embedDim;
  const attnFlops = 2 * batch * seqLen * seqLen * embedDim;
  const outFlops = 2 * batch * seqLen * embedDim * embedDim;
  return { paramCount, flopsEstimate: qkvFlops + attnFlops + outFlops };
}

function telemetryPassthrough(): OpTelemetry {
  return { paramCount: 0, flopsEstimate: 0 };
}

function telemetryPassthroughWithShape(inputShape: Shape | null): OpTelemetry {
  if (!inputShape) return { paramCount: 0, flopsEstimate: null };
  const vol = shapeVolume(inputShape);
  return { paramCount: 0, flopsEstimate: vol }; // ~1 op per element
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

function computeNodeTelemetry(
  node: IRNode,
  inputShapes: Record<string, Shape | null>,
  outputShapes: Record<string, Shape>
): Omit<NodeTelemetry, "nodeId" | "opType" | "label"> {
  const p = node.params;
  const inShape = inputShapes["in"] ?? null;
  const outShape = outputShapes["out"] ?? null;

  let ops: OpTelemetry;

  switch (node.opType) {
    case "linear":
      ops = telemetryLinear(p, inShape);
      break;
    case "conv2d":
      ops = telemetryConv2d(p, inShape, outShape);
      break;
    case "batch_norm2d":
      ops = telemetryBatchNorm2d(p, inShape);
      break;
    case "layer_norm":
      ops = telemetryLayerNorm(p, inShape);
      break;
    case "embedding":
      ops = telemetryEmbedding(p);
      break;
    case "multi_head_attention":
      ops = telemetryMHA(p, inputShapes["query"] ?? null);
      break;
    case "relu":
    case "gelu":
    case "dropout":
      ops = telemetryPassthroughWithShape(inShape);
      break;
    case "max_pool2d":
    case "avg_pool2d":
    case "adaptive_avg_pool2d":
    case "flatten":
    case "add":
    case "concat":
    case "input":
    case "output":
      ops = telemetryPassthrough();
      break;
    default:
      ops = { paramCount: 0, flopsEstimate: null };
  }

  // Activation bytes = volume of all output tensors × 4 bytes
  let activationBytesEstimate: number | null = 0;
  for (const shape of Object.values(outputShapes)) {
    const vol = shapeVolume(shape);
    if (vol === null) { activationBytesEstimate = null; break; }
    activationBytesEstimate = (activationBytesEstimate ?? 0) + vol * BYTES_PER_FLOAT32;
  }

  return {
    paramCount: ops.paramCount,
    flopsEstimate: ops.flopsEstimate,
    activationBytesEstimate,
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function computeTelemetry(shapeResult: ShapeAnalysisResult): TelemetryReport {
  const { annotatedGraph, nodeResults } = shapeResult;

  // Build fast lookups
  const nodeResultMap = new Map(nodeResults.map((r) => [r.nodeId, r]));

  // Port shape lookup: nodeId:portName → shape
  const portShapes = new Map<string, Shape>();
  for (const nr of nodeResults) {
    for (const [port, shape] of Object.entries(nr.outputShapes)) {
      portShapes.set(`${nr.nodeId}:${port}`, shape);
    }
  }

  // Edge lookup: targetNodeId:targetPort → sourceNodeId:sourcePort
  const edgeToSource = new Map<string, { sourceNodeId: string; sourcePort: string }>();
  for (const edge of annotatedGraph.edges) {
    edgeToSource.set(`${edge.targetNodeId}:${edge.targetPort}`, {
      sourceNodeId: edge.sourceNodeId,
      sourcePort: edge.sourcePort,
    });
  }

  const nodes: NodeTelemetry[] = [];

  for (const node of annotatedGraph.nodes) {
    const nr = nodeResultMap.get(node.id);
    const outputShapes = nr?.outputShapes ?? {};

    // Resolve input shapes from edges
    const inputShapes: Record<string, Shape | null> = {};
    for (const port of node.inputs) {
      const src = edgeToSource.get(`${node.id}:${port.name}`);
      inputShapes[port.name] = src
        ? (portShapes.get(`${src.sourceNodeId}:${src.sourcePort}`) ?? null)
        : null;
    }

    const tel = computeNodeTelemetry(node, inputShapes, outputShapes);
    nodes.push({ nodeId: node.id, opType: node.opType, label: node.label, ...tel });
  }

  // Aggregate totals
  let totalParams = 0;
  let totalFlops: number | null = 0;
  let totalActivation: number | null = 0;

  for (const n of nodes) {
    totalParams += n.paramCount;
    if (n.flopsEstimate !== null && totalFlops !== null) {
      totalFlops += n.flopsEstimate;
    } else if (n.flopsEstimate === null) {
      totalFlops = null;
    }
    if (n.activationBytesEstimate !== null && totalActivation !== null) {
      totalActivation += n.activationBytesEstimate;
    } else if (n.activationBytesEstimate === null) {
      totalActivation = null;
    }
  }

  const paramBytes = totalParams * BYTES_PER_FLOAT32;
  const peakVramBytesEstimate =
    totalActivation !== null ? paramBytes + totalActivation : null;

  return {
    nodes,
    totals: {
      paramCount: totalParams,
      flopsEstimate: totalFlops,
      activationBytesEstimate: totalActivation,
      peakVramBytesEstimate,
    },
    summary: {
      params: formatCount(totalParams),
      flops: totalFlops !== null ? `~${formatCount(totalFlops)} FLOPs` : "unknown (dynamic shapes)",
      activationMemory: totalActivation !== null ? `~${formatBytes(totalActivation)}` : "unknown (dynamic shapes)",
      peakVram: peakVramBytesEstimate !== null ? `~${formatBytes(peakVramBytesEstimate)}` : "unknown (dynamic shapes)",
    },
  };
}
