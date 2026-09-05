#!/usr/bin/env bash
set -euo pipefail

AI_FLOW_PROJECT_DIR="${AI_FLOW_PROJECT_DIR:-}"
AI_FLOW_OUTPUT_DIR="${AI_FLOW_OUTPUT_DIR:-}"

ai_flow_args=()
while [ $# -gt 0 ]; do
  case "$1" in
    --project-dir)
      if [ $# -lt 2 ]; then
        echo "Missing value for --project-dir" >&2
        exit 2
      fi
      AI_FLOW_PROJECT_DIR="$2"
      shift 2
      ;;
    --output-dir)
      if [ $# -lt 2 ]; then
        echo "Missing value for --output-dir" >&2
        exit 2
      fi
      AI_FLOW_OUTPUT_DIR="$2"
      shift 2
      ;;
    --)
      shift
      break
      ;;
    *)
      ai_flow_args+=("$1")
      shift
      ;;
  esac
done
if [ $# -gt 0 ]; then
  ai_flow_args+=("$@")
fi
set -- "${ai_flow_args[@]}"
export AI_FLOW_PROJECT_DIR AI_FLOW_OUTPUT_DIR

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../command-python.setup.sh"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
REGISTRY_FILE="${ROOT_DIR}/commands/projects/projects-registry.yml"

SERVICE=""
ENVIRONMENT="dev"
PROJECT_DIR="${AI_FLOW_PROJECT_DIR:-}"
OPEN_URLS=0
ENV_EXPLICIT=0
ACTIVITY_LIMIT="${ACTIVITY_LIMIT:-8}"
LOG_RANGE="${LOG_RANGE:-1h}"

infer_env() {
  local candidate="${AWS_PROFILE:-${AWS_DEFAULT_PROFILE:-}}"
  case "${candidate,,}" in
    *prod*) echo "prod" ;;
    *test*|*qa*) echo "test" ;;
    *dev*) echo "dev" ;;
    *) echo "dev" ;;
  esac
}

usage() {
  cat <<'EOF'
Usage:
  ./commands/monitoring/monitoring.command.sh --service <service> [--project-dir <path>] [--env <env>] [--open]
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --project-dir)
      PROJECT_DIR="${2:-}"
      shift 2
      ;;
    --service)
      SERVICE="${2:-}"
      shift 2
      ;;
    --env)
      ENVIRONMENT="${2:-}"
      ENV_EXPLICIT=1
      shift 2
      ;;
    --open)
      OPEN_URLS=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown parameter: $1" >&2
      exit 1
      ;;
  esac
done

if [ -z "$SERVICE" ]; then
  echo "Missing required --service <service>" >&2
  exit 1
fi

if [ "$ENV_EXPLICIT" -eq 0 ]; then
  ENVIRONMENT="$(infer_env)"
fi

for required in aws jq; do
  if ! command -v "$required" >/dev/null 2>&1; then
    echo "Missing required dependency: $required" >&2
    exit 1
  fi
done

url_encode() {
  command_python - "$1" <<'PY'
import sys, urllib.parse
print(urllib.parse.quote(sys.argv[1]))
PY
}

range_to_ms() {
  case "$1" in
    15m) echo $((15*60*1000));;
    1h)  echo $((60*60*1000));;
    1d)  echo $((24*60*60*1000));;
    1w)  echo $((7*24*60*60*1000));;
    *) echo "";;
  esac
}

open_urls() {
  if [[ -x "${SCRIPT_DIR}/../browser/browser.command.sh" ]]; then
    "${SCRIPT_DIR}/../browser/browser.command.sh" "$@" >/dev/null 2>&1 || true
  fi
}

eval "$(
command_python - "$REGISTRY_FILE" "$SERVICE" "$PROJECT_DIR" <<'PY'
import os
import shlex
import sys

registry_path, service, project_dir = sys.argv[1:4]
repo_name = os.path.basename(project_dir.rstrip("/")) if project_dir else ""

