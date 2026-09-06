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


# Print review threads for a PR on GHE.
# Usage:
#   ${AI_COMMANDS_ROOT}/pr-review-threads/pr-review-threads.command-script.sh <owner> <repo> <pr-number|branch> [token]
# Notes:
#   - If the 3rd arg is numeric, it is treated as a PR number.
#   - Otherwise it is treated as a branch name and the script finds the PR for
#     that head (prefers OPEN, then MERGED/CLOSED).
#   - Token: via arg or env GITHUB_TOKEN/GHE_TOKEN/GH_TOKEN.

OWNER="${1:-}"
REPO="${2:-}"
REF="${3:-}"
TOKEN="${4:-${GITHUB_TOKEN:-${GHE_TOKEN:-${GH_TOKEN:-}}}}"
API_URL="${GHE_API_URL:-https://api.github.com/graphql}"

if [[ -z "$OWNER" || -z "$REPO" || -z "$REF" ]]; then
  echo "Usage: $0 <owner> <repo> <pr-number|branch> [token]" >&2
  exit 1
fi

if [[ -z "$TOKEN" ]]; then
  echo "Missing token (pass as arg or set GITHUB_TOKEN/GHE_TOKEN/GH_TOKEN)" >&2
  exit 1
fi

for bin in jq curl; do
  command -v "$bin" >/dev/null 2>&1 || { echo "Missing dependency: $bin" >&2; exit 1; }
done

if [[ "$REF" =~ ^[0-9]+$ ]]; then
  HAS_NUMBER=true
  PR_NUMBER="$REF"
  BRANCH=""
  read -r -d '' QUERY <<'EOF' || true
query($owner:String!, $name:String!, $number:Int!) {
  repository(owner:$owner, name:$name) {
    pr: pullRequest(number:$number) {
      number
      title
      author { login }
      comments(last:50) {
        nodes {
          author { login }
          body
          url
          createdAt
        }
      }
      reviewThreads(first:50) {
        nodes {
          isResolved
          comments: comments(first:50) {
            nodes {
              author { login }
              body
              url
              createdAt
            }
          }
        }
      }
    }
  }
}
EOF
  PAYLOAD="$(jq -n \
    --arg owner "$OWNER" \
    --arg name "$REPO" \
    --argjson number "$PR_NUMBER" \
    --arg query "$QUERY" \
    '{query:$query, variables:{owner:$owner, name:$name, number:$number}}')"
else
  HAS_NUMBER=false
  PR_NUMBER=null
  BRANCH="$REF"
  read -r -d '' QUERY <<'EOF' || true
query($owner:String!, $name:String!, $branch:String!) {
  repository(owner:$owner, name:$name) {
    prOpen: pullRequests(first:1, headRefName:$branch, states:[OPEN]) {
      nodes {
        number
        title
        author { login }
        comments(last:50) {
          nodes {
            author { login }
            body
            url
            createdAt
          }
        }
        reviewThreads(first:50) {
          nodes {
            isResolved
            comments: comments(first:50) {
              nodes {
                author { login }
                body
                url
                createdAt
              }
            }
          }
        }
      }
    }
    prClosed: pullRequests(first:1, headRefName:$branch, states:[MERGED,CLOSED]) {
      nodes {
        number
        title
        author { login }
        comments(last:50) {
          nodes {
            author { login }
            body
            url
            createdAt
          }
        }
        reviewThreads(first:50) {
          nodes {
            isResolved
            comments: comments(first:50) {
              nodes {
                author { login }
                body
                url
                createdAt
              }
            }
          }
        }
      }
    }
  }
}
EOF
  PAYLOAD="$(jq -n \
    --arg owner "$OWNER" \
    --arg name "$REPO" \
    --arg branch "$BRANCH" \
    --arg query "$QUERY" \
    '{query:$query, variables:{owner:$owner, name:$name, branch:$branch}}')"
fi

RESP="$(curl -sSf \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  "$API_URL")"

echo "$RESP" | jq -r --arg ref "$REF" '
  .data.repository as $repo
  | (if $repo.pr then $repo.pr else
       (if (($repo.prOpen.nodes // [])|length)>0 then $repo.prOpen.nodes[0]
        elif (($repo.prClosed.nodes // [])|length)>0 then $repo.prClosed.nodes[0]
        else null end)
     end) as $pr
  | if ($pr == null) then
      "No pull request found for input: \($ref)"
    else
      ($pr.reviewThreads.nodes // []) as $threads
      | ($pr.comments.nodes // []) as $comments
      | ($threads | map(select(.isResolved==false))) as $openThreads
      | ($threads | map(select(.isResolved==true))) as $resolvedThreads
      | ($comments | map(select(.author.login != $pr.author.login))) as $topLevelOther
      | ($comments | map(select(.author.login == $pr.author.login))) as $topLevelAuthor
      | def fmtThread:
          "thread (started by @" + (.comments.nodes[0].author.login // "unknown")
          + " at " + (.comments.nodes[0].createdAt // "unknown") + ")\n"
          + (
            .comments.nodes
            | to_entries
            | map(
                (if .key==0 then "  " else "    " end)
                + "@" + (.value.author.login // "unknown") + " | " + (.value.createdAt // "") + "\n"
                + (if .key==0 then "    " else "      " end)
                + ((.value.body // "" | gsub("\r";"") | gsub("\n";"\n"+(if .key==0 then "    " else "      " end))))
                + (if (.value.url // "") != "" then "\n" + (if .key==0 then "    " else "      " end) + (.value.url // "") else "" end)
              )
            | join("\n")
          ) ;
        def fmtTop:
          "- @" + (.author.login // "unknown")
          + " | " + (.createdAt // "") + "\n  "
          + ((.body // "" | gsub("\r";"") | gsub("\n";"\n  ")))
          + "\n  " + (.url // "");
        def sectionThreads(title; items):
          title + (
            if (items|length)==0 then "\n  (none)"
            else
              "\n" +
              (items
                | to_entries
                | map(
                    ((.key+1|tostring) + ". ")
                    + ((.value | fmtThread) | gsub("\n"; "\n   "))
                  )
                | join("\n")
              )
            end
          );
        def sectionTop(title; items):
          title + (if (items|length)==0 then "\n  (none)" else "\n" + (items|map(.|fmtTop)|join("\n")) end);
        sectionThreads("Open threads:"; $openThreads),
        "",
        sectionThreads("Resolved threads:"; $resolvedThreads),
        "",
        sectionTop("Top-level comments (others):"; $topLevelOther),
        "",
        sectionTop("Top-level comments (author):"; $topLevelAuthor)
    end
'
