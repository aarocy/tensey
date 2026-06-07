import { makeEdge, makeGraph, makeNode } from "@tensey/engine";
import type { IRGraph } from "@tensey/engine";

export function createDemoGraph(): IRGraph {
  const input = makeNode("input", {
    id: "input",
    position: { x: 80, y: 160 },
    params: { shape: [null, 3, 224, 224] },
  });

  const stem = makeNode("conv2d", {
    id: "stem",
    position: { x: 290, y: 140 },
    params: {
      in_channels: 3,
      out_channels: 32,
      kernel_size: 3,
      stride: 2,
      padding: 1,
      bias: true,
    },
  });

  const activation = makeNode("relu", {
    id: "activation",
    position: { x: 500, y: 160 },
  });

  const squeeze = makeNode("adaptive_avg_pool2d", {
    id: "squeeze",
    position: { x: 710, y: 140 },
    params: { output_size: [1, 1] },
  });

  const flatten = makeNode("flatten", {
    id: "flatten",
    position: { x: 920, y: 160 },
    params: { start_dim: 1, end_dim: -1 },
  });

  const head = makeNode("linear", {
    id: "head",
    position: { x: 1130, y: 140 },
    params: { in_features: 32, out_features: 8, bias: true },
  });

  const output = makeNode("output", {
    id: "output",
    position: { x: 1340, y: 160 },
  });

  return makeGraph(
    [input, stem, activation, squeeze, flatten, head, output],
    [
      makeEdge("input", "stem"),
      makeEdge("stem", "activation"),
      makeEdge("activation", "squeeze"),
      makeEdge("squeeze", "flatten"),
      makeEdge("flatten", "head"),
      makeEdge("head", "output"),
    ],
    { id: "demo", name: "Intro Demo" }
  );
}