items = []
current = None
with open(registry_path, encoding="utf-8") as fh:
    for raw in fh:
        line = raw.rstrip("\n")
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped.startswith("- label:"):
            if current:
                items.append(current)
            current = {"label": stripped.split(":", 1)[1].strip()}
            continue
        if current is None:
            continue
        if line.startswith("    ") and ":" in stripped:
            key, value = stripped.split(":", 1)
            current[key.strip()] = value.strip()
if current:
    items.append(current)

matches = []
for item in items:
    keys = {
        item.get("label", ""),
        item.get("app_name", ""),
        item.get("repo_path", ""),
    }
    score = 0
    if service in keys:
        score += 4
    if repo_name and repo_name in keys:
        score += 2
    if score:
        matches.append((score, item))

selected = max(matches, default=(0, {}))[1]
for key in ("label", "app_name", "repo_path", "aws_region", "ecs_cluster_name"):
    value = selected.get(key, "")
    print(f"REGISTRY_{key.upper()}={shlex.quote(value)}")
PY
)"

AWS_REGION="${REGISTRY_AWS_REGION:-}"
ECS_CLUSTER="${REGISTRY_ECS_CLUSTER_NAME:-}"
APP_NAME="${REGISTRY_APP_NAME:-$SERVICE}"

if [ -z "$AWS_REGION" ] || [ -z "$ECS_CLUSTER" ]; then
  echo "Could not resolve aws_region/ecs_cluster_name for service '$SERVICE' from $REGISTRY_FILE" >&2
  exit 1
fi

DASHBOARD_URL="$(
command_python - "$PROJECT_DIR" <<'PY'
import os
import sys

project_dir = sys.argv[1]
if not project_dir:
    raise SystemExit(0)

path = os.path.join(project_dir, "service.datadog.yaml")
if not os.path.isfile(path):
    raise SystemExit(0)

lines = open(path, encoding="utf-8").read().splitlines()
in_links = False
current_type = ""
for raw in lines:
    stripped = raw.strip()
    if not stripped or stripped.startswith("#"):
        continue
    indent = len(raw) - len(raw.lstrip(" "))
    if indent == 0:
        in_links = stripped == "links:"
        continue
    if not in_links:
        continue
    if indent == 2 and stripped.startswith("- "):
        payload = stripped[2:]
        current_type = ""
        if payload.startswith("type:"):
            current_type = payload.split(":", 1)[1].strip()
        continue
    if indent >= 4 and stripped.startswith("type:"):
        current_type = stripped.split(":", 1)[1].strip()
        continue
    if current_type == "dashboard" and indent >= 4 and stripped.startswith("url:"):
        print(stripped.split(":", 1)[1].strip())
        break
PY
)"

ecs_json="$(aws ecs describe-services \
  --cluster "$ECS_CLUSTER" \
  --services "$APP_NAME" \
  --region "$AWS_REGION" \
  --output json)"

scalable_target_json="$(aws application-autoscaling describe-scalable-targets \
  --service-namespace ecs \
  --resource-ids "service/${ECS_CLUSTER}/${APP_NAME}" \
  --region "$AWS_REGION" \
  --output json)"

scaling_policies_json="$(aws application-autoscaling describe-scaling-policies \
  --service-namespace ecs \
  --resource-id "service/${ECS_CLUSTER}/${APP_NAME}" \
  --region "$AWS_REGION" \
  --output json)"

scaling_activities_json="$(aws application-autoscaling describe-scaling-activities \
  --service-namespace ecs \
  --resource-id "service/${ECS_CLUSTER}/${APP_NAME}" \
  --region "$AWS_REGION" \
  --max-results "$ACTIVITY_LIMIT" \
  --output json)"

mapfile -t target_group_arns < <(jq -r '.services[0].loadBalancers[]?.targetGroupArn // empty' <<<"$ecs_json")

