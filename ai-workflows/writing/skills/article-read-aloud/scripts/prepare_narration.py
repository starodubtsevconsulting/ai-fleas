#!/usr/bin/env python3
"""Turn ordinary article Markdown into a plain-text narration script."""

from pathlib import Path
import re
import sys


def spoken_text(source: str) -> str:
    out: list[str] = []
    fence: str | None = None
    for raw in source.splitlines():
        line = raw.strip()
        if line.startswith("```"):
            if fence is None:
                fence = line[3:].strip()
                if fence == "mermaid":
                    out.append("[DIAGRAM DESCRIPTION REQUIRED BEFORE SYNTHESIS]")
                elif fence not in ("", "text"):
                    out.append("[CODE EXCERPT DESCRIPTION REQUIRED BEFORE SYNTHESIS]")
            else:
                fence = None
            continue
        if fence not in (None, "", "text"):
            continue
        if line.startswith("#"):
            line = line.lstrip("# ")
        if line.startswith(">"):
            line = line.lstrip("> ")
        line = re.sub(r"!\[([^]]*)\]\([^)]+\)", r"\1", line)
        line = re.sub(r"\[([^]]+)\]\([^)]+\)", r"\1", line)
        line = line.replace("**", "").replace("*", "").replace("`", "")
        line = line.replace("→", " then ")
        if line:
            out.append(line)
        elif out and out[-1] != "":
            out.append("")
    return "\n".join(out).strip() + "\n"


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: prepare_narration.py ARTICLE.md SPOKEN.txt")
    source = Path(sys.argv[1]).read_text(encoding="utf-8")
    Path(sys.argv[2]).write_text(spoken_text(source), encoding="utf-8")
