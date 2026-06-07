import { makeEdge, makeGraph, makeNode } from "@tensey/engine";
import type { IRGraph } from "@tensey/engine";

export interface ExampleGraphSpec {
  id: "resnet" | "vit" | "bert" | "unet";
  name: string;
  subtitle: string;
  graph: IRGraph;
}

export const EXAMPLE_GRAPHS: ExampleGraphSpec[] = [
  {
    id: "resnet",
    name: "ResNet",
    subtitle: "Residual vision block with a skip connection.",
    graph: makeGraph(
      [
        makeNode("input", { id: "input", position: { x: 60, y: 150 }, params: { shape: [null, 64, 56, 56] } }),
        makeNode("conv2d", {
          id: "stem",
          position: { x: 250, y: 140 },
          params: { in_channels: 64, out_channels: 64, kernel_size: 3, stride: 1, padding: 1, bias: true },
        }),
        makeNode("relu", { id: "relu", position: { x: 450, y: 160 } }),
        makeNode("conv2d", {
          id: "body",
          position: { x: 650, y: 140 },
          params: { in_channels: 64, out_channels: 64, kernel_size: 3, stride: 1, padding: 1, bias: true },
        }),
        makeNode("add", { id: "add", position: { x: 850, y: 150 } }),
        makeNode("output", { id: "output", position: { x: 1060, y: 160 } }),
      ],
      [
        makeEdge("input", "stem"),
        makeEdge("stem", "relu"),
        makeEdge("relu", "body"),
        makeEdge("stem", "add", "out", "a"),
        makeEdge("body", "add", "out", "b"),
        makeEdge("add", "output"),
      ],
      { id: "resnet", name: "ResNet" }
    ),
  },
  {
    id: "vit",
    name: "ViT",
    subtitle: "Patch embeddings into multi-head attention.",
    graph: makeGraph(
      [
        makeNode("input", { id: "input", position: { x: 60, y: 150 }, params: { shape: [null, 196] } }),
        makeNode("embedding", {
          id: "embed",
          position: { x: 260, y: 140 },
          params: { num_embeddings: 4096, embedding_dim: 768 },
        }),
        makeNode("multi_head_attention", {
          id: "mha",
          position: { x: 520, y: 135 },
          params: { embed_dim: 768, num_heads: 12, dropout: 0, bias: true },
        }),
        makeNode("layer_norm", { id: "norm", position: { x: 780, y: 150 }, params: { normalized_shape: [768], eps: 1e-5 } }),
        makeNode("output", { id: "output", position: { x: 980, y: 160 } }),
      ],
      [
        makeEdge("input", "embed"),
        makeEdge("embed", "mha", "out", "query"),
        makeEdge("embed", "mha", "out", "key"),
        makeEdge("embed", "mha", "out", "value"),
        makeEdge("mha", "norm"),
        makeEdge("norm", "output"),
      ],
      { id: "vit", name: "ViT" }
    ),
  },
  {
    id: "bert",
    name: "BERT",
    subtitle: "Token embedding and transformer block.",
    graph: makeGraph(
      [
        makeNode("input", { id: "input", position: { x: 60, y: 150 }, params: { shape: [null, 128] } }),
        makeNode("embedding", {
          id: "embed",
          position: { x: 260, y: 140 },
          params: { num_embeddings: 30522, embedding_dim: 768 },
        }),
        makeNode("multi_head_attention", {
          id: "mha",
          position: { x: 520, y: 135 },
          params: { embed_dim: 768, num_heads: 12, dropout: 0.1, bias: true },
        }),
        makeNode("add", { id: "add", position: { x: 770, y: 150 } }),
        makeNode("layer_norm", { id: "norm", position: { x: 960, y: 150 }, params: { normalized_shape: [768], eps: 1e-5 } }),
        makeNode("output", { id: "output", position: { x: 1160, y: 160 } }),
      ],
      [
        makeEdge("input", "embed"),
        makeEdge("embed", "mha", "out", "query"),
        makeEdge("embed", "mha", "out", "key"),
        makeEdge("embed", "mha", "out", "value"),
        makeEdge("embed", "add", "out", "a"),
        makeEdge("mha", "add", "out", "b"),
        makeEdge("add", "norm"),
        makeEdge("norm", "output"),
      ],
      { id: "bert", name: "BERT" }
    ),
  },
  {
    id: "unet",
    name: "UNet",
    subtitle: "Downsample, upsample, and fuse the skip path.",
    graph: makeGraph(
      [
        makeNode("input", { id: "input", position: { x: 60, y: 150 }, params: { shape: [null, 3, 256, 256] } }),
        makeNode("conv2d", {
          id: "enc",
          position: { x: 250, y: 140 },
          params: { in_channels: 3, out_channels: 16, kernel_size: 3, stride: 1, padding: 1, bias: true },
        }),
        makeNode("max_pool2d", {
          id: "pool",
          position: { x: 440, y: 140 },
          params: { kernel_size: 2, stride: 2, padding: 0 },
        }),
        makeNode("conv2d", {
          id: "bottleneck",
          position: { x: 640, y: 140 },
          params: { in_channels: 16, out_channels: 32, kernel_size: 3, stride: 1, padding: 1, bias: true },
        }),
        makeNode("conv_transpose2d", {
          id: "up",
          position: { x: 840, y: 140 },
          params: { in_channels: 32, out_channels: 16, kernel_size: 2, stride: 2, padding: 0, bias: true },
        }),
        makeNode("concat", { id: "concat", position: { x: 1040, y: 150 }, params: { dim: 1 } }),
        makeNode("conv2d", {
          id: "head",
          position: { x: 1240, y: 140 },
          params: { in_channels: 32, out_channels: 16, kernel_size: 3, stride: 1, padding: 1, bias: true },
        }),
        makeNode("output", { id: "output", position: { x: 1440, y: 160 } }),
      ],
      [
        makeEdge("input", "enc"),
        makeEdge("enc", "pool"),
        makeEdge("pool", "bottleneck"),
        makeEdge("bottleneck", "up"),
        makeEdge("enc", "concat", "out", "a"),
        makeEdge("up", "concat", "out", "b"),
        makeEdge("concat", "head"),
        makeEdge("head", "output"),
      ],
      { id: "unet", name: "UNet" }
    ),
  },
];

export function getExampleGraph(id: ExampleGraphSpec["id"]): ExampleGraphSpec {
  const example = EXAMPLE_GRAPHS.find((item) => item.id === id);
  if (!example) {
    throw new Error(`Unknown example graph: ${id}`);
  }
  return example;
}