target_groups_json='{"TargetGroups":[]}'
load_balancers_json='{"LoadBalancers":[]}'
if [ "${#target_group_arns[@]}" -gt 0 ]; then
  target_groups_json="$(aws elbv2 describe-target-groups \
    --target-group-arns "${target_group_arns[@]}" \
    --region "$AWS_REGION" \
    --output json)"

  mapfile -t load_balancer_arns < <(jq -r '.TargetGroups[]?.LoadBalancerArns[]? // empty' <<<"$target_groups_json" | sort -u)
  if [ "${#load_balancer_arns[@]}" -gt 0 ]; then
    load_balancers_json="$(aws elbv2 describe-load-balancers \
      --load-balancer-arns "${load_balancer_arns[@]}" \
      --region "$AWS_REGION" \
      --output json)"
  fi
fi

mapfile -t alarm_names < <(jq -r '.ScalingPolicies[]?.Alarms[]?.AlarmName // empty' <<<"$scaling_policies_json")
alarm_states_json='{"MetricAlarms":[]}'
if [ "${#alarm_names[@]}" -gt 0 ]; then
  alarm_states_json="$(aws cloudwatch describe-alarms \
    --alarm-names "${alarm_names[@]}" \
    --region "$AWS_REGION" \
    --output json)"
fi

service_query="service:${SERVICE} env:${ENVIRONMENT}"
slo_query="service:${SERVICE}"
service_entity_query="service:${SERVICE}"
query_encoded="$(url_encode "$service_query")"
slo_query_encoded="$(url_encode "$slo_query")"
service_entity_encoded="$(url_encode "$service_entity_query")"
env_encoded="$(url_encode "$ENVIRONMENT")"
region_tag_encoded="$(url_encode "region:${AWS_REGION}")"

range_ms="$(range_to_ms "$LOG_RANGE")"
if [[ -z "$range_ms" ]]; then
  echo "Unsupported LOG_RANGE '$LOG_RANGE' (use 15m|1h|1d|1w)" >&2
  exit 1
fi
now_ms=$(( $(date +%s) * 1000 ))
from_ts=$(( now_ms - range_ms ))

logs_url="https://app.datadoghq.com/logs?query=${query_encoded}&agg_m=count&agg_m_source=base&agg_t=count&cols=host%2Cservice&messageDisplay=inline&refresh_mode=sliding&storage=hot&stream_sort=desc&viz=stream&from_ts=${from_ts}&to_ts=${now_ms}&live=true"
livetail_url="https://app.datadoghq.com/logs/livetail?query=$(url_encode "${service_query} -status:(warn OR info)")&agg_m=count&agg_m_source=base&agg_t=count&cols=host%2Cservice&messageDisplay=inline&refresh_mode=sliding&storage=driveline&stream_sort=desc&viz=stream&from_ts=${from_ts}&to_ts=${now_ms}&live=true"
apm_service_entity_url="https://app.datadoghq.com/apm/entity/${service_entity_encoded}?dependencyMap.showNetworkMetrics=false&env=${env_encoded}&fromUser=false&graphType=span_list&groupMapByOperation=null&panels=qson%3A%28data%3A%28%29%2Cversion%3A%210%29&primaryTags=${region_tag_encoded}&shouldShowLegend=true&spanKind=server&traceQuery=&start=${from_ts}&end=${now_ms}&paused=false"
apm_traces_url="https://app.datadoghq.com/apm/traces?query=${query_encoded}"
monitors_url="https://app.datadoghq.com/monitors/manage?q=${query_encoded}&order=desc"
slo_url="https://app.datadoghq.com/slo/manage?query=${slo_query_encoded}"

ecs_health_url="https://${AWS_REGION}.console.aws.amazon.com/ecs/v2/clusters/${ECS_CLUSTER}/services/${APP_NAME}/health?region=${AWS_REGION}"
ecs_scaling_url="https://${AWS_REGION}.console.aws.amazon.com/ecs/v2/clusters/${ECS_CLUSTER}/services/${APP_NAME}/scaling?region=${AWS_REGION}"

echo "Runtime Validation"
echo "service: $SERVICE"
echo "env: $ENVIRONMENT"
echo "region: $AWS_REGION"
echo "ecs-cluster: $ECS_CLUSTER"
if [ -n "$PROJECT_DIR" ]; then
  echo "project-dir: $PROJECT_DIR"
