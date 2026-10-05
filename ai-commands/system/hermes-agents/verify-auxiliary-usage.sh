#!/usr/bin/env bash
set -euo pipefail

profile=''; session=''; required_tasks=(compression goal_judge)
while (($#)); do
  case "$1" in
    --profile) profile="$2"; shift 2 ;;
    --session) session="$2"; shift 2 ;;
    --task) required_tasks=("$2"); shift 2 ;;
    *) printf 'Usage: %s --profile ID [--session ID] [--task compression|goal_judge]\n' "$0" >&2; exit 2 ;;
  esac
done
[[ "$profile" =~ ^[a-z0-9][a-z0-9_-]*$ && ( -z "$session" || "$session" =~ ^[A-Za-z0-9_-]+$ ) ]] || {
  printf 'HERMES_AUXILIARY_USAGE_INVALID_INPUT\n' >&2; exit 2;
}
hermes_bin="${HERMES_BIN:-hermes}"
hermes_home="${HERMES_HOME:-${HOME}/.hermes}"
db="${HERMES_AUXILIARY_STATE_DB:-${hermes_home}/profiles/${profile}/state.db}"
agent_log="${HERMES_AUXILIARY_AGENT_LOG:-${hermes_home}/profiles/${profile}/logs/agent.log}"
[[ -f "$db" ]] || { printf 'HERMES_AUXILIARY_USAGE_BLOCKED: state database missing\n' >&2; exit 1; }

for task in "${required_tasks[@]}"; do
  [[ "$task" == compression || "$task" == goal_judge ]] || { printf 'HERMES_AUXILIARY_USAGE_INVALID_TASK: %s\n' "$task" >&2; exit 2; }
  provider="$($hermes_bin -p "$profile" config get "auxiliary.${task}.provider" | tail -1)"
  model="$($hermes_bin -p "$profile" config get "auxiliary.${task}.model" | tail -1)"
  base_url="$($hermes_bin -p "$profile" config get "auxiliary.${task}.base_url" | tail -1)"
  task_session="$session"
  row=''
  if [[ -z "$task_session" ]]; then
    while IFS='|' read -r candidate candidate_provider candidate_model candidate_url candidate_calls candidate_input candidate_output; do
      if [[ "$candidate_provider" == "$provider" && "$candidate_model" == "$model" && "$candidate_url" == "${base_url%/}" && "$candidate_calls" -gt 0 ]]; then
        task_session="$candidate"
        row="${candidate_provider}|${candidate_model}|${candidate_url}|${candidate_calls}|${candidate_input}|${candidate_output}"
        break
      fi
    done <<<"$(sqlite3 -separator '|' "$db" "SELECT session_id,billing_provider,model,rtrim(billing_base_url,'/'),api_call_count,input_tokens,output_tokens FROM session_model_usage WHERE task='${task}' ORDER BY last_seen DESC;")"
  else
    row="$(sqlite3 -separator '|' "$db" "SELECT billing_provider,model,rtrim(billing_base_url,'/'),api_call_count,input_tokens,output_tokens FROM session_model_usage WHERE session_id='${task_session}' AND task='${task}' ORDER BY last_seen DESC LIMIT 1;")"
  fi
  if [[ -z "$row" && "$task" == goal_judge ]]; then
    # /goal judging runs between foreground turns, outside Hermes' ambient auxiliary-accounting
    # context. Until Hermes records those calls in session_model_usage, prove the resolved route and
    # successful reply from the profile log, bounded by this session's first and last tagged lines.
    [[ -f "$agent_log" ]] || { printf 'HERMES_AUXILIARY_USAGE_BLOCKED: agent log missing\n' >&2; exit 1; }
    route="Auxiliary goal_judge: using ${provider} (${model}) at ${base_url%/}/"
    if [[ -z "$task_session" ]]; then
      while IFS= read -r candidate; do
        start_line="$(grep -nF "[${candidate}]" "$agent_log" | head -1 | cut -d: -f1 || true)"
        end_line="$(grep -nF "[${candidate}]" "$agent_log" | tail -1 | cut -d: -f1 || true)"
        [[ -n "$start_line" && -n "$end_line" ]] || continue
        segment="$(sed -n "${start_line},${end_line}p" "$agent_log")"
        if grep -Fq "$route" <<<"$segment" && grep -q 'hermes_cli.goals: goal judge: verdict=' <<<"$segment"; then
          task_session="$candidate"
          break
        fi
      done < <(sqlite3 "$db" "SELECT session_id FROM session_model_usage WHERE session_id != '' GROUP BY session_id ORDER BY MAX(last_seen) DESC;")
    fi
    [[ -n "$task_session" ]] || { printf 'HERMES_AUXILIARY_USAGE_MISSING: profile=%s task=%s\n' "$profile" "$task" >&2; exit 1; }
    start_line="$(grep -nF "[${task_session}]" "$agent_log" | head -1 | cut -d: -f1 || true)"
    end_line="$(grep -nF "[${task_session}]" "$agent_log" | tail -1 | cut -d: -f1 || true)"
    [[ -n "$start_line" && -n "$end_line" ]] || { printf 'HERMES_AUXILIARY_USAGE_MISSING: session=%s task=%s\n' "$task_session" "$task" >&2; exit 1; }
    segment="$(sed -n "${start_line},${end_line}p" "$agent_log")"
    calls="$(grep -Fc "$route" <<<"$segment" || true)"
    verdicts="$(grep -c 'hermes_cli.goals: goal judge: verdict=' <<<"$segment" || true)"
    [[ "$calls" -gt 0 && "$verdicts" -gt 0 ]] || { printf 'HERMES_AUXILIARY_USAGE_MISSING: session=%s task=%s\n' "$task_session" "$task" >&2; exit 1; }
    printf 'HERMES_AUXILIARY_USAGE_VERIFIED: session=%s task=%s provider=%s model=%s endpoint=%s calls=%s evidence=agent-log-verdict\n' "$task_session" "$task" "$provider" "$model" "${base_url%/}" "$calls"
    continue
  fi
  [[ -n "$row" ]] || { printf 'HERMES_AUXILIARY_USAGE_MISSING: profile=%s session=%s task=%s\n' "$profile" "${task_session:-auto}" "$task" >&2; exit 1; }
  IFS='|' read -r actual_provider actual_model actual_url calls input_tokens output_tokens <<<"$row"
  [[ "$actual_provider" == "$provider" && "$actual_model" == "$model" && "$actual_url" == "${base_url%/}" && "$calls" -gt 0 ]] || {
    printf 'HERMES_AUXILIARY_USAGE_MISMATCH: session=%s task=%s expected=%s/%s@%s actual=%s/%s@%s calls=%s\n' "$task_session" "$task" "$provider" "$model" "${base_url%/}" "$actual_provider" "$actual_model" "$actual_url" "$calls" >&2
    exit 1
  }
  printf 'HERMES_AUXILIARY_USAGE_VERIFIED: session=%s task=%s provider=%s model=%s endpoint=%s calls=%s input_tokens=%s output_tokens=%s\n' "$task_session" "$task" "$provider" "$model" "$actual_url" "$calls" "$input_tokens" "$output_tokens"
done
