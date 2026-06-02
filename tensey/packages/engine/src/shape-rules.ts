import type { Shape, Dim, ParamValue } from "./ir.js";

/**
 * Result of a shape inference attempt for one node.
 * outputShapes: map of portName → inferred Shape
 * error: human-readable message if inference failed
 */
export interface ShapeInferenceResult {
  outputShapes: Record<string, Shape>;
  error?: string;
}

/** Convenience: pull a number param, throw if missing or wrong type */
function numParam(params: Record<string, ParamValue>, key: string): number {
  const v = params[key];
  if (typeof v !== "number") throw new Error(`param "${key}" must be a number, got ${JSON.stringify(v)}`);
  return v;
}

function numParamOr(params: Record<string, ParamValue>, key: string, fallback: number): number {
  const v = params[key];
  return typeof v === "number" ? v : fallback;
}

/** floor((dim + 2*padding - kernel) / stride) + 1, null propagates */
function convOutputDim(dim: Dim, kernel: number, stride: number, padding: number): Dim {
  if (dim === null) return null;
  return Math.floor((dim + 2 * padding - kernel) / stride) + 1;
}

function convTransposeOutputDim(dim: Dim, kernel: number, stride: number, padding: number): Dim {
  if (dim === null) return null;
  return (dim - 1) * stride - 2 * padding + kernel;
}

// ---------------------------------------------------------------------------
// Shape inference functions — one per opType
// ---------------------------------------------------------------------------

type InferFn = (
  inputShapes: Record<string, Shape | null>,
  params: Record<string, ParamValue>
) => ShapeInferenceResult;

function inferPassthrough(inputShapes: Record<string, Shape | null>): ShapeInferenceResult {
  const shape = inputShapes["in"] ?? null;
  if (!shape) return { outputShapes: noOutput(), error: "Input shape not yet available" };
  return { outputShapes: { out: shape } };
}

function noOutput(): Record<string, Shape> {
  return {};
}