fi
echo

echo "ECS Summary"
jq -r '
  .services[0] as $svc |
  "- desired/running/pending: \($svc.desiredCount)/\($svc.runningCount)/\($svc.pendingCount)\n" +
  "- task definition: \($svc.taskDefinition | split("/")[-1])\n" +
  "- service ARN: \($svc.serviceArn)"
' <<<"$ecs_json"

echo
echo "Scalable Target"
jq -r '
  if (.ScalableTargets | length) == 0 then
    "- no scalable target found"
  else
    .ScalableTargets[0] |
    "- min/max: \(.MinCapacity)/\(.MaxCapacity)\n- role ARN: \(.RoleARN)"
  end
' <<<"$scalable_target_json"

echo
echo "Scaling Policies"
jq -r '
  if (.ScalingPolicies | length) == 0 then
    "- none"
  else
    .ScalingPolicies[] |
    "- \(.PolicyName) [\(.PolicyType)]" +
    (if .TargetTrackingScalingPolicyConfiguration.TargetValue != null
      then " target=\(.TargetTrackingScalingPolicyConfiguration.TargetValue)"
      else ""
    end) +
    (if .StepScalingPolicyConfiguration.StepAdjustments != null
      then " steps=\(.StepScalingPolicyConfiguration.StepAdjustments | length)"
      else ""
    end)
  end
' <<<"$scaling_policies_json"

echo
echo "Alarm States"
jq -r '
  if (.MetricAlarms | length) == 0 then
    "- none"
  else
    .MetricAlarms[] |
    "- \(.AlarmName): \(.StateValue)"
  end
' <<<"$alarm_states_json"

echo
echo "Recent Scaling Activities"
jq -r '
  if (.ScalingActivities | length) == 0 then
    "- none"
  else
    .ScalingActivities[] |
    "- [\(.StatusCode)] \(.StartTime) :: \(.Description)\n  cause: \(.Cause)"
  end
' <<<"$scaling_activities_json"

if [ "$(jq '.TargetGroups | length' <<<"$target_groups_json")" -gt 0 ]; then
  echo
  echo "Target Groups"
  jq -r '.TargetGroups[] | "- \(.TargetGroupName) :: \(.TargetGroupArn)"' <<<"$target_groups_json"
fi

if [ "$(jq '.LoadBalancers | length' <<<"$load_balancers_json")" -gt 0 ]; then
  echo
  echo "Load Balancers"
  jq -r '.LoadBalancers[] | "- \(.LoadBalancerName) [\(.Scheme)] :: \(.DNSName)"' <<<"$load_balancers_json"
fi

declare -a urls=(
  "$apm_service_entity_url"
  "$apm_traces_url"
  "$logs_url"
  "$livetail_url"
  "$monitors_url"
  "$slo_url"
  "$ecs_health_url"
  "$ecs_scaling_url"
)

if [ -n "$DASHBOARD_URL" ]; then
  urls+=("$DASHBOARD_URL")
fi

while IFS= read -r tg_name; do
  [ -n "$tg_name" ] || continue
  urls+=("https://${AWS_REGION}.console.aws.amazon.com/ec2/home?region=${AWS_REGION}#TargetGroups:search=${tg_name};sort=targetGroupName")
done < <(jq -r '.TargetGroups[]?.TargetGroupName // empty' <<<"$target_groups_json")

while IFS= read -r lb_name; do
  [ -n "$lb_name" ] || continue
  urls+=("https://${AWS_REGION}.console.aws.amazon.com/ec2/home?region=${AWS_REGION}#LoadBalancers:search=${lb_name};sort=loadBalancerName")
done < <(jq -r '.LoadBalancers[]?.LoadBalancerName // empty' <<<"$load_balancers_json")

echo
echo "URLs"
printf '%s\n' "${urls[@]}"

if [ "$OPEN_URLS" -eq 1 ]; then
  open_urls "${urls[@]}"
fi
