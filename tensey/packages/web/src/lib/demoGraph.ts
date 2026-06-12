import { makeEdge, makeGraph, makeNode } from "@tensey/engine";
import type { IRGraph } from "@tensey/engine";

export function createDemoGraph(): IRGraph {
  const input = makeNode("input", {
    id: "input",
    position: { x: 120, y: 170 },
    params: { shape: [null, 128] },
  });

  const projection = makeNode("linear", {
    id: "projection",
    position: { x: 360, y: 150 },
    params: {
      in_features: 128,
      out_features: 64,
      bias: true,
    },
  });

  const norm = makeNode("layer_norm", {
    id: "norm",
    position: { x: 610, y: 150 },
    params: { normalized_shape: [64], eps: 1e-5 },
  });

  const head = makeNode("linear", {
    id: "head",
    position: { x: 860, y: 150 },
    params: { in_features: 64, out_features: 10, bias: true },
  });

  const output = makeNode("output", {
    id: "output",
    position: { x: 1110, y: 170 },
  });

  return makeGraph(
    [input, projection, norm, head, output],
    [
      makeEdge("input", "projection"),
      makeEdge("projection", "norm"),
      makeEdge("norm", "head"),
      makeEdge("head", "output"),
    ],
    { id: "demo", name: "Minimal Demo" }
  );
}
