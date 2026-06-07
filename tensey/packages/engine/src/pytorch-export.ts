import type { IRGraph, IRNode, IREdge, ParamValue } from "./ir.js";

export interface PyTorchExportResult {
  className: string;
  code: string;
  warnings: string[];
}

type VarMap = Map<string, string>;

const RESERVED_NAMES = new Set([
  "class",
  "def",
  "return",
  "import",
  "from",
  "pass",
  "self",
  "input",
  "output",
  "lambda",
  "global",
  "nonlocal",
  "for",
  "while",
  "if",
  "else",
  "elif",
  "try",
  "except",
  "finally",
  "with",
  "as",
  "assert",
  "break",
  "continue",
  "del",
  "raise",
  "yield",
  "True",
  "False",
  "None",
]);

function sanitizeIdentifier(value: string, fallback: string): string {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+/, "")
    .replace(/_+$/, "");
  const base = cleaned.length > 0 ? cleaned : fallback;
  const normalized = /^[a-zA-Z_]/.test(base) ? base : `${fallback}_${base}`;
  return RESERVED_NAMES.has(normalized) ? `${normalized}_var` : normalized;
}

function toPascalCase(value: string): string {
  const parts = value
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const name = parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
  return name.length > 0 ? name : "TenseyModel";
}

function toPythonLiteral(value: unknown): string {
  if (value === null) return "None";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "float('nan')";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => toPythonLiteral(item)).join(", ")}]`;
  return JSON.stringify(value);
}

function toPythonTuple(value: unknown[]): string {
  if (value.length === 0) return "()";
  if (value.length === 1) return `(${toPythonLiteral(value[0])},)`;
  return `(${value.map((item) => toPythonLiteral(item)).join(", ")})`;
}

function topologicalOrder(graph: IRGraph): { order: IRNode[]; hasCycle: boolean } {
  const nodeIndex = new Map(graph.nodes.map((node, index) => [node.id, index]));
  const inDegree = new Map<string, number>(graph.nodes.map((node) => [node.id, 0]));
  const outgoing = new Map<string, string[]>(graph.nodes.map((node) => [node.id, []]));

  for (const edge of graph.edges) {
    if (!inDegree.has(edge.sourceNodeId) || !inDegree.has(edge.targetNodeId)) continue;
    outgoing.get(edge.sourceNodeId)!.push(edge.targetNodeId);
    inDegree.set(edge.targetNodeId, (inDegree.get(edge.targetNodeId) ?? 0) + 1);
  }

  const queue = graph.nodes
    .filter((node) => (inDegree.get(node.id) ?? 0) === 0)
    .sort((a, b) => (nodeIndex.get(a.id) ?? 0) - (nodeIndex.get(b.id) ?? 0))
    .map((node) => node.id);

  const order: IRNode[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = graph.nodes.find((candidate) => candidate.id === id);
    if (node) order.push(node);

    const next = (outgoing.get(id) ?? []).slice().sort((a, b) => (nodeIndex.get(a) ?? 0) - (nodeIndex.get(b) ?? 0));
    for (const neighbor of next) {
      const degree = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, degree);
      if (degree === 0) queue.push(neighbor);
    }
  }

  return { order, hasCycle: order.length !== graph.nodes.length };
}

function inputArgNames(order: IRNode[]): Map<string, string> {
  const inputNodes = order.filter((node) => node.opType === "input");
  const names = new Map<string, string>();

  inputNodes.forEach((node, index) => {
    const name = index === 0 ? "x" : `x${index + 1}`;
    names.set(node.id, name);
  });

  return names;
}

function nodeVarBase(node: IRNode): string {
  return sanitizeIdentifier(`node_${node.id}`, `node_${node.id}`);
}

function edgeLookup(graph: IRGraph): Map<string, IREdge> {
  return new Map(graph.edges.map((edge) => [`${edge.targetNodeId}:${edge.targetPort}`, edge] as const));
}

function formatArgs(params: Record<string, ParamValue>, keys: string[]): string {
  return keys
    .filter((key) => Object.prototype.hasOwnProperty.call(params, key))
    .map((key) => `${key}=${toPythonLiteral(params[key])}`)
    .join(", ");
}

function moduleLine(attr: string, ctor: string, params: string): string {
  return params.length > 0
    ? `self.${attr} = ${ctor}(${params})`
    : `self.${attr} = ${ctor}()`;
}

function forwardIndent(line: string): string {
  return `        ${line}`;
}

function emitModuleAndForward(node: IRNode, inputVars: Map<string, string>, nodeOutputs: VarMap): {
  moduleLines: string[];
  forwardLines: string[];
  warnings: string[];
} {
  const base = nodeVarBase(node);
  const moduleLines: string[] = [];
  const forwardLines: string[] = [];
  const warnings: string[] = [];
  const params = node.params;

  const inputVar = (port: string): string => {
    const edge = inputVars.get(port);
    if (!edge) {
      throw new Error(`Missing source variable for ${node.opType} node "${node.id}" port "${port}"`);
    }
    return edge;
  };

  const outputVar = (port = "out"): string => {
    const name = node.outputs.length > 1 ? `${base}_${port}` : base;
    nodeOutputs.set(`${node.id}:${port}`, name);
    return name;
  };

  switch (node.opType) {
    case "linear": {
      moduleLines.push(moduleLine(base, "nn.Linear", formatArgs(params, ["in_features", "out_features", "bias"])));
      forwardLines.push(forwardIndent(`${outputVar()} = self.${base}(${inputVar("in")})`));
      break;
    }
    case "conv1d": {
      moduleLines.push(moduleLine(base, "nn.Conv1d", formatArgs(params, ["in_channels", "out_channels", "kernel_size", "stride", "padding", "bias"])));
      forwardLines.push(forwardIndent(`${outputVar()} = self.${base}(${inputVar("in")})`));
      break;
    }
    case "conv2d": {
      moduleLines.push(moduleLine(base, "nn.Conv2d", formatArgs(params, ["in_channels", "out_channels", "kernel_size", "stride", "padding", "bias"])));
      forwardLines.push(forwardIndent(`${outputVar()} = self.${base}(${inputVar("in")})`));
      break;
    }
    case "conv3d": {
      moduleLines.push(moduleLine(base, "nn.Conv3d", formatArgs(params, ["in_channels", "out_channels", "kernel_size", "stride", "padding", "bias"])));
      forwardLines.push(forwardIndent(`${outputVar()} = self.${base}(${inputVar("in")})`));
      break;
    }
    case "conv_transpose1d": {
      moduleLines.push(moduleLine(base, "nn.ConvTranspose1d", formatArgs(params, ["in_channels", "out_channels", "kernel_size", "stride", "padding", "bias"])));
      forwardLines.push(forwardIndent(`${outputVar()} = self.${base}(${inputVar("in")})`));
      break;
    }
    case "conv_transpose2d": {
      moduleLines.push(moduleLine(base, "nn.ConvTranspose2d", formatArgs(params, ["in_channels", "out_channels", "kernel_size", "stride", "padding", "bias"])));
      forwardLines.push(forwardIndent(`${outputVar()} = self.${base}(${inputVar("in")})`));
      break;
    }
    case "conv_transpose3d": {
      moduleLines.push(moduleLine(base, "nn.ConvTranspose3d", formatArgs(params, ["in_channels", "out_channels", "kernel_size", "stride", "padding", "bias"])));
      forwardLines.push(forwardIndent(`${outputVar()} = self.${base}(${inputVar("in")})`));
      break;
    }
    case "depthwise_conv2d": {
      const channels = typeof params.channels === "number" ? params.channels : 1;
      moduleLines.push(moduleLine(base, "nn.Conv2d", [
        `in_channels=${toPythonLiteral(channels)}`,
        `out_channels=${toPythonLiteral(channels)}`,
        `kernel_size=${toPythonLiteral(params.kernel_size ?? 3)}`,
        `stride=${toPythonLiteral(params.stride ?? 1)}`,
        `padding=${toPythonLiteral(params.padding ?? 1)}`,
        `groups=${toPythonLiteral(channels)}`,
      ].join(", ")));
      forwardLines.push(forwardIndent(`${outputVar()} = self.${base}(${inputVar("in")})`));
      break;
    }
    case "separable_conv2d": {
      moduleLines.push(moduleLine(`${base}_depthwise`, "nn.Conv2d", [
        `in_channels=${toPythonLiteral(params.in_channels)}`,
        `out_channels=${toPythonLiteral(params.in_channels)}`,
        `kernel_size=${toPythonLiteral(params.kernel_size ?? 3)}`,
        `stride=${toPythonLiteral(params.stride ?? 1)}`,
        `padding=${toPythonLiteral(params.padding ?? 1)}`,
        `groups=${toPythonLiteral(params.in_channels)}`,
        `bias=${toPythonLiteral(params.bias ?? true)}`,
      ].join(", ")));
      moduleLines.push(moduleLine(`${base}_pointwise`, "nn.Conv2d", [
        `in_channels=${toPythonLiteral(params.in_channels)}`,
        `out_channels=${toPythonLiteral(params.out_channels)}`,
        `kernel_size=1`,
        `bias=${toPythonLiteral(params.bias ?? true)}`,
      ].join(", ")));
      const input = inputVar("in");
      const out = outputVar();
      forwardLines.push(forwardIndent(`${out} = self.${base}_depthwise(${input})`));
      forwardLines.push(forwardIndent(`${out} = self.${base}_pointwise(${out})`));
      break;
    }
    case "embedding": {
      moduleLines.push(moduleLine(base, "nn.Embedding", formatArgs(params, ["num_embeddings", "embedding_dim"])));
      forwardLines.push(forwardIndent(`${outputVar()} = self.${base}(${inputVar("in")})`));
      break;
    }
    case "batch_norm1d":
    case "batch_norm2d":
    case "batch_norm3d": {
      const ctor = node.opType === "batch_norm1d" ? "nn.BatchNorm1d" : node.opType === "batch_norm2d" ? "nn.BatchNorm2d" : "nn.BatchNorm3d";
      moduleLines.push(moduleLine(base, ctor, formatArgs(params, ["num_features", "eps", "momentum"])));
      forwardLines.push(forwardIndent(`${outputVar()} = self.${base}(${inputVar("in")})`));
      break;
    }
    case "group_norm": {
      moduleLines.push(moduleLine(base, "nn.GroupNorm", formatArgs(params, ["num_groups", "num_channels", "eps"])));
      forwardLines.push(forwardIndent(`${outputVar()} = self.${base}(${inputVar("in")})`));
      break;
    }
    case "instance_norm2d": {
      moduleLines.push(moduleLine(base, "nn.InstanceNorm2d", formatArgs(params, ["num_features", "eps"])));
      forwardLines.push(forwardIndent(`${outputVar()} = self.${base}(${inputVar("in")})`));
      break;
    }
    case "layer_norm": {
      moduleLines.push(moduleLine(base, "nn.LayerNorm", formatArgs(params, ["normalized_shape", "eps"])));
      forwardLines.push(forwardIndent(`${outputVar()} = self.${base}(${inputVar("in")})`));
      break;
    }
    case "rms_norm": {
      moduleLines.push(moduleLine(base, "nn.RMSNorm", formatArgs(params, ["normalized_shape", "eps"])));
      forwardLines.push(forwardIndent(`${outputVar()} = self.${base}(${inputVar("in")})`));
      warnings.push("nn.RMSNorm requires a PyTorch version that provides RMSNorm.");
      break;
    }
    case "max_pool1d":
    case "max_pool2d":
    case "max_pool3d":
    case "avg_pool1d":
    case "avg_pool2d":
    case "avg_pool3d": {
      const fn = node.opType.startsWith("max") ? "nn.MaxPool" : "nn.AvgPool";
      const dims = node.opType.endsWith("1d") ? "1d" : node.opType.endsWith("2d") ? "2d" : "3d";
      moduleLines.push(moduleLine(base, `${fn}${dims}`, formatArgs(params, ["kernel_size", "stride", "padding"])));
      forwardLines.push(forwardIndent(`${outputVar()} = self.${base}(${inputVar("in")})`));
      break;
    }
    case "adaptive_avg_pool2d": {
      moduleLines.push(moduleLine(base, "nn.AdaptiveAvgPool2d", formatArgs(params, ["output_size"])));
      forwardLines.push(forwardIndent(`${outputVar()} = self.${base}(${inputVar("in")})`));
      break;
    }
    case "adaptive_max_pool2d": {
      moduleLines.push(moduleLine(base, "nn.AdaptiveMaxPool2d", formatArgs(params, ["output_size"])));
      forwardLines.push(forwardIndent(`${outputVar()} = self.${base}(${inputVar("in")})`));
      break;
    }
    case "flatten": {
      const startDim = params.start_dim ?? 1;
      const endDim = params.end_dim ?? -1;
      forwardLines.push(forwardIndent(`${outputVar()} = ${inputVar("in")}.flatten(start_dim=${toPythonLiteral(startDim)}, end_dim=${toPythonLiteral(endDim)})`));
      break;
    }
    case "reshape": {
      const shape = Array.isArray(params.shape) ? params.shape.map((dim) => (dim === null ? -1 : dim)) : [];
      forwardLines.push(forwardIndent(`${outputVar()} = ${inputVar("in")}.reshape(${toPythonTuple(shape)})`));
      break;
    }
    case "permute": {
      forwardLines.push(forwardIndent(`${outputVar()} = ${inputVar("in")}.permute(${toPythonTuple(Array.isArray(params.dims) ? params.dims : [])})`));
      break;
    }
    case "unsqueeze": {
      forwardLines.push(forwardIndent(`${outputVar()} = ${inputVar("in")}.unsqueeze(dim=${toPythonLiteral(params.dim ?? 0)})`));
      break;
    }
    case "squeeze": {
      forwardLines.push(forwardIndent(`${outputVar()} = ${inputVar("in")}.squeeze(dim=${toPythonLiteral(params.dim ?? 0)})`));
      break;
    }
    case "transpose": {
      forwardLines.push(forwardIndent(`${outputVar()} = ${inputVar("in")}.transpose(${toPythonLiteral(params.dim0 ?? 0)}, ${toPythonLiteral(params.dim1 ?? 1)})`));
      break;
    }
    case "pad": {
      const pad = Array.isArray(params.pad) ? params.pad : [0, 0, 0, 0];
      const mode = typeof params.mode === "string" ? params.mode : "constant";
      const value = params.value ?? 0;
      forwardLines.push(forwardIndent(`${outputVar()} = F.pad(${inputVar("in")}, pad=${toPythonTuple(pad)}, mode=${toPythonLiteral(mode)}, value=${toPythonLiteral(value)})`));
      break;
    }
    case "upsample": {
      const mode = typeof params.mode === "string" ? params.mode : "nearest";
      forwardLines.push(forwardIndent(`${outputVar()} = F.interpolate(${inputVar("in")}, scale_factor=${toPythonLiteral(params.scale_factor ?? 2)}, mode=${toPythonLiteral(mode)})`));
      break;
    }
    case "relu":
      forwardLines.push(forwardIndent(`${outputVar()} = F.relu(${inputVar("in")}, inplace=${toPythonLiteral(params.inplace ?? false)})`));
      break;
    case "gelu":
      forwardLines.push(forwardIndent(`${outputVar()} = F.gelu(${inputVar("in")})`));
      break;
    case "dropout":
      forwardLines.push(forwardIndent(`${outputVar()} = F.dropout(${inputVar("in")}, p=${toPythonLiteral(params.p ?? 0.5)}, training=self.training, inplace=${toPythonLiteral(params.inplace ?? false)})`));
      break;
    case "sigmoid":
      forwardLines.push(forwardIndent(`${outputVar()} = torch.sigmoid(${inputVar("in")})`));
      break;
    case "tanh":
      forwardLines.push(forwardIndent(`${outputVar()} = torch.tanh(${inputVar("in")})`));
      break;
    case "leaky_relu":
      forwardLines.push(forwardIndent(`${outputVar()} = F.leaky_relu(${inputVar("in")}, negative_slope=${toPythonLiteral(params.negative_slope ?? 0.01)})`));
      break;
    case "softmax":
      forwardLines.push(forwardIndent(`${outputVar()} = F.softmax(${inputVar("in")}, dim=${toPythonLiteral(params.dim ?? -1)})`));
      break;
    case "log_softmax":
      forwardLines.push(forwardIndent(`${outputVar()} = F.log_softmax(${inputVar("in")}, dim=${toPythonLiteral(params.dim ?? -1)})`));
      break;
    case "silu":
      forwardLines.push(forwardIndent(`${outputVar()} = F.silu(${inputVar("in")})`));
      break;
    case "elu":
      forwardLines.push(forwardIndent(`${outputVar()} = F.elu(${inputVar("in")}, alpha=${toPythonLiteral(params.alpha ?? 1.0)})`));
      break;
    case "selu":
      forwardLines.push(forwardIndent(`${outputVar()} = F.selu(${inputVar("in")})`));
      break;
    case "prelu": {
      moduleLines.push(moduleLine(base, "nn.PReLU", formatArgs(params, ["num_parameters", "init"])));
      forwardLines.push(forwardIndent(`${outputVar()} = self.${base}(${inputVar("in")})`));
      break;
    }
    case "mish":
      forwardLines.push(forwardIndent(`${outputVar()} = F.mish(${inputVar("in")})`));
      break;
    case "hard_swish":
      forwardLines.push(forwardIndent(`${outputVar()} = F.hardswish(${inputVar("in")})`));
      break;
    case "softplus":
      forwardLines.push(forwardIndent(`${outputVar()} = F.softplus(${inputVar("in")}, beta=${toPythonLiteral(params.beta ?? 1)}, threshold=${toPythonLiteral(params.threshold ?? 20)})`));
      break;
    case "add": {
      const a = inputVar("a");
      const b = inputVar("b");
      forwardLines.push(forwardIndent(`${outputVar()} = ${a} + ${b}`));
      break;
    }
    case "subtract": {
      const a = inputVar("a");
      const b = inputVar("b");
      forwardLines.push(forwardIndent(`${outputVar()} = ${a} - ${b}`));
      break;
    }
    case "multiply": {
      const a = inputVar("a");
      const b = inputVar("b");
      forwardLines.push(forwardIndent(`${outputVar()} = ${a} * ${b}`));
      break;
    }
    case "concat": {
      const a = inputVar("a");
      const b = inputVar("b");
      forwardLines.push(forwardIndent(`${outputVar()} = torch.cat([${a}, ${b}], dim=${toPythonLiteral(params.dim ?? 1)})`));
      break;
    }
    case "matmul": {
      const a = inputVar("a");
      const b = inputVar("b");
      forwardLines.push(forwardIndent(`${outputVar()} = torch.matmul(${a}, ${b})`));
      break;
    }
    case "multi_head_attention": {
      moduleLines.push(moduleLine(base, "nn.MultiheadAttention", [
        `embed_dim=${toPythonLiteral(params.embed_dim)}`,
        `num_heads=${toPythonLiteral(params.num_heads)}`,
        `dropout=${toPythonLiteral(params.dropout ?? 0.0)}`,
        `bias=${toPythonLiteral(params.bias ?? true)}`,
        `batch_first=True`,
      ].join(", ")));
      const query = inputVar("query");
      const key = inputVar("key");
      const value = inputVar("value");
      forwardLines.push(forwardIndent(`${outputVar()} = self.${base}(${query}, ${key}, ${value}, need_weights=False)[0]`));
      break;
    }
    case "rnn": {
      moduleLines.push(moduleLine(base, "nn.RNN", [
        `input_size=${toPythonLiteral(params.input_size)}`,
        `hidden_size=${toPythonLiteral(params.hidden_size)}`,
        `num_layers=${toPythonLiteral(params.num_layers ?? 1)}`,
        `bias=${toPythonLiteral(params.bias ?? true)}`,
        `batch_first=${toPythonLiteral(params.batch_first ?? true)}`,
      ].join(", ")));
      const out = outputVar("out");
      const hidden = outputVar("h_n");
      forwardLines.push(forwardIndent(`${out}, ${hidden} = self.${base}(${inputVar("in")})`));
      break;
    }
    case "lstm": {
      moduleLines.push(moduleLine(base, "nn.LSTM", [
        `input_size=${toPythonLiteral(params.input_size)}`,
        `hidden_size=${toPythonLiteral(params.hidden_size)}`,
        `num_layers=${toPythonLiteral(params.num_layers ?? 1)}`,
        `bias=${toPythonLiteral(params.bias ?? true)}`,
        `batch_first=${toPythonLiteral(params.batch_first ?? true)}`,
      ].join(", ")));
      const out = outputVar("out");
      const hidden = outputVar("h_n");
      const cell = outputVar("c_n");
      forwardLines.push(forwardIndent(`${out}, (${hidden}, ${cell}) = self.${base}(${inputVar("in")})`));
      break;
    }
    case "gru": {
      moduleLines.push(moduleLine(base, "nn.GRU", [
        `input_size=${toPythonLiteral(params.input_size)}`,
        `hidden_size=${toPythonLiteral(params.hidden_size)}`,
        `num_layers=${toPythonLiteral(params.num_layers ?? 1)}`,
        `bias=${toPythonLiteral(params.bias ?? true)}`,
        `batch_first=${toPythonLiteral(params.batch_first ?? true)}`,
      ].join(", ")));
      const out = outputVar("out");
      const hidden = outputVar("h_n");
      forwardLines.push(forwardIndent(`${out}, ${hidden} = self.${base}(${inputVar("in")})`));
      break;
    }
    case "transformer_encoder": {
      moduleLines.push(forwardIndent(`# Transformer encoder layer ${base}`));
      moduleLines.push(moduleLine(`${base}_layer`, "nn.TransformerEncoderLayer", [
        `d_model=${toPythonLiteral(params.d_model)}`,
        `nhead=${toPythonLiteral(params.nhead)}`,
        `dim_feedforward=${toPythonLiteral(params.dim_feedforward ?? 2048)}`,
        `dropout=${toPythonLiteral(params.dropout ?? 0.1)}`,
        `batch_first=True`,
      ].join(", ")));
      moduleLines.push(moduleLine(base, "nn.TransformerEncoder", [
        `encoder_layer=self.${base}_layer`,
        `num_layers=${toPythonLiteral(params.num_layers ?? 6)}`,
      ].join(", ")));
      forwardLines.push(forwardIndent(`${outputVar()} = self.${base}(${inputVar("in")})`));
      break;
    }
    case "transformer_decoder": {
      moduleLines.push(forwardIndent(`# Transformer decoder layer ${base}`));
      moduleLines.push(moduleLine(`${base}_layer`, "nn.TransformerDecoderLayer", [
        `d_model=${toPythonLiteral(params.d_model)}`,
        `nhead=${toPythonLiteral(params.nhead)}`,
        `dim_feedforward=${toPythonLiteral(params.dim_feedforward ?? 2048)}`,
        `dropout=${toPythonLiteral(params.dropout ?? 0.1)}`,
        `batch_first=True`,
      ].join(", ")));
      moduleLines.push(moduleLine(base, "nn.TransformerDecoder", [
        `decoder_layer=self.${base}_layer`,
        `num_layers=${toPythonLiteral(params.num_layers ?? 6)}`,
      ].join(", ")));
      forwardLines.push(forwardIndent(`${outputVar()} = self.${base}(${inputVar("target")}, ${inputVar("memory")})`));
      break;
    }
    case "input":
    case "output":
      break;
    default:
      warnings.push(`Unsupported opType "${node.opType}" was exported as an identity mapping.`);
      forwardLines.push(forwardIndent(`${outputVar()} = ${inputVar("in")}`));
      break;
  }

  return { moduleLines, forwardLines, warnings };
}

