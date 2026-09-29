#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
CMD="$HERE/experience-extractor.command.sh"
MODEL="extractor-test-model-$$"
DIR="$ROOT/models/$MODEL"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP" "$DIR"' EXIT

cat > "$TMP/declared.yml" <<'YAML'
declared_education:
  primary: [coding]
  source: public-test-fixture
YAML

"$CMD" init --model "$MODEL" --declared "$TMP/declared.yml" --intended-use focused-coder > "$TMP/init.json"
test -f "$DIR/experience-profile.yml"
grep -q '"status": "draft"' "$TMP/init.json"

cat > "$TMP/e1.yml" <<YAML
claim:
  id: direct-code-language
  previous_state: draft
  new_state: confirmed
  statement: Concrete code vocabulary worked on the frozen task.
evidence:
  paths: [fixture/run-1.json]
  model: $MODEL
  deployment: test-route
  task_family: bounded-code
  result: accepted
interpretation:
  supports: direct code vocabulary for this task family
  does_not_prove: general coding competence
next_action:
  type: probe-or-stop
  uncertainty: transfer to another task family
YAML
"$CMD" apply --model "$MODEL" --evidence "$TMP/e1.yml" --evidence-id run-1 > "$TMP/apply1.json"
test -f "$DIR/benchmarks/experience-extraction/run-1.yml"
grep -q 'direct-code-language' "$DIR/experience-profile.yml"
grep -q 'transfer to another task family' "$DIR/experience-profile.yml"

cat > "$TMP/e2.yml" <<YAML
claim:
  id: direct-code-language
  previous_state: confirmed
  new_state: contradicted
  statement: The same assumption failed on the transfer fixture.
evidence:
  paths: [fixture/run-2.json]
  model: $MODEL
  deployment: test-route
  task_family: lifecycle-transfer
  result: rejected
interpretation:
  supports: narrower task-specific wording
  does_not_prove: global inability
next_action:
  type: stop
  uncertainty: ""
YAML
"$CMD" apply --model "$MODEL" --evidence "$TMP/e2.yml" --evidence-id run-2 > "$TMP/apply2.json"
# Both historical claim states must remain present.
grep -q 'state: confirmed' "$DIR/experience-profile.yml"
grep -q 'state: contradicted' "$DIR/experience-profile.yml"
grep -q 'sufficient-for-current-purpose' "$DIR/experience-profile.yml"

"$CMD" status --model "$MODEL" > "$TMP/status.json"
grep -q '"confirmed": 1' "$TMP/status.json"
grep -q '"contradicted": 1' "$TMP/status.json"

if "$CMD" apply --model "$MODEL" --evidence "$TMP/e2.yml" --evidence-id run-2 >/dev/null 2>&1; then
  echo "duplicate evidence unexpectedly accepted" >&2; exit 1
fi

sed "s/model: $MODEL/model: wrong-model/" "$TMP/e1.yml" > "$TMP/wrong.yml"
if "$CMD" apply --model "$MODEL" --evidence "$TMP/wrong.yml" --evidence-id wrong >/dev/null 2>&1; then
  echo "model mismatch unexpectedly accepted" >&2; exit 1
fi

echo "experience-extractor tests passed"
