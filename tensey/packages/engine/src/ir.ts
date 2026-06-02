/**
 * Tensey IR — framework-agnostic intermediate representation
 * for neural network architectures.
 */

// ---------------------------------------------------------------------------
// Tensor shapes
// ---------------------------------------------------------------------------

/** A single dimension: number = static, null = dynamic (e.g. batch size) */
export type Dim = number | null;

/** Tensor shape as an ordered list of dimensions */
export type Shape = Dim[];

/** Named input or output port on a node */
export interface Port {
  name: string;
  /** Expected shape at this port. null = not yet inferred */
  shape: Shape | null;
  /** Data type, e.g. "float32", "int64" */
  dtype: string;
}

// ---------------------------------------------------------------------------
// Operators
// ---------------------------------------------------------------------------

/**
 * Static descriptor for a layer/op type.
 * Lives in the operator registry — one entry per op kind.
 */
export interface OperatorDef {
  /** Unique stable identifier, e.g. "conv2d", "linear", "relu" */
  readonly opType: string;
  /** Human-readable name */
  readonly label: string;
  /** Category for palette grouping */
  readonly category: OperatorCategory;
  /** Default hyperparameter values */
  readonly defaultParams: Record<string, ParamValue>;
  /** Declared input port names */
  readonly inputPorts: string[];
  /** Declared output port names */
  readonly outputPorts: string[];
}

export type OperatorCategory =
  | "convolution"
  | "linear"
  | "activation"
  | "normalization"
  | "pooling"
  | "attention"
  | "recurrent"
  | "reshape"
  | "merge"
  | "io"
  | "custom";

export type ParamValue = number | string | boolean | Dim[];

// ---------------------------------------------------------------------------
// Graph nodes
// ---------------------------------------------------------------------------

/** A single node in the architecture graph */
export interface IRNode {
  /** Stable unique ID within the graph */
  id: string;
  /** References an OperatorDef.opType */
  opType: string;
  /** User-editable label (defaults to opType) */
  label: string;
  /** Hyperparameters for this instance */
  params: Record<string, ParamValue>;
  /** Input ports with inferred shapes (populated by shape engine) */
  inputs: Port[];
  /** Output ports with inferred shapes (populated by shape engine) */
  outputs: Port[];
  /** Optional 2-D canvas position for the visual editor */
  position?: { x: number; y: number };
}

// ---------------------------------------------------------------------------
// Graph edges
// ---------------------------------------------------------------------------

/** A directed edge connecting one node's output port to another's input port */
export interface IREdge {
  id: string;
  sourceNodeId: string;
  sourcePort: string;
  targetNodeId: string;
  targetPort: string;
}

// ---------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------

/** The top-level architecture graph */
export interface IRGraph {
  /** Stable unique ID for this graph/project */
  id: string;
  name: string;
  nodes: IRNode[];
  edges: IREdge[];
  /** ISO-8601 timestamps */
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Validation results (used by DAG validator + shape engine)
// ---------------------------------------------------------------------------

export type DiagnosticSeverity = "error" | "warning" | "info";

export interface Diagnostic {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  /** Node or edge ID this diagnostic refers to, if applicable */
  nodeId?: string;
  edgeId?: string;
}

export interface ValidationResult {
  valid: boolean;
  diagnostics: Diagnostic[];
}