export function exportGraphToPyTorch(graph: IRGraph, className = "TenseyModel"): PyTorchExportResult {
  const warnings: string[] = [];
  const { order, hasCycle } = topologicalOrder(graph);
  if (hasCycle) {
    throw new Error("Cannot export a graph with cycles.");
  }

  const moduleName = sanitizeIdentifier(toPascalCase(className), "TenseyModel");
  const inputNames = inputArgNames(order);
  const sources = edgeLookup(graph);
  const nodeOutputs: VarMap = new Map();
  const moduleLines: string[] = [];
  const forwardLines: string[] = [];

  for (const node of order) {
    if (node.opType === "input") {
      const argName = inputNames.get(node.id) ?? "x";
      node.outputs.forEach((port, index) => {
        const name = node.outputs.length > 1 ? `${argName}_${port.name}` : argName;
        nodeOutputs.set(`${node.id}:${port.name ?? `out_${index}`}`, name);
      });
      continue;
    }

    const inputVars = new Map<string, string>();
    for (const port of node.inputs) {
      const edge = sources.get(`${node.id}:${port.name}`);
      if (!edge) {
        if (node.opType === "output") continue;
        throw new Error(`Missing edge for node "${node.id}" port "${port.name}"`);
      }
      const sourceVar = nodeOutputs.get(`${edge.sourceNodeId}:${edge.sourcePort}`);
      if (!sourceVar) {
        throw new Error(`No exported variable for source "${edge.sourceNodeId}:${edge.sourcePort}"`);
      }
      inputVars.set(port.name, sourceVar);
    }

    if (node.opType === "output") {
      const source = inputVars.get("in");
      if (!source) {
        throw new Error(`Output node "${node.id}" is not connected`);
      }
      nodeOutputs.set(node.id, source);
      continue;
    }

    const result = emitModuleAndForward(node, inputVars, nodeOutputs);
    moduleLines.push(...result.moduleLines);
    forwardLines.push(...result.forwardLines);
    warnings.push(...result.warnings);
  }

  const outputNodes = order.filter((node) => node.opType === "output");
  const returnVars = outputNodes.length > 0
    ? outputNodes.map((node) => nodeOutputs.get(node.id)).filter((value): value is string => Boolean(value))
    : order
        .filter((node) => node.opType !== "input" && node.opType !== "output")
        .map((node) => {
          const ports = node.outputs;
          if (ports.length === 0) {
            return nodeOutputs.get(node.id) ?? null;
          }
          return nodeOutputs.get(`${node.id}:${ports[0]?.name ?? "out"}`) ?? null;
        })
        .filter((value): value is string => Boolean(value));

  if (returnVars.length === 0) {
    throw new Error("Could not determine graph outputs for export.");
  }

  const uniqueWarnings = Array.from(new Set(warnings));
  const lines = [
    "import torch",
    "import torch.nn as nn",
    "import torch.nn.functional as F",
    "",
    "",
    `class ${moduleName}(nn.Module):`,
    "    def __init__(self):",
    "        super().__init__()",
    ...moduleLines.map((line) => `        ${line}`),
    "",
    inputNames.size > 0
      ? `    def forward(self, ${Array.from(inputNames.values()).join(", ")}):`
      : "    def forward(self):",
    ...forwardLines,
    ...(returnVars.length === 1
      ? [forwardIndent(`return ${returnVars[0]}`)]
      : [forwardIndent(`return ${returnVars.join(", ")}`)]),
  ];

  if (uniqueWarnings.length > 0) {
    lines.splice(4, 0, ...uniqueWarnings.map((warning) => `# ${warning}`));
  }

  return {
    className: moduleName,
    code: lines.join("\n"),
    warnings: uniqueWarnings,
  };
}
