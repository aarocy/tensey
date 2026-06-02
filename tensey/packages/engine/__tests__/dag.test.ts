import { describe, it, expect, beforeEach } from "vitest";
import { validateGraph } from "../src/dag.js";
import { makeNode, makeEdge, makeGraph, resetCounters } from "../src/factory.js";
import { listOps, registerOp } from "../src/registry.js";

beforeEach(() => resetCounters());

// ---------------------------------------------------------------------------
// Happy paths
// ---------------------------------------------------------------------------

describe("valid graphs", () => {
  it("passes a simple linear chain: input → relu → output", () => {
    const input = makeNode("input");
    const relu = makeNode("relu");
    const output = makeNode("output");
    const graph = makeGraph(
      [input, relu, output],
      [
        makeEdge(input.id, relu.id),
        makeEdge(relu.id, output.id, "out", "in"),
      ]
    );
    const result = validateGraph(graph);
    expect(result.valid).toBe(true);
    expect(result.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
  });

  it("passes a residual (skip-connection) graph", () => {
    const input = makeNode("input");
    const conv = makeNode("conv2d");
    const relu = makeNode("relu");
    const add = makeNode("add");
    const output = makeNode("output");
    const graph = makeGraph(
      [input, conv, relu, add, output],
      [
        makeEdge(input.id, conv.id),
        makeEdge(conv.id, relu.id),
        makeEdge(relu.id, add.id, "out", "a"),
        makeEdge(input.id, add.id, "out", "b"), // skip connection
        makeEdge(add.id, output.id, "out", "in"),
      ]
    );
    const result = validateGraph(graph);
    expect(result.valid).toBe(true);
  });

  it("passes a multi-input attention node", () => {
    const q = makeNode("input", { id: "q" });
    const k = makeNode("input", { id: "k" });
    const v = makeNode("input", { id: "v" });
    const attn = makeNode("multi_head_attention");
    const output = makeNode("output");
    const graph = makeGraph(
      [q, k, v, attn, output],
      [
        makeEdge(q.id, attn.id, "out", "query"),
        makeEdge(k.id, attn.id, "out", "key"),
        makeEdge(v.id, attn.id, "out", "value"),
        makeEdge(attn.id, output.id, "out", "in"),
      ]
    );
    const result = validateGraph(graph);
    expect(result.valid).toBe(true);
  });

  it("passes an empty graph", () => {
    const graph = makeGraph([], []);
    const result = validateGraph(graph);
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Cycle detection
// ---------------------------------------------------------------------------

describe("cycle detection", () => {
  it("rejects a direct self-loop", () => {
    const relu = makeNode("relu");
    const graph = makeGraph(
      [relu],
      [makeEdge(relu.id, relu.id)]
    );
    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.code === "CYCLE_DETECTED")).toBe(true);
  });

  it("rejects A → B → C → A", () => {
    const a = makeNode("relu", { id: "a" });
    const b = makeNode("relu", { id: "b" });
    const c = makeNode("relu", { id: "c" });
    const graph = makeGraph(
      [a, b, c],
      [
        makeEdge(a.id, b.id),
        makeEdge(b.id, c.id),
        makeEdge(c.id, a.id),
      ]
    );
    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.code === "CYCLE_DETECTED")).toBe(true);
  });

  it("rejects a cycle buried inside a larger valid graph", () => {
    const input = makeNode("input");
    const a = makeNode("relu", { id: "a" });
    const b = makeNode("relu", { id: "b" });
    const output = makeNode("output");
    const graph = makeGraph(
      [input, a, b, output],
      [
        makeEdge(input.id, a.id),
        makeEdge(a.id, b.id),
        makeEdge(b.id, a.id), // cycle between a and b
        makeEdge(b.id, output.id, "out", "in"),
      ]
    );
    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.code === "CYCLE_DETECTED")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Edge validation
// ---------------------------------------------------------------------------

describe("edge validation", () => {
  it("errors on edge referencing a missing source node", () => {
    const relu = makeNode("relu");
    const graph = makeGraph(
      [relu],
      [makeEdge("ghost_node", relu.id)]
    );
    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.code === "MISSING_SOURCE_NODE")).toBe(true);
  });

  it("errors on edge referencing a missing target node", () => {
    const relu = makeNode("relu");
    const graph = makeGraph(
      [relu],
      [makeEdge(relu.id, "ghost_node")]
    );
    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.code === "MISSING_TARGET_NODE")).toBe(true);
  });

  it("errors on invalid source port name", () => {
    const relu = makeNode("relu");
    const linear = makeNode("linear");
    const graph = makeGraph(
      [relu, linear],
      [makeEdge(relu.id, linear.id, "nonexistent_port", "in")]
    );
    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.code === "INVALID_SOURCE_PORT")).toBe(true);
  });

  it("errors on invalid target port name", () => {
    const relu = makeNode("relu");
    const linear = makeNode("linear");
    const graph = makeGraph(
      [relu, linear],
      [makeEdge(relu.id, linear.id, "out", "nonexistent_port")]
    );
    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.code === "INVALID_TARGET_PORT")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Structural warnings
// ---------------------------------------------------------------------------

describe("structural warnings", () => {
  it("warns on isolated non-io node", () => {
    const relu = makeNode("relu");
    const graph = makeGraph([relu], []);
    const result = validateGraph(graph);
    // warnings don't make it invalid
    expect(result.valid).toBe(true);
    expect(result.diagnostics.some((d) => d.code === "ISOLATED_NODE")).toBe(true);
  });

  it("does NOT warn on isolated input/output nodes", () => {
    const input = makeNode("input");
    const output = makeNode("output");
    const graph = makeGraph([input, output], []);
    const result = validateGraph(graph);
    expect(result.diagnostics.some((d) => d.code === "ISOLATED_NODE")).toBe(false);
  });

  it("warns on unknown opType but still validates rest of graph", () => {
    const mystery = makeNode("some_future_op_v2");
    const graph = makeGraph([mystery], []);
    const result = validateGraph(graph);
    expect(result.diagnostics.some((d) => d.code === "UNKNOWN_OP_TYPE")).toBe(true);
  });

  it("errors on duplicate node IDs", () => {
    const a = makeNode("relu", { id: "same_id" });
    const b = makeNode("relu", { id: "same_id" });
    const graph = makeGraph([a, b], []);
    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.code === "DUPLICATE_NODE_ID")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Operator registry
// ---------------------------------------------------------------------------

describe("operator registry", () => {
  it("seed operators are all registered", () => {
    const ops = listOps();
    expect(ops.length).toBeGreaterThan(0);
    const opTypes = ops.map((o) => o.opType);
    expect(opTypes).toContain("conv2d");
    expect(opTypes).toContain("linear");
    expect(opTypes).toContain("multi_head_attention");
  });

  it("throws on duplicate registration", () => {
    expect(() =>
      registerOp({
        opType: "relu", // already registered
        label: "ReLU duplicate",
        category: "activation",
        defaultParams: {},
        inputPorts: ["in"],
        outputPorts: ["out"],
      })
    ).toThrow();
  });
});
