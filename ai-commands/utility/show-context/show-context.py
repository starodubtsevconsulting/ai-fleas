#!/usr/bin/env python3
"""Render bounded Markdown or source context as a human-readable HTML page."""

from __future__ import annotations

import argparse
import html
import re
import sys
import webbrowser
from pathlib import Path
from urllib.parse import quote


def file_url(path: Path) -> str:
    return "file://" + quote(str(path.resolve()))


def inline(text: str, source: Path) -> str:
    escaped = html.escape(text)
    escaped = re.sub(r"`([^`]+)`", r"<code>\1</code>", escaped)
    escaped = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", escaped)

    def link(match: re.Match[str]) -> str:
        label, raw_href = match.groups()
        href = html.unescape(raw_href).strip()
        if not re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", href) and not href.startswith("#"):
            href = file_url(source.parent / href)
        return f'<a href="{html.escape(href, quote=True)}">{label}</a>'

    return re.sub(r"\[([^]]+)]\(([^)]+)\)", link, escaped)


def highlighted(code: str, language: str) -> str:
    try:
        from pygments import highlight
        from pygments.formatters import HtmlFormatter
        from pygments.lexers import TextLexer, get_lexer_by_name

        try:
            lexer = get_lexer_by_name(language) if language else TextLexer()
        except Exception:
            lexer = TextLexer()
        return highlight(code, lexer, HtmlFormatter(nowrap=True, style="monokai"))
    except ImportError:
        return html.escape(code)


def highlighting_css() -> str:
    try:
        from pygments.formatters import HtmlFormatter

        return HtmlFormatter(style="monokai").get_style_defs("pre code")
    except ImportError:
        return ""


def code_block(code: str, language: str) -> str:
    language = re.sub(r"[^a-zA-Z0-9_+#.-]", "", language.strip().split(" ", 1)[0])
    if language.lower() == "mermaid":
        return (
            '<section class="diagram"><div class="mermaid">'
            + html.escape(code)
            + "</div><details><summary>Diagram source</summary><pre><code>"
            + html.escape(code)
            + "</code></pre></details></section>"
        )
    label = f'<div class="language">{html.escape(language)}</div>' if language else ""
    return f'{label}<pre><code class="language-{html.escape(language)}">{highlighted(code, language)}</code></pre>'


def markdown_body(text: str, source: Path) -> str:
    output: list[str] = []
    paragraph: list[str] = []
    code: list[str] = []
    language = ""
    in_code = False
    fence_char = ""
    fence_length = 0
    in_list = False

    def flush_paragraph() -> None:
        if paragraph:
            output.append("<p>" + " ".join(inline(line, source) for line in paragraph) + "</p>")
            paragraph.clear()

    def close_list() -> None:
        nonlocal in_list
        if in_list:
            output.append("</ul>")
            in_list = False

    for line in text.splitlines():
        fence = re.match(r"^(`{3,}|~{3,})(.*)$", line)
        closes_fence = (
            in_code
            and fence is not None
            and fence.group(1)[0] == fence_char
            and len(fence.group(1)) >= fence_length
            and not fence.group(2).strip()
        )
        if closes_fence:
            flush_paragraph()
            close_list()
            output.append(code_block("\n".join(code), language))
            code.clear()
            language = ""
            fence_char = ""
            fence_length = 0
            in_code = False
            continue
        if not in_code and fence is not None:
            flush_paragraph()
            close_list()
            fence_char = fence.group(1)[0]
            fence_length = len(fence.group(1))
            language = fence.group(2).strip()
            in_code = True
            continue
        if in_code:
            code.append(line)
            continue
        heading = re.match(r"^(#{1,6})\s+(.+)$", line)
        if heading:
            flush_paragraph()
            close_list()
            level = len(heading.group(1))
            output.append(f"<h{level}>{inline(heading.group(2), source)}</h{level}>")
            continue
        item = re.match(r"^\s*[-*]\s+(.+)$", line)
        if item:
            flush_paragraph()
            if not in_list:
                output.append("<ul>")
                in_list = True
            output.append("<li>" + inline(item.group(1), source) + "</li>")
            continue
        if in_list and line.strip() and output and output[-1].startswith("<li>"):
            output[-1] = output[-1][:-5] + " " + inline(line.strip(), source) + "</li>"
            continue
        if not line.strip():
            flush_paragraph()
            close_list()
        else:
            paragraph.append(line.strip())

    if in_code:
        output.append(code_block("\n".join(code), language))
    flush_paragraph()
    close_list()
    return "\n".join(output)


def document(source: Path, title: str, request: str) -> str:
    body = markdown_body(source.read_text(encoding="utf-8", errors="replace"), source)
    request_html = f'<div><strong>Question:</strong> {inline(request, source)}</div>' if request else ""
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(title)}</title>
<style>
{highlighting_css()}
body{{margin:0;background:#f5f7fa;color:#1f2933;font:16px/1.55 system-ui,sans-serif}}
main{{max-width:1000px;min-height:100vh;margin:auto;padding:32px;background:white}}
.meta{{color:#52606d;border-bottom:1px solid #d9e2ec;padding-bottom:16px}}
.diagram{{border:1px solid #d9e2ec;border-radius:8px;padding:16px;margin:18px 0}}
.mermaid{{display:flex;justify-content:center;overflow-x:auto}}
pre{{background:#101820;color:#f2f5f8;padding:16px;border-radius:6px;overflow:auto}}
code{{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}}
p code,li code{{background:#eef2f6;color:#243b53;padding:2px 4px;border-radius:4px}}
.language{{display:inline-block;background:#d9e2ec;padding:3px 8px;font:12px ui-monospace}}
a{{color:#0969da}} details{{margin-top:12px}} img{{max-width:100%}}
</style></head><body><main><div class="meta">{request_html}
<div><strong>Source:</strong> <a href="{html.escape(file_url(source), quote=True)}">{html.escape(str(source))}</a></div>
</div>{body}</main>
<script type="module">
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs";
mermaid.initialize({{startOnLoad:true,securityLevel:"strict",theme:"default"}});
</script></body></html>"""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", required=True, type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--title")
    parser.add_argument("--request", default="")
    parser.add_argument("--no-open", action="store_true")
    args = parser.parse_args()

    source = args.file.expanduser().resolve()
    if not source.is_file():
        parser.error(f"context file not found: {source}")
    output = (args.output or source.with_suffix(source.suffix + ".html")).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(document(source, args.title or source.name, args.request), encoding="utf-8")
    print(output)
    if not args.no_open and not webbrowser.open(file_url(output)):
        print(f"Could not open a browser; open this file manually: {output}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
