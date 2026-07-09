export interface TransitionType {
  from: string;
  to: string;
  event: string;
  guard?: (ctx: any, evt: any) => boolean;
  execute?: (ctx: any, evt: any) => any;
  isEpsilon?: boolean;
  isImmediate?: boolean; // τ transition - executes before external events
}

export interface StateNode {
  name: string;
  verify?: () => void;
  isInitial?: boolean;
  isFinal?: boolean;
}

export interface GraphEdge {
  event: string;
  guard?: (ctx: any, evt: any) => boolean;
  execute?: (ctx: any, evt: any) => any;
  isEpsilon?: boolean;
  isImmediate?: boolean; // τ transition - executes before external events
}

export interface PathResult {
  path: string[];
  cost: number;
  events: string[];
}

export interface DeadlockPath {
  path: string[];
  events: string[];
  reason: "no-outgoing-transitions" | "infinite-cycle" | "guard-always-false";
  rootCause: string;
}

export interface StronglyConnectedComponent {
  nodes: string[];
  hasCycle: boolean;
  canReachFinal: boolean;
  isReachableFromStart: boolean;
}

export interface DeadlockAnalysis {
  deadlockStates: string[];
  deadlockPaths: DeadlockPath[];
  livelocks: StronglyConnectedComponent[];
  partialDeadlocks: StronglyConnectedComponent[];
  hasAnyValidPath: boolean;
}

export interface AnalysisResult {
  criticalStates: string[];
  deadlocks: string[];
  unreachableStates: string[];
  criticality: Map<string, number>;
  deadlockAnalysis: DeadlockAnalysis;
  paths: {
    shortest: PathResult[];
    all: PathResult[];
  };
  trace?: AnalysisTrace;
}

export interface ResourceLimits {
  maxStates: number;
  maxTransitions: number;
  maxPathLength: number;
  timeoutMs: number;
  maxPathCount?: number;
}

export interface PathCountingError {
  type:
    | "timeout"
    | "max_states"
    | "max_transitions"
    | "max_path_length"
    | "max_path_count";
  message: string;
  limit: number;
  actual: number;
}

export interface AnalysisTrace {
  graphMetrics: {
    nodeCount: number;
    edgeCount: number;
    isDAG: boolean;
    sccCount: number;
    largestSccSize: number;
    hasSelfLoops: boolean;
  };
  phaseTimings: {
    criticality: number;
    deadlocks: number;
    unreachableStates: number;
    shortestPaths: number;
    total: number;
  };
  phaseResults: {
    criticalitySkipped?: boolean;
    deadlocksSkipped?: boolean;
    unreachableStatesSkipped?: boolean;
    shortestPathsSkipped?: boolean;
  };
  resourceLimitHits: {
    timeouts: number;
    stateLimit: boolean;
    transitionLimit: boolean;
    pathLengthLimit: boolean;
    pathCountLimit: boolean;
  };
}

export interface AnalysisOptions {
  trace?: boolean;
  limits?: ResourceLimits;
  skipCriticalityForCyclic?: boolean; // default: true
}
