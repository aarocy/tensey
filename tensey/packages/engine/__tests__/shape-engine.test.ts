import { describe, it, expect, beforeEach } from "vitest";
import { analyzeShapes } from "../src/shape-engine.js";
import { makeNode, makeEdge, makeGraph, resetCounters } from "../src/factory.js";
import "../src/registry.js";

beforeEach(() => resetCounters());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function outShape(result: ReturnType<typeof analyzeShapes>, nodeId: string, port = "out") {
  const nr = result.nodeResults.find((r) => r.nodeId === nodeId);
  return nr?.outputShapes[port] ?? null;
}

function annotatedOutShape(result: ReturnType<typeof analyzeShapes>, nodeId: string, port = "out") {
  const node = result.annotatedGraph.nodes.find((n) => n.id === nodeId);
  return node?.outputs.find((p) => p.name === port)?.shape ?? null;
}

// ---------------------------------------------------------------------------
// Input node
// ---------------------------------------------------------------------------

describe("input node", () => {
  it("emits the configured static shape", () => {
    const input = makeNode("input", { id: "in", params: { shape: [1, 3, 224, 224] } });
    const graph = makeGraph([input], []);
    const result = analyzeShapes(graph);
    expect(result.valid).toBe(true);
    expect(outShape(result, "in")).toEqual([1, 3, 224, 224]);
  });

  it("supports dynamic batch dim (null)", () => {
    const input = makeNode("input", { id: "in", params: { shape: [null, 3, 224, 224] } });
    const graph = makeGraph([input], []);
    expect(outShape(analyzeShapes(graph), "in")).toEqual([null, 3, 224, 224]);
  });
});

// ---------------------------------------------------------------------------
// Linear
// ---------------------------------------------------------------------------

describe("linear", () => {
  it("transforms last dim correctly", () => {
    const input = makeNode("input", { id: "in", params: { shape: [null, 512] } });
    const linear = makeNode("linear", { id: "fc", params: { in_features: 512, out_features: 256, bias: true } });
    const graph = makeGraph([input, linear], [makeEdge("in", "fc")]);
    const result = analyzeShapes(graph);
    expect(result.valid).toBe(true);
    expect(outShape(result, "fc")).toEqual([null, 256]);
  });

  it("errors on in_features mismatch", () => {
    const input = makeNode("input", { id: "in", params: { shape: [null, 128] } });
    const linear = makeNode("linear", { id: "fc", params: { in_features: 512, out_features: 256, bias: true } });
    const graph = makeGraph([input, linear], [makeEdge("in", "fc")]);
    const result = analyzeShapes(graph);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.code === "SHAPE_INFERENCE_FAILED" && d.nodeId === "fc")).toBe(true);
  });

  it("works with 3-D input [batch, seq, features]", () => {
    const input = makeNode("input", { id: "in", params: { shape: [null, 128, 512] } });
    const linear = makeNode("linear", { id: "fc", params: { in_features: 512, out_features: 256, bias: true } });
    const graph = makeGraph([input, linear], [makeEdge("in", "fc")]);
    expect(outShape(analyzeShapes(graph), "fc")).toEqual([null, 128, 256]);
  });
});

// ---------------------------------------------------------------------------
// Conv2d
// ---------------------------------------------------------------------------

