// Core exports - essential components only
export { StateGraph } from "./core/graph.js";
export { GraphBuilder } from "./core/builder.js";
export { GraphComposition } from "./composition/algebra.js";

export type { ModelElement, ComponentFunction } from "./jsx-runtime/types.js";

// Import for internal use
import type { ModelElement } from "./jsx-runtime/types.js";
import type { AnalysisResult } from "./core/types.js";
import { StateGraph } from "./core/graph.js";
import { GraphBuilder } from "./core/builder.js";
import { GraphComposition } from "./composition/algebra.js";
import { createSieveRuntime } from "./effects/runtime.js";
import type { CapabilityImplementation } from "./effects/capability-schema.js";

// Essential types
export type {
  StateNode,
  GraphEdge,
  AnalysisResult,
  AnalysisOptions,
} from "./core/types.js";

export type {
  CompositionResult,
  CompositionOperation,
} from "./composition/types.js";

export { State, InitialState, FinalState } from "./components/State.js";

export { OnEvent } from "./components/OnEvent.js";

export {
  When,
  Otherwise,
  Transition as TransitionComponent,
} from "./components/Transition.js";

export { TestModel } from "./components/TestModel.js";

export { StateFragment } from "./components/StateFragment.js";
export type { StateFragmentProps } from "./components/StateFragment.js";

// HOC system removed - keeping only essential composition functionality

// Simplified runtime execution with Effects Runtime
function runModelWithCapabilities(
  element: ModelElement,
  options?: { name?: string; debug?: boolean }
): Promise<{ success: boolean; error?: Error }> {
  if (element.type !== "TestModel") {
    throw new Error("Expected TestModel element with capabilities");
  }

  const { capabilities, execute } = element.props;
  if (!capabilities || !execute) {
    throw new Error("TestModel must have capabilities and execute function");
  }

  // Build the state graph from JSX
  const model = GraphBuilder.fromJSX(element);

  // Create SieveRuntime with capabilities
  const runtime = createSieveRuntime(capabilities, {
    mode: "live",
    debug: options?.debug || process.env.SIEVE_DEBUG === "1",
    attachments: {
      screenshots: false,
      html: false,
      network: false,
      console: false,
    },
  });

  return runtime.execute(model, execute);
}

export class Model {
  static analyze(
    element: ModelElement,
    options?: import("./core/types.js").AnalysisOptions
  ): AnalysisResult {
    const graph = GraphBuilder.fromJSX(element);
    return graph.analyze(options);
  }

  static build(element: ModelElement): StateGraph {
    return GraphBuilder.fromJSX(element);
  }

  static validate(element: ModelElement): { valid: boolean; errors: string[] } {
    const graph = GraphBuilder.fromJSX(element);
    const analysis = graph.analyze();

    const errors: string[] = [];

    if (!graph.getInitialState()) {
      errors.push("Model must have an initial state");
    }

    if (graph.getFinalStates().size === 0) {
      errors.push("Model must have at least one final state");
    }

    if (analysis.unreachableStates.length > 0) {
      errors.push(
        `Unreachable states found: ${analysis.unreachableStates.join(", ")}`
      );
    }

    if (analysis.deadlocks.length > 0) {
      errors.push(`Deadlock states found: ${analysis.deadlocks.join(", ")}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Mathematical composition operations - core value of CodeSieve
  static compose(g1: StateGraph, g2: StateGraph) {
    return GraphComposition.compose(g1, g2);
  }

  static union(g1: StateGraph, g2: StateGraph) {
    return GraphComposition.union(g1, g2);
  }

  static kleeneStar(graph: StateGraph) {
    return GraphComposition.kleeneStar(graph);
  }

  static identity() {
    return GraphComposition.identity();
  }

  static verifyAssociativity(a: StateGraph, b: StateGraph, c: StateGraph) {
    return GraphComposition.verifyAssociativity(a, b, c);
  }

  static verifyIdentity(graph: StateGraph) {
    return GraphComposition.verifyIdentity(graph);
  }

  static async run(
    element: ModelElement,
    options?: { name?: string; debug?: boolean }
  ): Promise<{ success: boolean; error?: Error }> {
// [trimmed]
