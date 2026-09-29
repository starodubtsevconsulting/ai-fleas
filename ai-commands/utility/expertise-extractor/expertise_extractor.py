#!/usr/bin/env python3
import argparse, json, re, shutil, sys
from pathlib import Path

try:
    import yaml
except ImportError:
    print("PyYAML is required", file=sys.stderr)
    raise SystemExit(2)

ROOT = Path(__file__).resolve().parents[3]
MODELS = ROOT / "models"
STATES = {"confirmed","refined","contradicted","inferred-but-unverified","unknown"}

def safe_id(value):
    if not re.fullmatch(r"[A-Za-z0-9._-]+", value):
        raise SystemExit("model/evidence id must contain only letters, numbers, dot, underscore, hyphen")
    return value

def load_yaml(path):
    with open(path, encoding="utf-8") as f:
        data=yaml.safe_load(f)
    if not isinstance(data, dict):
        raise SystemExit(f"expected YAML mapping: {path}")
    return data

def dump_yaml(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        yaml.safe_dump(data, f, sort_keys=False, allow_unicode=True)

def profile_path(model):
    return MODELS / safe_id(model) / "expertise-profile.yml"

def cmd_init(args):
    dst=profile_path(args.model)
    if dst.exists():
        raise SystemExit(f"profile already exists: {dst}")
    declared=load_yaml(args.declared)
    profile={
      "schema_version":"ai-fleas-model-expertise.v1",
      "model":args.model,
      "profile":{"maturity":"draft","basis":["public-model-documentation"]},
      "draft":declared,
      "observed":{"claims":[]},
      "extraction":{"status":"draft","intended_use":args.intended_use or "unspecified","remaining_questions":[]}
    }
    dump_yaml(dst,profile)
    print(json.dumps({"profile":str(dst.relative_to(ROOT)),"status":"draft"}))

def validate_update(u, model):
    claim=u.get("claim") or {}
    evidence=u.get("evidence") or {}
    interp=u.get("interpretation") or {}
    nxt=u.get("next_action") or {}
    missing=[]
    for label,val in [
      ("claim.id",claim.get("id")),("claim.new_state",claim.get("new_state")),
      ("claim.statement",claim.get("statement")),("evidence.paths",evidence.get("paths")),
      ("evidence.model",evidence.get("model")),("evidence.deployment",evidence.get("deployment")),
      ("evidence.task_family",evidence.get("task_family")),("evidence.result",evidence.get("result")),
      ("interpretation.supports",interp.get("supports")),("interpretation.does_not_prove",interp.get("does_not_prove")),
      ("next_action.type",nxt.get("type"))
    ]:
        if val in (None,"",[]): missing.append(label)
    if missing: raise SystemExit("missing required update fields: "+", ".join(missing))
    if claim["new_state"] not in STATES: raise SystemExit("invalid claim.new_state")
    if evidence["model"] != model: raise SystemExit("evidence.model does not match --model")

def cmd_apply(args):
    pp=profile_path(args.model)
    if not pp.exists(): raise SystemExit(f"profile not found: {pp}")
    profile=load_yaml(pp); update=load_yaml(args.evidence); validate_update(update,args.model)
    eid=safe_id(args.evidence_id or Path(args.evidence).stem)
    evidence_dir=pp.parent/"benchmarks"/"expertise-extraction"
    stored=evidence_dir/f"{eid}.yml"
    if stored.exists(): raise SystemExit(f"evidence id already exists: {eid}")
    dump_yaml(stored,update)
    claims=profile.setdefault("observed",{}).setdefault("claims",[])
    claims.append({
      "id":update["claim"]["id"],
      "state":update["claim"]["new_state"],
      "statement":update["claim"]["statement"],
      "evidence":str(stored.relative_to(pp.parent)),
      "scope":{
        "deployment":update["evidence"]["deployment"],
        "task_family":update["evidence"]["task_family"]
      },
      "interpretation":update["interpretation"]
    })
    ex=profile.setdefault("extraction",{})
    nxt=update.get("next_action",{})
    if nxt.get("type")=="stop":
        ex["status"]="sufficient-for-current-purpose"
    elif nxt.get("uncertainty"):
        qs=ex.setdefault("remaining_questions",[])
        if nxt["uncertainty"] not in qs: qs.append(nxt["uncertainty"])
        ex["status"]="evidence-collection"
    dump_yaml(pp,profile)
    print(json.dumps({"profile":str(pp.relative_to(ROOT)),"evidence":str(stored.relative_to(ROOT)),"claim_state":update["claim"]["new_state"],"extraction_status":ex.get("status")}))

def cmd_status(args):
    pp=profile_path(args.model)
    if not pp.exists(): raise SystemExit(f"profile not found: {pp}")
    p=load_yaml(pp); claims=p.get("observed",{}).get("claims",[])
    counts={s:0 for s in sorted(STATES)}
    for c in claims:
        if c.get("state") in counts: counts[c["state"]]+=1
    ex=p.get("extraction",{})
    print(json.dumps({"model":args.model,"maturity":p.get("profile",{}).get("maturity"),"extraction_status":ex.get("status"),"claim_counts":counts,"remaining_questions":ex.get("remaining_questions",[])},indent=2))

def main():
    ap=argparse.ArgumentParser()
    sp=ap.add_subparsers(dest="cmd",required=True)
    p=sp.add_parser("init"); p.add_argument("--model",required=True); p.add_argument("--declared",required=True); p.add_argument("--intended-use"); p.set_defaults(fn=cmd_init)
    p=sp.add_parser("apply"); p.add_argument("--model",required=True); p.add_argument("--evidence",required=True); p.add_argument("--evidence-id"); p.set_defaults(fn=cmd_apply)
    p=sp.add_parser("status"); p.add_argument("--model",required=True); p.set_defaults(fn=cmd_status)
    args=ap.parse_args(); args.fn(args)
if __name__=="__main__": main()
