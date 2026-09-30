"""Export the GAIA2 ActiveSaddler run (paper Run 1) into the JSON files that
drive the interactive Curriculum Replay and Arm Lifecycle demos.

Sources (all read-only):
  <run-dir>/cycles/iterNN_train_before_*/iterNN_cN_sampler_trace.json
  <run-dir>/cycles/iterNN_train_before_*/iterNN_cN_arm_decision.json
  <analysis-dir>/arm_lifecycle_analysis_1400/arm_lifecycle_{long_form,summary}.csv
  <analysis-dir>/pattern_prob_1400/pattern_prob_stack_topk.csv   (paper colour order)
  <analysis-dir>/cost_fairness_timelines.json                    (rollouts, cost, dev)
  <analysis-dir>/pattern_ids.py, arm_palette.py                  (P-numbers, colours)

Outputs:
  src/components/Curriculum/data/replay.json      core numbers, bundled eagerly
  src/components/Curriculum/data/rationales.json  verbatim LLM text, lazy-loaded

Every free-text field is scrubbed of absolute paths and user names, scenario
ids lose their ``scenario_universe_29_`` prefix, and arm hashes are rewritten
to the paper's P-numbers.
"""

from __future__ import annotations

import argparse
import csv
import getpass
import glob
import gzip
import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "src" / "components" / "Curriculum" / "data"
TIMELINE_KEY = "ActiveSaddler (Run 1)"
BUDGET = 1400
PAPER_PULL_ITERS = [5, 7, 8, 9, 11, 12, 13, 14, 16, 17, 20, 22, 23, 25, 27, 30,
                    31, 32, 33, 34, 35, 36, 37, 38, 39, 41, 43, 44, 45, 47, 48,
                    49, 50, 51]

SCENARIO_PREFIX = re.compile(r"scenario_universe_\d+_")
ABS_PATH = re.compile(r"(?:/(?:mnt|Data2|data2|home|tmp|Users)(?:/[^\s'\",;:)\]]+)+)")
LEAKS = re.compile(re.escape(getpass.getuser()) + r"[\w.-]*|worktrees/[^\s'\",;)]+")


def fail(message: str) -> None:
    sys.exit(f"export_demo_data: ASSERTION FAILED: {message}")


def short_scenario(sid: str) -> str:
    return SCENARIO_PREFIX.sub("", sid)


