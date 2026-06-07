export type {
  Dim,
  Shape,
  Port,
  OperatorDef,
  OperatorCategory,
  ParamValue,
  IRNode,
  IREdge,
  IRGraph,
  Diagnostic,
  DiagnosticSeverity,
  ValidationResult,
} from "./ir.js";

export { registerOp, getOp, listOps } from "./registry.js";
export { validateGraph } from "./dag.js";
export { analyzeShapes } from "./shape-engine.js";
export type { NodeShapeResult, ShapeAnalysisResult } from "./shape-engine.js";
export { inferNodeShapes } from "./shape-rules.js";
export type { ShapeInferenceResult } from "./shape-rules.js";
export { computeTelemetry } from "./telemetry.js";
export type { NodeTelemetry, TelemetryReport } from "./telemetry.js";
export { makeNode, makeEdge, makeGraph, resetCounters } from "./factory.js";
export { exportGraphToPyTorch } from "./pytorch-export.js";
export type { PyTorchExportResult } from "./pytorch-export.js";