describe("conv2d", () => {
  it("computes output spatial dims correctly", () => {
    // [N,3,224,224] → conv(out=64, k=3, s=1, p=0) → [N,64,222,222]
    const input = makeNode("input", { id: "in", params: { shape: [null, 3, 224, 224] } });
    const conv = makeNode("conv2d", {
      id: "conv",
      params: { in_channels: 3, out_channels: 64, kernel_size: 3, stride: 1, padding: 0 },
    });
    const graph = makeGraph([input, conv], [makeEdge("in", "conv")]);
    const result = analyzeShapes(graph);
    expect(result.valid).toBe(true);
    expect(outShape(result, "conv")).toEqual([null, 64, 222, 222]);
  });

  it("computes with stride and padding", () => {
    // [N,3,224,224] → conv(out=64, k=3, s=2, p=1) → [N,64,112,112]
    const input = makeNode("input", { id: "in", params: { shape: [null, 3, 224, 224] } });
    const conv = makeNode("conv2d", {
      id: "conv",
      params: { in_channels: 3, out_channels: 64, kernel_size: 3, stride: 2, padding: 1 },
    });
    const graph = makeGraph([input, conv], [makeEdge("in", "conv")]);
    expect(outShape(analyzeShapes(graph), "conv")).toEqual([null, 64, 112, 112]);
  });

  it("errors on in_channels mismatch", () => {
    const input = makeNode("input", { id: "in", params: { shape: [null, 3, 224, 224] } });
    const conv = makeNode("conv2d", {
      id: "conv",
      params: { in_channels: 64, out_channels: 128, kernel_size: 3, stride: 1, padding: 0 },
    });
    const graph = makeGraph([input, conv], [makeEdge("in", "conv")]);
    const result = analyzeShapes(graph);
    expect(result.valid).toBe(false);
    expect(result.diagnostics[0]?.message).toMatch(/in_channels/);
  });

  it("errors on non-positive output dim", () => {
    // kernel larger than input — should produce negative output dim
    const input = makeNode("input", { id: "in", params: { shape: [1, 3, 2, 2] } });
    const conv = makeNode("conv2d", {
      id: "conv",
      params: { in_channels: 3, out_channels: 64, kernel_size: 5, stride: 1, padding: 0 },
    });
    const graph = makeGraph([input, conv], [makeEdge("in", "conv")]);
    const result = analyzeShapes(graph);
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Pooling
// ---------------------------------------------------------------------------

describe("pooling", () => {
  it("max_pool2d halves spatial dims", () => {
    const input = makeNode("input", { id: "in", params: { shape: [null, 64, 112, 112] } });
    const pool = makeNode("max_pool2d", { id: "pool", params: { kernel_size: 2, stride: 2, padding: 0 } });
    const graph = makeGraph([input, pool], [makeEdge("in", "pool")]);
    expect(outShape(analyzeShapes(graph), "pool")).toEqual([null, 64, 56, 56]);
  });

  it("adaptive_avg_pool2d produces fixed output size", () => {
    const input = makeNode("input", { id: "in", params: { shape: [null, 512, 7, 7] } });
    const pool = makeNode("adaptive_avg_pool2d", { id: "pool", params: { output_size: [1, 1] } });
    const graph = makeGraph([input, pool], [makeEdge("in", "pool")]);
    expect(outShape(analyzeShapes(graph), "pool")).toEqual([null, 512, 1, 1]);
  });
});

// ---------------------------------------------------------------------------
// Flatten
// ---------------------------------------------------------------------------

describe("flatten", () => {
  it("flattens dims 1 to end", () => {
    const input = makeNode("input", { id: "in", params: { shape: [null, 512, 1, 1] } });
    const flat = makeNode("flatten", { id: "flat", params: { start_dim: 1, end_dim: -1 } });
    const graph = makeGraph([input, flat], [makeEdge("in", "flat")]);
    expect(outShape(analyzeShapes(graph), "flat")).toEqual([null, 512]);
  });

  it("flattens with null dims conservatively", () => {
    const input = makeNode("input", { id: "in", params: { shape: [null, 64, null, null] } });
    const flat = makeNode("flatten", { id: "flat", params: { start_dim: 1, end_dim: -1 } });
    const graph = makeGraph([input, flat], [makeEdge("in", "flat")]);
    expect(outShape(analyzeShapes(graph), "flat")).toEqual([null, null]);
  });
});

// ---------------------------------------------------------------------------
// Merge ops
// ---------------------------------------------------------------------------

describe("add", () => {
  it("passes through shape when inputs match", () => {
    const a = makeNode("input", { id: "a", params: { shape: [null, 64, 56, 56] } });
    const b = makeNode("input", { id: "b", params: { shape: [null, 64, 56, 56] } });
    const add = makeNode("add", { id: "add" });
    const graph = makeGraph(
      [a, b, add],
      [makeEdge("a", "add", "out", "a"), makeEdge("b", "add", "out", "b")]
    );
    expect(outShape(analyzeShapes(graph), "add")).toEqual([null, 64, 56, 56]);
  });

  it("errors on shape mismatch", () => {
    const a = makeNode("input", { id: "a", params: { shape: [null, 64, 56, 56] } });
    const b = makeNode("input", { id: "b", params: { shape: [null, 128, 56, 56] } });
    const add = makeNode("add", { id: "add" });
    const graph = makeGraph(
      [a, b, add],
      [makeEdge("a", "add", "out", "a"), makeEdge("b", "add", "out", "b")]
    );
    const result = analyzeShapes(graph);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.nodeId === "add")).toBe(true);
  });
});

describe("concat", () => {
  it("concatenates along channel dim", () => {
    const a = makeNode("input", { id: "a", params: { shape: [null, 64, 56, 56] } });
    const b = makeNode("input", { id: "b", params: { shape: [null, 128, 56, 56] } });
    const cat = makeNode("concat", { id: "cat", params: { dim: 1 } });
    const graph = makeGraph(
      [a, b, cat],
      [makeEdge("a", "cat", "out", "a"), makeEdge("b", "cat", "out", "b")]
    );
    expect(outShape(analyzeShapes(graph), "cat")).toEqual([null, 192, 56, 56]);
  });

  it("errors on non-concat dim mismatch", () => {
    const a = makeNode("input", { id: "a", params: { shape: [null, 64, 56, 56] } });
    const b = makeNode("input", { id: "b", params: { shape: [null, 64, 28, 28] } }); // spatial mismatch
    const cat = makeNode("concat", { id: "cat", params: { dim: 1 } });
    const graph = makeGraph(
      [a, b, cat],
      [makeEdge("a", "cat", "out", "a"), makeEdge("b", "cat", "out", "b")]
    );
    expect(analyzeShapes(graph).valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// MultiHeadAttention
// ---------------------------------------------------------------------------

describe("multi_head_attention", () => {
  it("outputs query shape with embed_dim", () => {
    const q = makeNode("input", { id: "q", params: { shape: [null, 128, 512] } });
    const k = makeNode("input", { id: "k", params: { shape: [null, 128, 512] } });
    const v = makeNode("input", { id: "v", params: { shape: [null, 128, 512] } });
    const attn = makeNode("multi_head_attention", {
      id: "attn",
      params: { embed_dim: 512, num_heads: 8, dropout: 0.0, bias: true },
    });
    const graph = makeGraph(
      [q, k, v, attn],
      [
        makeEdge("q", "attn", "out", "query"),
        makeEdge("k", "attn", "out", "key"),
        makeEdge("v", "attn", "out", "value"),
      ]
    );
    const result = analyzeShapes(graph);
    expect(result.valid).toBe(true);
    expect(outShape(result, "attn")).toEqual([null, 128, 512]);
  });

  it("errors when embed_dim not divisible by num_heads", () => {
    const q = makeNode("input", { id: "q", params: { shape: [null, 128, 512] } });
    const k = makeNode("input", { id: "k", params: { shape: [null, 128, 512] } });
    const v = makeNode("input", { id: "v", params: { shape: [null, 128, 512] } });
    const attn = makeNode("multi_head_attention", {
      id: "attn",
      params: { embed_dim: 512, num_heads: 7, dropout: 0.0, bias: true }, // 512 % 7 ≠ 0
    });
    const graph = makeGraph(
      [q, k, v, attn],
      [
        makeEdge("q", "attn", "out", "query"),
        makeEdge("k", "attn", "out", "key"),
        makeEdge("v", "attn", "out", "value"),
      ]
    );
    expect(analyzeShapes(graph).valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Annotated graph
// ---------------------------------------------------------------------------

describe("annotated graph", () => {
  it("fills in output port shapes on nodes", () => {
    const input = makeNode("input", { id: "in", params: { shape: [null, 3, 224, 224] } });
    const conv = makeNode("conv2d", {
      id: "conv",
      params: { in_channels: 3, out_channels: 64, kernel_size: 3, stride: 1, padding: 0 },
    });
    const graph = makeGraph([input, conv], [makeEdge("in", "conv")]);
    const result = analyzeShapes(graph);
    expect(annotatedOutShape(result, "conv")).toEqual([null, 64, 222, 222]);
  });

  it("does not mutate the original graph", () => {
    const input = makeNode("input", { id: "in", params: { shape: [null, 3, 224, 224] } });
    const original = makeGraph([input], []);
    analyzeShapes(original);
    expect(original.nodes[0]?.outputs[0]?.shape).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Real architecture sketches
// ---------------------------------------------------------------------------

describe("architecture sketches", () => {
  it("ResNet block: conv → bn → relu → conv → bn → add (with skip)", () => {
    // [N,64,56,56] → conv(64→64,k=3,p=1) → bn → relu → conv(64→64,k=3,p=1) → bn → add(skip) → relu
    const input = makeNode("input", { id: "in", params: { shape: [null, 64, 56, 56] } });
    const conv1 = makeNode("conv2d", { id: "conv1", params: { in_channels: 64, out_channels: 64, kernel_size: 3, stride: 1, padding: 1 } });
    const bn1 = makeNode("batch_norm2d", { id: "bn1", params: { num_features: 64, eps: 1e-5, momentum: 0.1 } });
    const relu1 = makeNode("relu", { id: "relu1" });
    const conv2 = makeNode("conv2d", { id: "conv2", params: { in_channels: 64, out_channels: 64, kernel_size: 3, stride: 1, padding: 1 } });
    const bn2 = makeNode("batch_norm2d", { id: "bn2", params: { num_features: 64, eps: 1e-5, momentum: 0.1 } });
    const add = makeNode("add", { id: "add" });
    const relu2 = makeNode("relu", { id: "relu2" });
    const out = makeNode("output", { id: "out" });

    const graph = makeGraph(
      [input, conv1, bn1, relu1, conv2, bn2, add, relu2, out],
      [
        makeEdge("in", "conv1"),
        makeEdge("conv1", "bn1"),
        makeEdge("bn1", "relu1"),
        makeEdge("relu1", "conv2"),
        makeEdge("conv2", "bn2"),
        makeEdge("bn2", "add", "out", "a"),
        makeEdge("in", "add", "out", "b"),   // skip connection
        makeEdge("add", "relu2"),
        makeEdge("relu2", "out", "out", "in"),
      ]
    );

    const result = analyzeShapes(graph);
    expect(result.valid).toBe(true);
    expect(outShape(result, "relu2")).toEqual([null, 64, 56, 56]);
  });

  it("MLP: input → linear → relu → linear → output", () => {
    const input = makeNode("input", { id: "in", params: { shape: [null, 784] } });
    const fc1 = makeNode("linear", { id: "fc1", params: { in_features: 784, out_features: 256, bias: true } });
    const relu = makeNode("relu", { id: "relu" });
    const fc2 = makeNode("linear", { id: "fc2", params: { in_features: 256, out_features: 10, bias: true } });
    const out = makeNode("output", { id: "out" });

    const graph = makeGraph(
      [input, fc1, relu, fc2, out],
      [
        makeEdge("in", "fc1"),
        makeEdge("fc1", "relu"),
        makeEdge("relu", "fc2"),
        makeEdge("fc2", "out", "out", "in"),
      ]
    );

    const result = analyzeShapes(graph);
    expect(result.valid).toBe(true);
    expect(outShape(result, "fc2")).toEqual([null, 10]);
  });

  it("CNN classifier: conv → pool → flatten → linear", () => {
    const input = makeNode("input", { id: "in", params: { shape: [null, 3, 32, 32] } });
    const conv = makeNode("conv2d", { id: "conv", params: { in_channels: 3, out_channels: 16, kernel_size: 3, stride: 1, padding: 0 } });
    const pool = makeNode("max_pool2d", { id: "pool", params: { kernel_size: 2, stride: 2, padding: 0 } });
    const flat = makeNode("flatten", { id: "flat", params: { start_dim: 1, end_dim: -1 } });
    const fc = makeNode("linear", { id: "fc", params: { in_features: 16 * 15 * 15, out_features: 10, bias: true } });
    const out = makeNode("output", { id: "out" });

    // [N,3,32,32] → conv(k=3,p=0) → [N,16,30,30] → pool(k=2,s=2) → [N,16,15,15] → flat → [N,3600] → linear → [N,10]
    const graph = makeGraph(
      [input, conv, pool, flat, fc, out],
      [
        makeEdge("in", "conv"),
        makeEdge("conv", "pool"),
        makeEdge("pool", "flat"),
        makeEdge("flat", "fc"),
        makeEdge("fc", "out", "out", "in"),
      ]
    );

    const result = analyzeShapes(graph);
    expect(result.valid).toBe(true);
    expect(outShape(result, "flat")).toEqual([null, 3600]);
    expect(outShape(result, "fc")).toEqual([null, 10]);
  });
});
