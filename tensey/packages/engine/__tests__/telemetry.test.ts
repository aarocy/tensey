import { describe, it, expect, beforeEach } from "vitest";
import { analyzeShapes } from "../src/shape-engine.js";
import { computeTelemetry } from "../src/telemetry.js";
import { makeNode, makeEdge, makeGraph, resetCounters } from "../src/factory.js";
import "../src/registry.js";

beforeEach(() => resetCounters());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nodeTel(report: ReturnType<typeof computeTelemetry>, nodeId: string) {
  return report.nodes.find((n) => n.nodeId === nodeId)!;
}

function run(nodes: Parameters<typeof makeGraph>[0], edges: Parameters<typeof makeGraph>[1]) {
  return computeTelemetry(analyzeShapes(makeGraph(nodes, edges)));
}

// ---------------------------------------------------------------------------
// Parameter counts
// ---------------------------------------------------------------------------

describe("parameter counts", () => {
  it("linear: in*out + bias", () => {
    const input = makeNode("input", { id: "in", params: { shape: [1, 512] } });
    const fc = makeNode("linear", { id: "fc", params: { in_features: 512, out_features: 256, bias: true } });
    const report = run([input, fc], [makeEdge("in", "fc")]);
    // 512*256 + 256 = 131328
    expect(nodeTel(report, "fc").paramCount).toBe(512 * 256 + 256);
  });

  it("linear: no bias", () => {
    const input = makeNode("input", { id: "in", params: { shape: [1, 512] } });
    const fc = makeNode("linear", { id: "fc", params: { in_features: 512, out_features: 256, bias: false } });
    const report = run([input, fc], [makeEdge("in", "fc")]);
    expect(nodeTel(report, "fc").paramCount).toBe(512 * 256);
  });

  it("conv2d: outC * inC * k * k + bias", () => {
    const input = makeNode("input", { id: "in", params: { shape: [1, 3, 224, 224] } });
    const conv = makeNode("conv2d", { id: "conv", params: { in_channels: 3, out_channels: 64, kernel_size: 3, stride: 1, padding: 0, bias: true } });
    const report = run([input, conv], [makeEdge("in", "conv")]);
    // 64*3*3*3 + 64 = 1792
    expect(nodeTel(report, "conv").paramCount).toBe(64 * 3 * 3 * 3 + 64);
  });

  it("batch_norm2d: 2 * num_features (weight + bias)", () => {
    const input = makeNode("input", { id: "in", params: { shape: [1, 64, 56, 56] } });
    const bn = makeNode("batch_norm2d", { id: "bn", params: { num_features: 64, eps: 1e-5, momentum: 0.1 } });
    const report = run([input, bn], [makeEdge("in", "bn")]);
    expect(nodeTel(report, "bn").paramCount).toBe(128);
  });

  it("relu has 0 params", () => {
    const input = makeNode("input", { id: "in", params: { shape: [1, 64] } });
    const relu = makeNode("relu", { id: "relu" });
    const report = run([input, relu], [makeEdge("in", "relu")]);
    expect(nodeTel(report, "relu").paramCount).toBe(0);
  });

  it("embedding: num_embeddings * embedding_dim", () => {
    const input = makeNode("input", { id: "in", params: { shape: [1, 128] } });
    const emb = makeNode("embedding", { id: "emb", params: { num_embeddings: 1000, embedding_dim: 64 } });
    const report = run([input, emb], [makeEdge("in", "emb")]);
    expect(nodeTel(report, "emb").paramCount).toBe(1000 * 64);
  });

  it("multi_head_attention: 4 * embed^2 + 4 * embed bias", () => {
    const q = makeNode("input", { id: "q", params: { shape: [1, 128, 512] } });
    const k = makeNode("input", { id: "k", params: { shape: [1, 128, 512] } });
    const v = makeNode("input", { id: "v", params: { shape: [1, 128, 512] } });
    const attn = makeNode("multi_head_attention", { id: "attn", params: { embed_dim: 512, num_heads: 8, dropout: 0.0, bias: true } });
    const report = run(
      [q, k, v, attn],
      [makeEdge("q", "attn", "out", "query"), makeEdge("k", "attn", "out", "key"), makeEdge("v", "attn", "out", "value")]
    );
    expect(nodeTel(report, "attn").paramCount).toBe(4 * 512 * 512 + 4 * 512);
  });
});

// ---------------------------------------------------------------------------
// Total param counts
// ---------------------------------------------------------------------------