def as_list(value) -> list:
    if isinstance(value, list):
        return value
    if isinstance(value, str) and value.startswith("["):
        return json.loads(value.replace("'", '"'))
    return []


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--run-dir", type=Path, required=True,
                        help="ActiveSaddler run directory (paper Run 1 on GAIA2)")
    parser.add_argument("--analysis-dir", type=Path, required=True,
                        help="directory with the arm-lifecycle CSVs, timelines JSON, "
                             "pattern_ids.py and arm_palette.py")
    parser.add_argument("--out-dir", type=Path, default=OUT_DIR)
    args = parser.parse_args()

    sys.path.insert(0, str(args.analysis_dir))
    from arm_palette import SERIES  # noqa: E402
    from pattern_ids import PAPER_ID  # noqa: E402

    hash_re = re.compile(r"\b(" + "|".join(PAPER_ID) + r")\b")

    def scrub(text: str | None) -> str | None:
        if not text:
            return text
        text = ABS_PATH.sub("<path>", text)
        text = LEAKS.sub("<path>", text)
        text = SCENARIO_PREFIX.sub("", text)
        return hash_re.sub(lambda m: f"P{PAPER_ID[m.group(1)]}", text)

    # --- paper colour order ------------------------------------------------
    with open(args.analysis_dir / "pattern_prob_1400" / "pattern_prob_stack_topk.csv") as fh:
        header = next(csv.reader(fh))
    named = [h for h in header if h not in ("iteration", "live_arms", "other")]
    slot = {pid: i for i, pid in enumerate(named)}  # index into SERIES / --arm-N tokens
    if len(slot) != len(SERIES):
        fail(f"expected {len(SERIES)} named arms, got {len(slot)}")

    # --- tidy CSVs -----------------------------------------------------------
    lc_dir = args.analysis_dir / "arm_lifecycle_analysis_1400"
    long_rows = list(csv.DictReader(open(lc_dir / "arm_lifecycle_long_form.csv")))
    summary = {r["pattern_id"]: r for r in csv.DictReader(open(lc_dir / "arm_lifecycle_summary.csv"))}
    csv_q = {(int(r["iteration"]), r["pattern_id"]): float(r["softmax_probability"]) for r in long_rows}
    csv_sel = {int(r["iteration"]): r for r in long_rows if r["selected"] == "True"}

    # --- timelines -----------------------------------------------------------
    timeline = json.load(open(args.analysis_dir / "cost_fairness_timelines.json"))["gaia2"][TIMELINE_KEY]
    tl = {r["it"]: r for r in timeline["rows"]}

    # --- per-iteration traces --------------------------------------------------
    traces: dict[int, dict] = {}
    for path in glob.glob(str(args.run_dir / "cycles" / "iter*_train_before_*" / "*_sampler_trace.json")):
        t = json.load(open(path))
        traces[int(t["iteration"])] = t
    decisions: dict[int, dict] = {}
    for path in glob.glob(str(args.run_dir / "cycles" / "iter*_train_before_*" / "*_arm_decision.json")):
        d = json.load(open(path))
        decisions[int(d["iteration"])] = d

    last_it = max(it for it in tl if tl[it]["rollouts"] <= BUDGET)
    iters, rationales = [], {}
    arm_seen: dict[str, dict] = {}
    tau = None
    for it in range(1, last_it + 1):
        t = traces[it]
        tau = float(t["temperature"])
        action = "pull" if t["action"] == "arm_pull" else "draw"
        row = tl[it]
        entry = {
            "it": it,
            "action": action,
            "rollouts": row["rollouts"],
            "cost": round(row["opt"]["cost_cal"] + row["task"]["cost_cal"], 1),
            "bestDev": round(row["best"], 4),
            "devEval": None if row["acc"] is None else round(row["acc"], 4),
            "numArms": int(t["num_arms"]),
            "unseen": int(t["num_unseen_remaining"]),
            "batch": [short_scenario(s) for s in as_list(t["selected_minibatch"])],
        }
        for arm in t["arms"]:
            arm_seen.setdefault(arm["pattern_id"], arm)
        rat: dict = {}
        if it in decisions:
            rat["decision"] = scrub(decisions[it].get("rationale"))
            if decisions[it]["action"] != action:
                fail(f"iteration {it}: decision {decisions[it]['action']} != trace {action}")
        if action == "pull":
            chosen = t["chosen_arm"]
            entry["chosen"] = PAPER_ID[chosen]
            scores, arm_rat = [], {}
            for arm in t["arms"]:
                pid = arm["pattern_id"]
                q = float(arm["prob"])
                if abs(q - csv_q[(it, pid)]) > 1e-6:
                    fail(f"iteration {it} arm {pid}: q trace {q} != csv {csv_q[(it, pid)]}")
                scores.append({
                    "p": PAPER_ID[pid],
                    "sev": arm["severity"], "fix": arm["fixability"],
                    "br": arm["breadth"], "se": arm["side_effect"],
                    "phi": round(float(arm["score"]), 4), "q": round(q, 5),
                    "n": int(arm["num_scenarios"]),
                })
                if arm.get("rationale"):
                    arm_rat[PAPER_ID[pid]] = scrub(arm["rationale"])
            total = sum(s["q"] for s in scores)
            if abs(total - 1) > 1e-3:
                fail(f"iteration {it}: sum q = {total}")
            if csv_sel[it]["pattern_id"] != chosen:
                fail(f"iteration {it}: chosen {chosen} != csv {csv_sel[it]['pattern_id']}")
            for s in scores:  # recompute softmax(phi / tau) as a sanity check
                z = sum(math.exp(o["phi"] / tau) for o in scores)
                if abs(math.exp(s["phi"] / tau) / z - s["q"]) > 2e-3:
                    fail(f"iteration {it}: q != softmax(phi/tau) for P{s['p']}")
            scores.sort(key=lambda s: -s["q"])
            entry["scores"] = scores
            sel = csv_sel[it]

            def num(v):
                return None if v in ("", None) else round(float(v), 4)

            entry["outcome"] = {
                "before": num(sel["train_pass_before"]),
                "after": num(sel["train_pass_after"]),
                "accepted": sel["patch_accepted"] == "True",
                "allPass": sel["abandoned_all_pass"] == "True",
            }
            rat["arms"] = arm_rat
        iters.append(entry)
        if rat:
            rationales[it] = rat

    # scenario joins: iterations at which a new scenario became associated with
    # an arm (same rule as the paper's lifecycle figures, _scenario_joins in
    # plot_arm_lifecycle_grid.py): first appearance of each scenario in the
    # registry tuples, excluding the tuple that created the arm.
    registry = json.load(gzip.open(args.run_dir / "pattern_registry.json.gz"))["patterns"]
    joins: dict[str, list] = {}
    for pid in PAPER_ID:
        pat = registry[pid]
        first: dict[str, int] = {}
        for tup in pat.get("tuples", []):
            idx = int(tup["harness_idx"])
            first[tup["scenario_id"]] = min(first.get(tup["scenario_id"], idx), idx)
        born = int(pat["created_iteration"])
        joins[pid] = sorted([idx, short_scenario(sid)] for sid, idx in first.items()
                            if born < idx <= last_it)

    # arms discovered at iteration t join the pool for iteration t + 1
    arms = []
    for pid, p in sorted(PAPER_ID.items(), key=lambda kv: kv[1]):
        s = summary[pid]
        arms.append({
            "p": p,
            "id": pid,
            "label": scrub(s["label"]),
            "created": int(s["created_iteration"]),
            "status": s["status"],
            "pulls": int(s["num_pulls"]),
            "accepted": int(s["accepted_patches"]),
            "slot": slot.get(pid),
            "joins": joins[pid],
        })

    # --- assertions ------------------------------------------------------------
    pulls = [e["it"] for e in iters if e["action"] == "pull"]
    if pulls != PAPER_PULL_ITERS:
        fail(f"pull iterations {pulls} != paper {PAPER_PULL_ITERS}")
    first_pull = next(e for e in iters if e["action"] == "pull")
    if (first_pull["numArms"], iters[-1]["numArms"]) != (6, 35):
        fail(f"arm pool {first_pull['numArms']} -> {iters[-1]['numArms']}, expected 6 -> 35")
    if abs(iters[-1]["bestDev"] - 0.6308) > 1e-4:
        fail(f"final best dev {iters[-1]['bestDev']}")
    if any(e["rollouts"] > BUDGET for e in iters):
        fail("rollouts above budget")
    for a in arms:
        if a["pulls"] != sum(1 for e in iters if e.get("chosen") == a["p"]):
            fail(f"P{a['p']}: pull count mismatch")
    if [j[0] for j in next(a for a in arms if a["p"] == 8)["joins"]] != [10, 21, 24]:
        fail("P8 scenario joins differ from the paper's case study (10, 21, 24)")

    replay = {
        "meta": {"tau": tau, "budget": BUDGET, "minibatch": 3,
                 "run": "GAIA2 · Run 1", "trainScenarios": 75, "devScenarios": 65},
        "arms": arms,
        "iters": iters,
    }
    args.out_dir.mkdir(parents=True, exist_ok=True)
    blob_core = json.dumps(replay, separators=(",", ":"), ensure_ascii=False)
    blob_rat = json.dumps(rationales, separators=(",", ":"), ensure_ascii=False)
    for blob in (blob_core, blob_rat):
        for bad in ("/mnt/", "/Data2", getpass.getuser(), "/home/", "scenario_universe"):
            if bad in blob:
                fail(f"leak {bad!r} survived scrubbing")
    (args.out_dir / "replay.json").write_text(blob_core)
    (args.out_dir / "rationales.json").write_text(blob_rat)

    draws = len(iters) - len(pulls)
    print(f"iterations={len(iters)} pulls={len(pulls)} draws={draws} arms={len(arms)} "
          f"best={iters[-1]['bestDev']:.1%} rollouts={iters[-1]['rollouts']}")
    print(f"replay.json {len(blob_core) / 1024:.0f} KB, rationales.json {len(blob_rat) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
