# Tensey

Tensey is a visual workspace for designing neural network architectures as graphs. It gives you a canvas for composing models, an engine for validating the graph underneath, and a path from sketch to concrete PyTorch code without forcing every idea through a notebook first.

The point is time. Most model design work starts with a simple question: "Does this shape flow, does this block connect, and is this architecture worth implementing?" Tensey is built to answer that question before you spend the afternoon writing glue code. In that sense, it follows a very practical Nietzschean instinct: treat tools as instruments for creating, testing, and overcoming the current form of an idea, not as monuments to the idea itself.

## What It Does

Tensey lets you build an architecture by placing operator nodes, connecting ports, editing parameters, and reading the consequences immediately. The web app runs the same underlying engine that defines the intermediate representation, validates graph structure, propagates tensor shapes, estimates telemetry, and exports supported graphs to PyTorch.

The current workspace includes:

- A React Flow canvas for editing model graphs.
- A framework-agnostic TypeScript engine in `@tensey/engine`.
- Operator definitions for common neural network layers and graph operations.
- DAG validation for missing nodes, invalid ports, duplicate IDs, cycles, and isolated nodes.
- Static shape analysis that annotates nodes without mutating the original graph.
- Parameter, FLOP, activation memory, and rough peak VRAM estimates.
- `.tensey.json` persistence for saving and loading graphs.
- Built-in examples for ResNet, ViT, BERT, and UNet-style graphs.
- PyTorch export for the supported subset of operators.

## Philosophy

Tensey is intentionally not a training framework. It does not try to own your data pipeline, optimizer loop, experiment tracker, or deployment target. It focuses on the expensive thinking step before those systems matter: getting the architecture into a form that can be inspected, checked, discussed, and generated.

The implementation philosophy is to save time by making hidden structure visible. A neural net sketch is useful only if the edges mean something, the ports are typed enough to reason about, and the output can eventually become code. The canvas is therefore backed by an explicit intermediate representation rather than by UI state alone. That tradeoff costs a little ceremony in the engine, but it prevents the editor from becoming a drawing tool with no executable meaning.

## Implementation Tradeoffs

Tensey uses a framework-agnostic IR as the source of truth. That makes validation, shape analysis, telemetry, persistence, and export all operate on the same graph model. The tradeoff is that each operator needs explicit metadata and inference rules, but the payoff is predictable behavior and a clean boundary between the editor and the engine.

Shape inference is static and conservative. Dynamic dimensions are represented with `null`, and unknown values propagate through the analysis instead of pretending to be exact. This keeps the feedback fast and honest, but it means runtime-dependent behavior is deliberately outside the current scope.

Telemetry is designed for fast architectural feedback, not procurement-grade accounting. Parameter counts are exact where the operator definition makes them exact, while FLOPs and memory numbers are estimates. The UI can still compare designs quickly, but the README, engine types, and comments are clear that these numbers are not hardware guarantees.

The PyTorch exporter favors readable generated modules over supporting every possible graph construct. It emits stable Python identifiers, handles multiple inputs, and produces warnings where an operator depends on a particular PyTorch capability. Unsupported or ambiguous behavior should become a visible warning, not silent code that looks more correct than it is.

The web app keeps user workflow state close to the editor with Zustand: selection, undo and redo history, panel widths, clipboard behavior, dialogs, and local persistence live in the graph store. This is pragmatic for a single-workspace editor. If the app grows into collaboration or multi-project sessions, that state boundary will likely need to become more formal.

## Getting Started

Install dependencies:

```bash
pnpm install
```

Run the web app:

```bash
pnpm --filter @tensey/web dev
```

Run all tests:

```bash
pnpm test
```

Run type checks:

```bash
pnpm typecheck
```

Build the web app:

```bash
pnpm --filter @tensey/web build
```

## Project Structure

```text
packages/
  engine/
    src/
      ir.ts              # Framework-agnostic graph representation
      registry.ts        # Operator registry and built-in operator metadata
      dag.ts             # Structural validation
      shape-engine.ts    # Topological shape propagation
      shape-rules.ts     # Per-operator shape inference
      telemetry.ts       # Parameter, FLOP, and memory estimates
      pytorch-export.ts  # PyTorch module generation
  web/
    src/
      App.tsx
      components/        # Canvas, palette, inspector, topbar, telemetry UI
      lib/               # Persistence, demo graph, example graphs
      store/graph.ts     # Editor state and IR conversion
```

## Engine Model

The core graph is made of `IRNode` and `IREdge` objects. Nodes reference an operator type, carry editable parameters, expose named input and output ports, and optionally store a canvas position. Edges connect a source node port to a target node port.

That model gives the project a stable contract:

- The editor can freely render and manipulate nodes.
- The engine can validate the graph without depending on React.
- Shape analysis can return an annotated copy rather than mutating inputs.
- Persistence can serialize the graph as plain JSON.
- Exporters can target PyTorch today and other backends later.

## Current Boundaries

Tensey is best understood as an architecture design and inspection tool. It is not yet a full experiment environment. Training, datasets, runtime profiling, distributed execution, and backend-specific graph optimizations are intentionally left out so the core loop stays fast: sketch, validate, inspect, revise, export.

That boundary is the main design bet. Saving time does not come from adding every feature. It comes from removing the delay between an architectural idea and the first serious signal about whether that idea is structurally sound.