describe("total param counts", () => {
  it("sums correctly across layers", () => {
    const input = makeNode("input", { id: "in", params: { shape: [1, 784] } });
    const fc1 = makeNode("linear", { id: "fc1", params: { in_features: 784, out_features: 256, bias: true } });
    const relu = makeNode("relu", { id: "relu" });
    const fc2 = makeNode("linear", { id: "fc2", params: { in_features: 256, out_features: 10, bias: true } });
    const report = run(
      [input, fc1, relu, fc2],
      [makeEdge("in", "fc1"), makeEdge("fc1", "relu"), makeEdge("relu", "fc2")]
    );
    const expected = (784 * 256 + 256) + 0 + (256 * 10 + 10);
    expect(report.totals.paramCount).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// FLOP estimates
// ---------------------------------------------------------------------------

describe("flop estimates", () => {
  it("linear FLOPs = 2 * batch * in * out", () => {
    const input = makeNode("input", { id: "in", params: { shape: [4, 512] } });
    const fc = makeNode("linear", { id: "fc", params: { in_features: 512, out_features: 256, bias: true } });
    const report = run([input, fc], [makeEdge("in", "fc")]);
    // 2 * 4 * 512 * 256 = 1,048,576
    expect(nodeTel(report, "fc").flopsEstimate).toBe(2 * 4 * 512 * 256);
  });

  it("conv2d FLOPs = 2 * N * outC * outH * outW * inC * k * k", () => {
    const input = makeNode("input", { id: "in", params: { shape: [1, 3, 224, 224] } });
    const conv = makeNode("conv2d", { id: "conv", params: { in_channels: 3, out_channels: 64, kernel_size: 3, stride: 1, padding: 0, bias: true } });
    const report = run([input, conv], [makeEdge("in", "conv")]);
    // outH = outW = 222
    expect(nodeTel(report, "conv").flopsEstimate).toBe(2 * 1 * 64 * 222 * 222 * 3 * 3 * 3);
  });

  it("returns null FLOPs when input shape has dynamic dims", () => {
    const input = makeNode("input", { id: "in", params: { shape: [null, 512] } });
    const fc = makeNode("linear", { id: "fc", params: { in_features: 512, out_features: 256, bias: true } });
    const report = run([input, fc], [makeEdge("in", "fc")]);
    // batch dim is null — can't compute FLOPs
    expect(nodeTel(report, "fc").flopsEstimate).toBeNull();
    expect(report.totals.flopsEstimate).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Activation memory
// ---------------------------------------------------------------------------

describe("activation memory", () => {
  it("activation bytes = volume * 4", () => {
    const input = makeNode("input", { id: "in", params: { shape: [1, 3, 224, 224] } });
    const report = run([input], []);
    // 1*3*224*224 * 4 = 602,112
    expect(nodeTel(report, "in").activationBytesEstimate).toBe(1 * 3 * 224 * 224 * 4);
  });

  it("null activation when output shape has dynamic dim", () => {
    const input = makeNode("input", { id: "in", params: { shape: [null, 3, 224, 224] } });
    const report = run([input], []);
    expect(nodeTel(report, "in").activationBytesEstimate).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Summary strings
// ---------------------------------------------------------------------------

describe("summary formatting", () => {
  it("formats M/B param counts", () => {
    // A model with > 1M params
    const input = makeNode("input", { id: "in", params: { shape: [1, 1024] } });
    const fc = makeNode("linear", { id: "fc", params: { in_features: 1024, out_features: 1024, bias: true } });
    const report = run([input, fc], [makeEdge("in", "fc")]);
    expect(report.summary.params).toMatch(/M|K/);
  });

  it("summary shows unknown when shapes are dynamic", () => {
    const input = makeNode("input", { id: "in", params: { shape: [null, 512] } });
    const fc = makeNode("linear", { id: "fc", params: { in_features: 512, out_features: 256, bias: true } });
    const report = run([input, fc], [makeEdge("in", "fc")]);
    expect(report.summary.flops).toMatch(/unknown/);
    expect(report.summary.peakVram).toMatch(/unknown/);
  });
});

// ---------------------------------------------------------------------------
// ResNet block end-to-end
// ---------------------------------------------------------------------------

describe("ResNet block telemetry", () => {
  it("computes total params for a basic residual block", () => {
    const input = makeNode("input", { id: "in", params: { shape: [1, 64, 56, 56] } });
    const conv1 = makeNode("conv2d", { id: "conv1", params: { in_channels: 64, out_channels: 64, kernel_size: 3, stride: 1, padding: 1, bias: false } });
    const bn1 = makeNode("batch_norm2d", { id: "bn1", params: { num_features: 64, eps: 1e-5, momentum: 0.1 } });
    const relu1 = makeNode("relu", { id: "relu1" });
    const conv2 = makeNode("conv2d", { id: "conv2", params: { in_channels: 64, out_channels: 64, kernel_size: 3, stride: 1, padding: 1, bias: false } });
    const bn2 = makeNode("batch_norm2d", { id: "bn2", params: { num_features: 64, eps: 1e-5, momentum: 0.1 } });
    const add = makeNode("add", { id: "add" });

    const graph = makeGraph(
      [input, conv1, bn1, relu1, conv2, bn2, add],
      [
        makeEdge("in", "conv1"),
        makeEdge("conv1", "bn1"),
        makeEdge("bn1", "relu1"),
        makeEdge("relu1", "conv2"),
        makeEdge("conv2", "bn2"),
        makeEdge("bn2", "add", "out", "a"),
        makeEdge("in", "add", "out", "b"),
      ]
    );

    const report = computeTelemetry(analyzeShapes(graph));

    // conv params: 64*64*3*3 * 2 (no bias) = 73728
    // bn params: 128 * 2 = 256
    const expectedParams = (64 * 64 * 3 * 3) * 2 + 128 * 2;
    expect(report.totals.paramCount).toBe(expectedParams);
    // FLOPs should be computable (static shapes)
    expect(report.totals.flopsEstimate).not.toBeNull();
    expect(report.totals.flopsEstimate).toBeGreaterThan(0);
  });
});
