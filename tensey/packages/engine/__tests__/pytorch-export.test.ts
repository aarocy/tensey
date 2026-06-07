import { describe, it, expect, beforeEach } from "vitest";
import { exportGraphToPyTorch } from "../src/pytorch-export.js";
import { makeNode, makeEdge, makeGraph, resetCounters } from "../src/factory.js";
import "../src/registry.js";

beforeEach(() => resetCounters());

describe("exportGraphToPyTorch", () => {
  it("exports a sequential CNN-style graph as a torch.nn.Module", () => {
    const input = makeNode("input", { id: "input", params: { shape: [1, 3, 224, 224] } });
    const conv = makeNode("conv2d", {
      id: "conv",
      params: { in_channels: 3, out_channels: 64, kernel_size: 3, stride: 1, padding: 1, bias: true },
    });
    const bn = makeNode("batch_norm2d", { id: "bn", params: { num_features: 64, eps: 1e-5, momentum: 0.1 } });
    const relu = makeNode("relu", { id: "relu" });
    const pool = makeNode("global_avg_pool2d", { id: "pool" });
    const flat = makeNode("flatten", { id: "flat", params: { start_dim: 1, end_dim: -1 } });
    const fc = makeNode("linear", { id: "fc", params: { in_features: 64, out_features: 10, bias: true } });
    const output = makeNode("output", { id: "output" });

    const graph = makeGraph(
      [input, conv, bn, relu, pool, flat, fc, output],
      [
        makeEdge("input", "conv"),
        makeEdge("conv", "bn"),
        makeEdge("bn", "relu"),
        makeEdge("relu", "pool"),
        makeEdge("pool", "flat"),
        makeEdge("flat", "fc"),
        makeEdge("fc", "output"),
      ],
      { name: "Vision Net" }
    );

    const result = exportGraphToPyTorch(graph, graph.name);
    expect(result.className).toBe("VisionNet");
    expect(result.code).toContain("class VisionNet(nn.Module):");
    expect(result.code).toContain("def forward(self, x):");
    expect(result.code).toContain("self.node_conv = nn.Conv2d");
    expect(result.code).toContain("self.node_bn = nn.BatchNorm2d");
    expect(result.code).toContain("self.node_fc = nn.Linear");
    expect(result.code).toContain("return");
  });

  it("exports multiple graph inputs with stable forward arguments", () => {
    const left = makeNode("input", { id: "left", params: { shape: [1, 64] } });
    const right = makeNode("input", { id: "right", params: { shape: [1, 64] } });
    const add = makeNode("add", { id: "add" });
    const output = makeNode("output", { id: "output" });

    const graph = makeGraph(
      [left, right, add, output],
      [
        makeEdge("left", "add", "out", "a"),
        makeEdge("right", "add", "out", "b"),
        makeEdge("add", "output"),
      ],
      { name: "Residual" }
    );

    const result = exportGraphToPyTorch(graph, graph.name);
    expect(result.code).toContain("def forward(self, x, x2):");
    expect(result.code).toContain("return");
  });
});
