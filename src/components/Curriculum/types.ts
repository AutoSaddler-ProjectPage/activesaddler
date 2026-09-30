// Shapes of data/replay.json and data/rationales.json, produced by
// scripts/export_demo_data.py from the paper's GAIA2 run (Run 1).

export type Arm = {
  /** Paper number, P1..P35 (ordered by creation). */
  p: number;
  id: string;
  label: string;
  /** Iteration whose extractor registered the arm; it joins the pool at created + 1. */
  created: number;
  status: string;
  pulls: number;
  accepted: number;
  /** Index into the paper's 10-colour series (top-10 arms by probability mass), else null. */
  slot: number | null;
  /** [iteration, scenario] each time a new supporting scenario joined the arm (after its birth). */
  joins: [number, string][];
};

export type ArmScore = {
  p: number;
  sev: number;
  fix: number;
  br: number;
  /** Side-effect risk; φ uses 1 - se. */
  se: number;
  phi: number;
  q: number;
  /** Supporting scenarios |S_t(a)|. */
  n: number;
};

export type Outcome = {
  before: number | null;
  after: number | null;
  accepted: boolean;
  allPass: boolean;
};

export type Iter = {
  it: number;
  action: "pull" | "draw";
  rollouts: number;
  cost: number;
  bestDev: number;
  devEval: number | null;
  numArms: number;
  unseen: number;
  batch: string[];
  chosen?: number;
  scores?: ArmScore[];
  outcome?: Outcome;
};

export type Replay = {
  meta: {
    tau: number;
    budget: number;
    minibatch: number;
    run: string;
    trainScenarios: number;
    devScenarios: number;
  };
  arms: Arm[];
  iters: Iter[];
};

export type Rationales = Record<
  string,
  { decision?: string; arms?: Record<string, string> }
>;