const INFER: Record<string, InferFn> = {
  // --- IO ---
  input(_inputShapes, params) {
    const raw = params["shape"];
    if (!Array.isArray(raw)) return { outputShapes: noOutput(), error: `"shape" param must be an array` };
    const shape: Shape = (raw as number[]).map((d) => (d === null || d === 0 ? null : d));
    return { outputShapes: { out: shape } };
  },

  output(inputShapes) {
    const shape = inputShapes["in"] ?? null;
    if (!shape) return { outputShapes: noOutput(), error: "Input shape not yet available" };
    return { outputShapes: {} };
  },

  // --- Linear ---
  linear(inputShapes, params) {
    const inShape = inputShapes["in"];
    if (!inShape) return { outputShapes: noOutput(), error: "Input shape not yet available" };
    if (inShape.length < 1) return { outputShapes: noOutput(), error: "Input must be at least 1-D" };

    const inFeatures = numParam(params, "in_features");
    const outFeatures = numParam(params, "out_features");
    const lastDim = inShape[inShape.length - 1];

    if (lastDim !== null && lastDim !== inFeatures) {
      return {
        outputShapes: {},
        error: `Shape mismatch: Linear expects in_features=${inFeatures} but got last dim=${lastDim}`,
      };
    }

    const outShape: Shape = [...inShape.slice(0, -1), outFeatures];
    return { outputShapes: { out: outShape } };
  },

  embedding(inputShapes, params) {
    const inShape = inputShapes["in"];
    if (!inShape) return { outputShapes: noOutput(), error: "Input shape not yet available" };
    const embDim = numParam(params, "embedding_dim");
    return { outputShapes: { out: [...inShape, embDim] } };
  },

  // --- Convolution ---
  conv2d(inputShapes, params) {
    const inShape = inputShapes["in"];
    if (!inShape) return { outputShapes: noOutput(), error: "Input shape not yet available" };
    if (inShape.length !== 4) {
      return { outputShapes: noOutput(), error: `Conv2d expects 4-D input [N,C,H,W], got ${inShape.length}-D` };
    }

    const inChannels = numParam(params, "in_channels");
    const outChannels = numParam(params, "out_channels");
    const kernelSize = numParamOr(params, "kernel_size", 3);
    const stride = numParamOr(params, "stride", 1);
    const padding = numParamOr(params, "padding", 0);

    const [n, c, h, w] = inShape;
    if (c !== null && c !== inChannels) {
      return {
        outputShapes: {},
        error: `Shape mismatch: Conv2d expects in_channels=${inChannels} but got C=${c}`,
      };
    }

    const outH = convOutputDim(h, kernelSize, stride, padding);
    const outW = convOutputDim(w, kernelSize, stride, padding);

    if (typeof outH === "number" && outH <= 0) {
      return { outputShapes: noOutput(), error: `Conv2d produces non-positive output height (${outH}). Check kernel/stride/padding.` };
    }
    if (typeof outW === "number" && outW <= 0) {
      return { outputShapes: noOutput(), error: `Conv2d produces non-positive output width (${outW}). Check kernel/stride/padding.` };
    }

    return { outputShapes: { out: [n, outChannels, outH, outW] } };
  },

  // --- Activations (shape-preserving) ---
  relu: inferPassthrough,
  gelu: inferPassthrough,
  dropout: inferPassthrough,

  // --- Normalization ---
  batch_norm2d(inputShapes, params) {
    const inShape = inputShapes["in"];
    if (!inShape) return { outputShapes: noOutput(), error: "Input shape not yet available" };
    if (inShape.length !== 4) {
      return { outputShapes: noOutput(), error: `BatchNorm2d expects 4-D input, got ${inShape.length}-D` };
    }
    const numFeatures = numParam(params, "num_features");
    const c = inShape[1];
    if (c !== null && c !== numFeatures) {
      return {
        outputShapes: {},
        error: `Shape mismatch: BatchNorm2d expects num_features=${numFeatures} but got C=${c}`,
      };
    }
    return { outputShapes: { out: [...inShape] } };
  },

  layer_norm: inferPassthrough,

  // --- Pooling ---
  max_pool2d(inputShapes, params) {
    const inShape = inputShapes["in"];
    if (!inShape) return { outputShapes: noOutput(), error: "Input shape not yet available" };
    if (inShape.length !== 4) {
      return { outputShapes: noOutput(), error: `MaxPool2d expects 4-D input, got ${inShape.length}-D` };
    }
    const kernel = numParamOr(params, "kernel_size", 2);
    const stride = numParamOr(params, "stride", kernel);
    const padding = numParamOr(params, "padding", 0);
    const [n, c, h, w] = inShape;
    return {
      outputShapes: {
        out: [n, c, convOutputDim(h, kernel, stride, padding), convOutputDim(w, kernel, stride, padding)],
      },
    };
  },

  avg_pool2d(inputShapes, params) {
    return INFER["max_pool2d"]!(inputShapes, params);
  },

  adaptive_avg_pool2d(inputShapes, params) {
    const inShape = inputShapes["in"];
    if (!inShape) return { outputShapes: noOutput(), error: "Input shape not yet available" };
    if (inShape.length !== 4) {
      return { outputShapes: noOutput(), error: `AdaptiveAvgPool2d expects 4-D input, got ${inShape.length}-D` };
    }
    const outputSize = params["output_size"];
    if (!Array.isArray(outputSize) || outputSize.length !== 2) {
      return { outputShapes: noOutput(), error: `output_size must be [H, W]` };
    }
    const [n, c] = inShape;
    const [oh, ow] = outputSize as number[];
    return { outputShapes: { out: [n, c, oh ?? null, ow ?? null] } };
  },

  // --- Reshape ---
  flatten(inputShapes, params) {
    const inShape = inputShapes["in"];
    if (!inShape) return { outputShapes: noOutput(), error: "Input shape not yet available" };
    if (inShape.length === 0) return { outputShapes: noOutput(), error: "Cannot flatten 0-D tensor" };

    const ndim = inShape.length;
    let startDim = numParamOr(params, "start_dim", 1);
    let endDim = numParamOr(params, "end_dim", -1);

    // Normalize negatives
    if (startDim < 0) startDim = ndim + startDim;
    if (endDim < 0) endDim = ndim + endDim;

    if (startDim < 0 || startDim >= ndim || endDim < 0 || endDim >= ndim || startDim > endDim) {
      return { outputShapes: noOutput(), error: `Invalid flatten dims: start=${startDim}, end=${endDim} for ${ndim}-D input` };
    }

    const prefix = inShape.slice(0, startDim);
    const toFlatten = inShape.slice(startDim, endDim + 1);
    const suffix = inShape.slice(endDim + 1);

    // If any dim in the flattened range is null, result dim is null
    const flatDim: Dim = toFlatten.some((d) => d === null)
      ? null
      : (toFlatten as number[]).reduce((a, b) => a * b, 1);

    return { outputShapes: { out: [...prefix, flatDim, ...suffix] } };
  },

  // --- Merge ---
  add(inputShapes) {
    const a = inputShapes["a"];
    const b = inputShapes["b"];
    if (!a || !b) return { outputShapes: noOutput(), error: "Both input shapes must be available" };
    if (a.length !== b.length) {
      return {
        outputShapes: {},
        error: `Add: shape rank mismatch — a is ${a.length}-D, b is ${b.length}-D`,
      };
    }
    for (let i = 0; i < a.length; i++) {
      const ad = a[i], bd = b[i];
      if (ad !== null && bd !== null && ad !== bd) {
        return {
          outputShapes: {},
          error: `Add: shape mismatch at dim ${i} — a=${ad}, b=${bd}. Inputs must be the same shape.`,
        };
      }
    }
    // Output: broadcast nulls conservatively
    const out: Shape = a.map((d, i) => (d === null || b[i] === null ? null : d));
    return { outputShapes: { out } };
  },

  concat(inputShapes, params) {
    const a = inputShapes["a"];
    const b = inputShapes["b"];
    if (!a || !b) return { outputShapes: noOutput(), error: "Both input shapes must be available" };
    if (a.length !== b.length) {
      return {
        outputShapes: {},
        error: `Concat: rank mismatch — a is ${a.length}-D, b is ${b.length}-D`,
      };
    }
    const dim = numParamOr(params, "dim", 1);
    const ndim = a.length;
    const normDim = dim < 0 ? ndim + dim : dim;
    if (normDim < 0 || normDim >= ndim) {
      return { outputShapes: noOutput(), error: `Concat: dim=${dim} out of range for ${ndim}-D input` };
    }

    const out: Shape = a.map((d, i) => {
      if (i === normDim) {
        return d === null || b[i] === null ? null : (d as number) + (b[i] as number);
      }
      if (d !== null && b[i] !== null && d !== b[i]) {
        return null; // mismatch on non-concat dim — engine will flag via diagnostic
      }
      return d ?? b[i] ?? null;
    });

    // Check non-concat dims actually match
    for (let i = 0; i < ndim; i++) {
      if (i === normDim) continue;
      const ad = a[i], bd = b[i];
      if (ad !== null && bd !== null && ad !== bd) {
        return {
          outputShapes: {},
          error: `Concat: shape mismatch at dim ${i} (non-concat axis) — a=${ad}, b=${bd}`,
        };
      }
    }

    return { outputShapes: { out } };
  },

  // --- Attention ---
  multi_head_attention(inputShapes, params) {
    const q = inputShapes["query"];
    const k = inputShapes["key"];
    const v = inputShapes["value"];
    if (!q) return { outputShapes: noOutput(), error: "query shape not yet available" };
    if (!k) return { outputShapes: noOutput(), error: "key shape not yet available" };
    if (!v) return { outputShapes: noOutput(), error: "value shape not yet available" };

    if (q.length < 2) return { outputShapes: noOutput(), error: "MultiHeadAttention expects ≥2-D inputs [*, seq, embed]" };

    const embedDim = numParam(params, "embed_dim");
    const numHeads = numParam(params, "num_heads");

    if (embedDim % numHeads !== 0) {
      return {
        outputShapes: {},
        error: `embed_dim=${embedDim} must be divisible by num_heads=${numHeads}`,
      };
    }

    const qEmbed = q[q.length - 1];
    if (qEmbed !== null && qEmbed !== embedDim) {
      return {
        outputShapes: {},
        error: `MultiHeadAttention: query last dim=${qEmbed} ≠ embed_dim=${embedDim}`,
      };
    }

    // Output shape = query shape (seq, embed_dim out)
    return { outputShapes: { out: [...q.slice(0, -1), embedDim] } };
  },

  // --- Extended ops ---
  conv1d(inputShapes, params) {
    const inShape = inputShapes["in"];
    if (!inShape) return { outputShapes: noOutput(), error: "Input shape not yet available" };
    if (inShape.length !== 3) return { outputShapes: noOutput(), error: `Conv1d expects 3-D input [N,C,L], got ${inShape.length}-D` };
    const outC = numParamOr(params, "out_channels", 128);
    const k = numParamOr(params, "kernel_size", 3);
    const s = numParamOr(params, "stride", 1);
    const p = numParamOr(params, "padding", 0);
    const [n, , l] = inShape;
    return { outputShapes: { out: [n, outC, convOutputDim(l, k, s, p)] } };
  },

  conv_transpose2d(inputShapes, params) {
    const inShape = inputShapes["in"];
    if (!inShape) return { outputShapes: noOutput(), error: "Input shape not yet available" };
    if (inShape.length !== 4) return { outputShapes: noOutput(), error: `ConvTranspose2d expects 4-D input, got ${inShape.length}-D` };
    const outC = numParamOr(params, "out_channels", 32);
    const k = numParamOr(params, "kernel_size", 2);
    const s = numParamOr(params, "stride", 2);
    const p = numParamOr(params, "padding", 0);
    const [n, , h, w] = inShape;
    const outH: Dim = h === null ? null : (h - 1) * s - 2 * p + k;
    const outW: Dim = w === null ? null : (w - 1) * s - 2 * p + k;
    return { outputShapes: { out: [n, outC, outH, outW] } };
  },

  depthwise_conv2d(inputShapes, params) {
    const inShape = inputShapes["in"];
    if (!inShape) return { outputShapes: noOutput(), error: "Input shape not yet available" };
    if (inShape.length !== 4) return { outputShapes: noOutput(), error: `DepthwiseConv2d expects 4-D input, got ${inShape.length}-D` };
    const k = numParamOr(params, "kernel_size", 3);
    const s = numParamOr(params, "stride", 1);
    const p = numParamOr(params, "padding", 1);
    const [n, c, h, w] = inShape;
    return { outputShapes: { out: [n, c, convOutputDim(h, k, s, p), convOutputDim(w, k, s, p)] } };
  },

  sigmoid: inferPassthrough,
  tanh: inferPassthrough,
  leaky_relu: inferPassthrough,
  softmax: inferPassthrough,
  log_softmax: inferPassthrough,
  silu: inferPassthrough,
  elu: inferPassthrough,
  selu: inferPassthrough,
  prelu: inferPassthrough,
  mish: inferPassthrough,
  hard_swish: inferPassthrough,
  softplus: inferPassthrough,

  batch_norm1d: inferPassthrough,
  group_norm: inferPassthrough,
  instance_norm2d: inferPassthrough,
  batch_norm3d: inferPassthrough,
  rms_norm: inferPassthrough,

  separable_conv2d(inputShapes, params) {
    return INFER["conv2d"]!(inputShapes, params);
  },

  conv3d(inputShapes, params) {
    const inShape = inputShapes["in"];
    if (!inShape) return { outputShapes: noOutput(), error: "Input shape not yet available" };
    if (inShape.length !== 5) return { outputShapes: noOutput(), error: `Conv3d expects 5-D input [N,C,D,H,W], got ${inShape.length}-D` };
    const outC = numParamOr(params, "out_channels", 32);
    const k = numParamOr(params, "kernel_size", 3);
    const s = numParamOr(params, "stride", 1);
    const p = numParamOr(params, "padding", 0);
    const [n, , d, h, w] = inShape;
    return {
      outputShapes: {
        out: [n, outC, convOutputDim(d, k, s, p), convOutputDim(h, k, s, p), convOutputDim(w, k, s, p)],
      },
    };
  },

  conv_transpose1d(inputShapes, params) {
    const inShape = inputShapes["in"];
    if (!inShape) return { outputShapes: noOutput(), error: "Input shape not yet available" };
    if (inShape.length !== 3) return { outputShapes: noOutput(), error: `ConvTranspose1d expects 3-D input [N,C,L], got ${inShape.length}-D` };
    const outC = numParamOr(params, "out_channels", 32);
    const k = numParamOr(params, "kernel_size", 2);
    const s = numParamOr(params, "stride", 2);
    const p = numParamOr(params, "padding", 0);
    const [n, , l] = inShape;
    return { outputShapes: { out: [n, outC, convTransposeOutputDim(l, k, s, p)] } };
  },

  conv_transpose3d(inputShapes, params) {
    const inShape = inputShapes["in"];
    if (!inShape) return { outputShapes: noOutput(), error: "Input shape not yet available" };
    if (inShape.length !== 5) return { outputShapes: noOutput(), error: `ConvTranspose3d expects 5-D input, got ${inShape.length}-D` };
    const outC = numParamOr(params, "out_channels", 16);
    const k = numParamOr(params, "kernel_size", 2);
    const s = numParamOr(params, "stride", 2);
    const p = numParamOr(params, "padding", 0);
    const [n, , d, h, w] = inShape;
    return {
      outputShapes: {
        out: [n, outC, convTransposeOutputDim(d, k, s, p), convTransposeOutputDim(h, k, s, p), convTransposeOutputDim(w, k, s, p)],
      },
    };
  },

  global_avg_pool2d(inputShapes) {
    const inShape = inputShapes["in"];
    if (!inShape) return { outputShapes: noOutput(), error: "Input shape not yet available" };
    if (inShape.length !== 4) return { outputShapes: noOutput(), error: `GlobalAvgPool2d expects 4-D input, got ${inShape.length}-D` };
    return { outputShapes: { out: [inShape[0], inShape[1], 1, 1] } };
  },

  max_pool1d(inputShapes, params) {
    const inShape = inputShapes["in"];
    if (!inShape) return { outputShapes: noOutput(), error: "Input shape not yet available" };
    if (inShape.length !== 3) return { outputShapes: noOutput(), error: `MaxPool1d expects 3-D input, got ${inShape.length}-D` };
    const kernel = numParamOr(params, "kernel_size", 2);
    const stride = numParamOr(params, "stride", kernel);
    const padding = numParamOr(params, "padding", 0);
    const [n, c, l] = inShape;
    return { outputShapes: { out: [n, c, convOutputDim(l, kernel, stride, padding)] } };
  },

  avg_pool1d(inputShapes, params) {
    return INFER["max_pool1d"]!(inputShapes, params);
  },

  max_pool3d(inputShapes, params) {
    const inShape = inputShapes["in"];
    if (!inShape) return { outputShapes: noOutput(), error: "Input shape not yet available" };
    if (inShape.length !== 5) return { outputShapes: noOutput(), error: `MaxPool3d expects 5-D input, got ${inShape.length}-D` };
    const kernel = numParamOr(params, "kernel_size", 2);
    const stride = numParamOr(params, "stride", kernel);
    const padding = numParamOr(params, "padding", 0);
    const [n, c, d, h, w] = inShape;
    return {
      outputShapes: {
        out: [n, c, convOutputDim(d, kernel, stride, padding), convOutputDim(h, kernel, stride, padding), convOutputDim(w, kernel, stride, padding)],
      },
    };
  },

  avg_pool3d(inputShapes, params) {
    return INFER["max_pool3d"]!(inputShapes, params);
  },

  adaptive_max_pool2d(inputShapes, params) {
    return INFER["adaptive_avg_pool2d"]!(inputShapes, params);
  },

  reshape(inputShapes, params) {
    const inShape = inputShapes["in"];
    if (!inShape) return { outputShapes: noOutput(), error: "Input shape not yet available" };
    const raw = params["shape"];
    if (!Array.isArray(raw)) return { outputShapes: noOutput(), error: `"shape" param must be an array` };
    const outShape: Shape = (raw as number[]).map((d) => (d === -1 || d === 0 ? null : d));
    return { outputShapes: { out: outShape } };
  },

  permute(inputShapes, params) {
    const inShape = inputShapes["in"];
    if (!inShape) return { outputShapes: noOutput(), error: "Input shape not yet available" };
    const dims = params["dims"];
    if (!Array.isArray(dims)) return { outputShapes: noOutput(), error: `"dims" param must be an array` };
    const outShape: Shape = (dims as number[]).map((d) => inShape[d] ?? null);
    return { outputShapes: { out: outShape } };
  },

  unsqueeze(inputShapes, params) {
    const inShape = inputShapes["in"];
    if (!inShape) return { outputShapes: noOutput(), error: "Input shape not yet available" };
    let dim = numParamOr(params, "dim", 0);
    if (dim < 0) dim = inShape.length + 1 + dim;
    const out = [...inShape];
    out.splice(dim, 0, 1);
    return { outputShapes: { out } };
  },

  squeeze(inputShapes, params) {
    const inShape = inputShapes["in"];
    if (!inShape) return { outputShapes: noOutput(), error: "Input shape not yet available" };
    let dim = numParamOr(params, "dim", 0);
    if (dim < 0) dim = inShape.length + dim;
    const out = inShape.filter((_, i) => i !== dim);
    return { outputShapes: { out } };
  },

  transpose(inputShapes, params) {
    const inShape = inputShapes["in"];
    if (!inShape) return { outputShapes: noOutput(), error: "Input shape not yet available" };
    let dim0 = numParamOr(params, "dim0", 0);
    let dim1 = numParamOr(params, "dim1", 1);
    const rank = inShape.length;
    if (dim0 < 0) dim0 = rank + dim0;
    if (dim1 < 0) dim1 = rank + dim1;
    if (dim0 < 0 || dim0 >= rank || dim1 < 0 || dim1 >= rank) {
      return { outputShapes: noOutput(), error: `Transpose dims out of range for ${rank}-D input` };
    }
    const out = [...inShape];
    [out[dim0], out[dim1]] = [out[dim1], out[dim0]];
    return { outputShapes: { out } };
  },

  pad: inferPassthrough,

  multiply(inputShapes) {
    return INFER["add"]!(inputShapes, {});
  },

  subtract(inputShapes) {
    return INFER["add"]!(inputShapes, {});
  },

  matmul(inputShapes) {
    const a = inputShapes["a"];
    const b = inputShapes["b"];
    if (!a || !b) return { outputShapes: noOutput(), error: "Both input shapes must be available" };
    if (a.length < 2 || b.length < 2) return { outputShapes: noOutput(), error: "MatMul expects inputs with rank >= 2" };
    const m = a[a.length - 2];
    const kA = a[a.length - 1];
    const kB = b[b.length - 2];
    const n = b[b.length - 1];
    if (kA !== null && kB !== null && kA !== kB) {
      return { outputShapes: noOutput(), error: `MatMul inner dims must match, got ${kA} and ${kB}` };
    }
    const batch = a.length >= b.length ? a.slice(0, -2) : b.slice(0, -2);
    return { outputShapes: { out: [...batch, m, n] } };
  },

  rnn(inputShapes, params) {
    return INFER["gru"]!(inputShapes, params);
  },

  lstm(inputShapes, params) {
    const inShape = inputShapes["in"];
    if (!inShape) return { outputShapes: noOutput(), error: "Input shape not yet available" };
    const hiddenSize = numParamOr(params, "hidden_size", 512);
    const numLayers = numParamOr(params, "num_layers", 1);
    const batchFirst = params["batch_first"] !== false;
    // batch_first=true: [batch, seq, features] → out: [batch, seq, hidden], h_n/c_n: [num_layers, batch, hidden]
    if (batchFirst && inShape.length === 3) {
      const [b, seq] = inShape;
      return { outputShapes: { out: [b, seq, hiddenSize], h_n: [numLayers, b, hiddenSize], c_n: [numLayers, b, hiddenSize] } };
    }
    return { outputShapes: { out: [...inShape.slice(0, -1), hiddenSize], h_n: [numLayers, null, hiddenSize], c_n: [numLayers, null, hiddenSize] } };
  },

  gru(inputShapes, params) {
    const inShape = inputShapes["in"];
    if (!inShape) return { outputShapes: noOutput(), error: "Input shape not yet available" };
    const hiddenSize = numParamOr(params, "hidden_size", 512);
    const numLayers = numParamOr(params, "num_layers", 1);
    const batchFirst = params["batch_first"] !== false;
    if (batchFirst && inShape.length === 3) {
      const [b, seq] = inShape;
      return { outputShapes: { out: [b, seq, hiddenSize], h_n: [numLayers, b, hiddenSize] } };
    }
    return { outputShapes: { out: [...inShape.slice(0, -1), hiddenSize], h_n: [numLayers, null, hiddenSize] } };
  },

  upsample(inputShapes, params) {
    const inShape = inputShapes["in"];
    if (!inShape) return { outputShapes: noOutput(), error: "Input shape not yet available" };
    if (inShape.length !== 4) return { outputShapes: noOutput(), error: `Upsample expects 4-D input, got ${inShape.length}-D` };
    const scale = numParamOr(params, "scale_factor", 2);
    const [n, c, h, w] = inShape;
    const outH: Dim = h === null ? null : Math.floor(h * scale);
    const outW: Dim = w === null ? null : Math.floor(w * scale);
    return { outputShapes: { out: [n, c, outH, outW] } };
  },

  transformer_encoder: inferPassthrough,

  transformer_decoder(inputShapes) {
    const shape = inputShapes["target"] ?? null;
    if (!shape) return { outputShapes: noOutput(), error: "target shape not yet available" };
    return { outputShapes: { out: shape } };
  },
};

export function inferNodeShapes(
  opType: string,
  inputShapes: Record<string, Shape | null>,
  params: Record<string, ParamValue>
): ShapeInferenceResult {
  const fn = INFER[opType];
  if (!fn) {
    return { outputShapes: noOutput(), error: `No shape inference rule for op "${opType}"` };
  }
  try {
    return fn(inputShapes, params);
  } catch (e) {
    return { outputShapes: noOutput(), error: String(e) };
  }
}
