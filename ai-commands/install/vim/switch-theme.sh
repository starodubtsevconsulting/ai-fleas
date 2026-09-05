#!/usr/bin/env bash
set -euo pipefail

vimrc="$HOME/.vimrc"

list_themes() {
  local themes=()

  themes+=(default)

  if [ -d "$HOME/.vim/plugged" ]; then
    while IFS= read -r f; do
      base="$(basename "$f")"
      theme="${base%.vim}"
      [ -n "$theme" ] && themes+=("$theme")
    done < <(find "$HOME/.vim/plugged" -type f -path '*/colors/*.vim' 2>/dev/null || true)
  fi

  printf "%s\n" "${themes[@]}" | sort -u
}

pick_theme() {
  mapfile -t themes < <(list_themes)

  if [ ${#themes[@]} -eq 0 ]; then
    echo "No themes found." >&2
    exit 1
  fi

  echo "Available Vim themes:" >&2
  local i=1
  local t
  for t in "${themes[@]}"; do
    printf "  %d) %s\n" "$i" "$t" >&2
    i=$((i + 1))
  done

  echo "" >&2
  read -r -p "Switch to which theme? [1-${#themes[@]}]: " choice
  if ! [[ "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -lt 1 ] || [ "$choice" -gt "${#themes[@]}" ]; then
    echo "Invalid choice." >&2
    exit 1
  fi

  echo "${themes[$((choice - 1))]}"
}

theme="${1-}"
if [ -z "$theme" ]; then
  theme="$(pick_theme)"
fi

if [ ! -f "$vimrc" ]; then
  echo "Not found: $vimrc" >&2
  exit 1
fi

if grep -qE '^[[:space:]]*silent! colorscheme[[:space:]]+' "$vimrc"; then
  tmp="$(mktemp)"
  sed -E "s#^[[:space:]]*silent! colorscheme[[:space:]]+.*#silent! colorscheme ${theme}#" "$vimrc" > "$tmp"
  mv "$tmp" "$vimrc"
else
  {
    echo ""
    echo "silent! colorscheme ${theme}"
  } >> "$vimrc"
fi

echo "Vim theme set to: ${theme}"
