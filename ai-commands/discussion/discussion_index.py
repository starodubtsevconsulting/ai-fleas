#!/usr/bin/env python3
"""Local conversation-history index for discussion.command.sh.

Uses a local SQLite database with a small token table as the deterministic
"OpenSearch-like" second layer over prepared conversation artifacts. The index
is visible, rebuildable, and has no daemon or external service runtime.
"""
from __future__ import annotations

import argparse
import json
import re
import sqlite3
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

TEXT_SUFFIXES = {".md", ".txt", ".vtt", ".srt", ".log"}
SKIP_PARTS = {"node_modules", "dist", "build", "target", ".git", "__pycache__", "_index", ".conversation-index"}
PATTERNS = ("summary.md", "*-feature.md", "*.txt", "*.md")
STOP_TERMS = {"the", "that", "this", "with", "from", "about", "feature", "conversation", "discussion", "thing", "summary"}
SCHEMA_VERSION = "conversation-index-v2"


@dataclass
class SearchPlan:
    query: str
    terms: list[str]
    variants: set[str]
    phrases: list[str]


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def ts_iso(ts: float | None) -> str:
    if ts is None:
        return ""
    return datetime.fromtimestamp(ts, timezone.utc).replace(microsecond=0).isoformat()


def build_search_plan(query: str) -> SearchPlan:
    raw_terms = [term for term in re.split(r"[^a-z0-9]+", query.lower()) if term]
    terms = [term for term in raw_terms if term not in STOP_TERMS] or raw_terms
    variants = set(terms)
    for term in list(terms):
        if term.endswith("s") and len(term) > 3:
            variants.add(term[:-1])
        else:
            variants.add(term + "s")
        if term == "tag":
            variants.update({"tags", "tagged", "tagging"})
        if term == "config":
            variants.update({"configuration", "configs"})
    phrases: list[str] = []
    query_lower = query.lower().strip()
    if query_lower:
        phrases.append(query_lower)
    for size in range(min(4, len(terms)), 1, -1):
        for idx in range(0, len(terms) - size + 1):
            phrase = " ".join(terms[idx : idx + size])
            if phrase not in phrases:
                phrases.append(phrase)
    return SearchPlan(query=query, terms=terms, variants=variants, phrases=phrases)


def token_set(value: str) -> set[str]:
    return {part for part in re.split(r"[^a-z0-9]+", value.lower()) if part}


def extract_index_terms(title: str, relative_path: str, path: Path, text: str) -> set[str]:
    terms = token_set(title)
    terms.update(token_set(relative_path))
    terms.update(token_set(path.name))
    terms.update(token_set(text))
    expanded = set(terms)
    for term in terms:
        if term.endswith("s") and len(term) > 3:
            expanded.add(term[:-1])
        elif len(term) > 2:
            expanded.add(term + "s")
        if term in {"tag", "tags", "tagged", "tagging"}:
            expanded.update({"tag", "tags", "tagged", "tagging"})
        if term in {"config", "configs", "configuration"}:
            expanded.update({"config", "configs", "configuration"})
    return {term for term in expanded if len(term) > 1}


def term_matches_text(value: str, term: str) -> bool:
    lowered = value.lower()
    if term in {"tag", "tags", "tagged", "tagging"}:
        return re.search(rf"(?<!e-)\b{re.escape(term)}\b", lowered) is not None
    return re.search(rf"\b{re.escape(term)}\b", lowered) is not None


def term_matches_path(value: str, term: str) -> bool:
    return term in token_set(value)


def add_roots(paths: list[str]) -> list[tuple[Path, str]]:
    roots: list[tuple[Path, str]] = []
    for raw in paths:
        if not raw:
            continue
        path = Path(raw).expanduser()
        if not path.exists() or not path.is_dir():
            continue
        resolved = path.resolve()
        if any(existing == resolved for existing, _ in roots):
            continue
        label = "zoom-indexed" if resolved.name == "indexed" and resolved.parent.name == "Zoom" else resolved.name
        roots.append((resolved, label))
    return roots


def candidate_files(root: Path):
    seen: set[Path] = set()
    for pattern in PATTERNS:
        for path in root.rglob(pattern):
            if path in seen or not path.is_file():
                continue
            seen.add(path)
            if path.suffix.lower() not in TEXT_SUFFIXES:
                continue
            if any(part in SKIP_PARTS for part in path.parts):
                continue
            if path.name.endswith(".state.json"):
                continue
            yield path


def newest_source_file(roots: list[tuple[Path, str]]) -> dict:
    newest_path = ""
    newest_mtime = 0.0
    count = 0
    for root, _label in roots:
        for path in candidate_files(root):
            count += 1
            try:
                mtime = path.stat().st_mtime
            except OSError:
                continue
            if mtime > newest_mtime:
                newest_mtime = mtime
                newest_path = str(path)
    return {
        "file_count": count,
        "latest_source_path": newest_path,
        "latest_source_mtime": newest_mtime,
        "latest_source_updated_at": ts_iso(newest_mtime) if newest_mtime else "",
    }


def title_for(text: str, path: Path) -> str:
    for line in text.splitlines()[:50]:
        if line.startswith("# "):
            return line[2:].strip()
    if path.name == "summary.md":
        return path.parent.name.replace("-", " ")
    return path.stem.replace("-", " ")


def source_kind(path: Path) -> str:
    if path.name == "summary.md":
        return "conversation-summary"
    if path.name.endswith("-feature.md"):
        return "conversation-feature"
    return "conversation-source"


def path_relative_to(path: Path, root: Path) -> str:
    try:
        return str(path.relative_to(root))
    except Exception:
        return str(path)


def canonical_path(path: Path) -> Path:
    summary = path.parent / "summary.md"
    if summary.exists():
        return summary
    return path


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def init_db(conn: sqlite3.Connection) -> None:
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute(
        "CREATE TABLE IF NOT EXISTS docs ("
        "path TEXT PRIMARY KEY, canonical_path TEXT NOT NULL, kind TEXT NOT NULL, label TEXT NOT NULL, "
        "title TEXT NOT NULL, relative_path TEXT NOT NULL, mtime REAL NOT NULL, size INTEGER NOT NULL, content TEXT NOT NULL)"
    )
    conn.execute("CREATE TABLE IF NOT EXISTS docs_terms (term TEXT NOT NULL, path TEXT NOT NULL, PRIMARY KEY(term, path))")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_docs_terms_path ON docs_terms(path)")
    try:
        conn.execute(
            "CREATE VIRTUAL TABLE IF NOT EXISTS docs_fts USING fts5("
            "title, content, path UNINDEXED, canonical_path UNINDEXED, kind UNINDEXED, label UNINDEXED, relative_path UNINDEXED)"
        )
    except sqlite3.OperationalError as exc:
        raise SystemExit(f"SQLite FTS5 is not available: {exc}") from exc
    conn.execute("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)")


def manifest_paths(db_path: Path) -> tuple[Path, Path]:
    return db_path.parent / "index-manifest.json", db_path.parent / "index-manifest.md"


def write_manifest(db_path: Path, roots: list[tuple[Path, str]], result: dict) -> None:
    json_path, md_path = manifest_paths(db_path)
    manifest = {
        "schema": SCHEMA_VERSION,
        "updated_at": result.get("updated_at") or utc_now(),
        "db": str(db_path),
        "manifest_json": str(json_path),
        "manifest_md": str(md_path),
        "roots": [{"path": str(root), "label": label} for root, label in roots],
        "indexed_files": result.get("indexed", 0),
        "skipped_files": result.get("skipped", 0),
        "elapsed_ms": result.get("elapsed_ms"),
        "latest_source_path": result.get("latest_source_path", ""),
        "latest_source_updated_at": result.get("latest_source_updated_at", ""),
        "source_kind": "local-sqlite-token-index",
        "benchmark_note": "Local benchmark showed broad tag queries about 2x faster and specific multi-term queries about 5x-18x faster than direct scan, with the same top results in tested cases.",
        "notes": [
            "This is a local, rebuildable SQLite index over prepared conversation artifacts.",
            "Prep/index is the first layer: folders under ~/Documents/Zoom/indexed/ with summary.md and *-feature.md.",
            "This _index folder is the second lookup layer used by lookup-conversation when present.",
            "Current/live meetings are not indexed until prep-conversation runs after the meeting.",
        ],
    }
    json_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    lines = [
        "# Conversation Search Index",
        "",
        f"- Updated: `{manifest['updated_at']}`",
        f"- Schema: `{SCHEMA_VERSION}`",
        f"- Database: `{db_path}`",
        f"- Indexed files: `{manifest['indexed_files']}`",
        f"- Skipped files: `{manifest['skipped_files']}`",
        f"- Elapsed: `{manifest['elapsed_ms']} ms`",
        f"- Latest indexed source: `{manifest['latest_source_updated_at'] or 'n/a'}`",
        f"- Latest indexed source path: `{manifest['latest_source_path'] or 'n/a'}`",
        "",
        "## What This Means",
        "",
        "This folder is the visible local search index for prepared conversation history. It is similar in purpose to a tiny local OpenSearch layer, but implemented with SQLite so it stays transparent and rebuildable.",
        "",
        "`prep-conversation` creates or refreshes prepared folders first. `index-conversations` then refreshes this `_index/` folder so `lookup-conversation` can narrow candidates before scoring them deterministically.",
        "",
        "Current/live meetings are intentionally not listed here until they are prepared after the meeting. Use `current-conversation --summary --show` for live follow-up.",
        "",
        "## Why This Exists",
        "",
        "We benchmarked this against direct file scanning before keeping it. Broad queries such as `tag feature` were about 2x faster because tag language is common. Specific multi-term queries such as `tag config deployment`, `oem config id`, and `autoscaling latency` were about 5x-18x faster and scored far fewer rows while preserving the same top results in tested cases.",
        "",
        "The goal is not to make search clever for its own sake. The goal is to reduce repeated agent file scanning and make the human-facing result list less noisy.",
        "",
        "## Indexed Roots",
        "",
    ]
    for root in manifest["roots"]:
        lines.append(f"- `{root['label']}`: `{root['path']}`")
    lines.extend([
        "",
        "## Files",
        "",
        f"- SQLite DB: [`{db_path.name}`]({db_path.name})",
        f"- JSON manifest: [`{json_path.name}`]({json_path.name})",
        f"- Markdown manifest: [`{md_path.name}`]({md_path.name})",
        "",
        "## How To Refresh",
        "",
        "```bash",
        "./commands/discussion/discussion.command.sh index-conversations",
        "./commands/discussion/discussion.command.sh lookup-conversation --query \"tag feature\" --reindex",
        "```",
        "",
    ])
    md_path.write_text("\n".join(lines), encoding="utf-8")


def rebuild_index(db_path: Path, roots: list[tuple[Path, str]]) -> dict:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    started = time.perf_counter()
    conn = sqlite3.connect(db_path)
    updated_at = utc_now()
    try:
        init_db(conn)
        conn.execute("DELETE FROM docs")
        conn.execute("DELETE FROM docs_terms")
        conn.execute("DELETE FROM docs_fts")
        indexed = 0
        skipped = 0
        with conn:
            for root, label in roots:
                for path in candidate_files(root):
                    try:
                        text = read_text(path)
                    except Exception:
                        skipped += 1
                        continue
                    stat = path.stat()
                    canonical = canonical_path(path)
                    title = title_for(text, path)
                    kind = source_kind(path)
                    rel = path_relative_to(path, root)
                    conn.execute(
                        "INSERT OR REPLACE INTO docs(path, canonical_path, kind, label, title, relative_path, mtime, size, content) "
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        (str(path), str(canonical), kind, label, title, rel, stat.st_mtime, stat.st_size, text),
                    )
                    rowid = conn.execute("SELECT rowid FROM docs WHERE path = ?", (str(path),)).fetchone()[0]
                    conn.execute("DELETE FROM docs_fts WHERE path = ?", (str(path),))
                    conn.execute(
                        "INSERT INTO docs_fts(rowid, title, content, path, canonical_path, kind, label, relative_path) "
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                        (rowid, title, text, str(path), str(canonical), kind, label, rel),
                    )
                    terms = extract_index_terms(title, rel, path, text)
                    conn.executemany(
                        "INSERT OR IGNORE INTO docs_terms(term, path) VALUES (?, ?)",
                        [(term, str(path)) for term in terms],
                    )
                    indexed += 1
            conn.execute("INSERT OR REPLACE INTO meta(key, value) VALUES ('schema', ?)", (SCHEMA_VERSION,))
            conn.execute("INSERT OR REPLACE INTO meta(key, value) VALUES ('roots', ?)", (json.dumps([str(r) for r, _ in roots]),))
            conn.execute("INSERT OR REPLACE INTO meta(key, value) VALUES ('updated_at', ?)", (updated_at,))
            conn.execute("INSERT OR REPLACE INTO meta(key, value) VALUES ('doc_count', ?)", (str(indexed),))
        elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
        newest = newest_source_file(roots)
        result = {
            "db": str(db_path),
            "indexed": indexed,
            "skipped": skipped,
            "elapsed_ms": elapsed_ms,
            "updated_at": updated_at,
            **newest,
        }
        write_manifest(db_path, roots, result)
        return result
    finally:
        conn.close()


def index_freshness(db_path: Path, roots: list[tuple[Path, str]]) -> dict:
    manifest_json, manifest_md = manifest_paths(db_path)
    newest = newest_source_file(roots)
    if not db_path.exists():
        return {"status": "missing", "reason": "database-missing", **newest}
    if not manifest_json.exists() or not manifest_md.exists():
        return {"status": "missing", "reason": "manifest-missing", **newest}
    index_mtime = min(db_path.stat().st_mtime, manifest_json.stat().st_mtime, manifest_md.stat().st_mtime)
    latest_source_mtime = float(newest.get("latest_source_mtime") or 0.0)
    if latest_source_mtime > index_mtime + 0.001:
        return {
            "status": "stale",
            "reason": "prepared-source-newer-than-index",
            "index_updated_at": ts_iso(index_mtime),
            **newest,
        }
    return {
        "status": "fresh",
        "reason": "index-covers-prepared-sources",
        "index_updated_at": ts_iso(index_mtime),
        **newest,
    }


def ensure_index(db_path: Path, roots: list[tuple[Path, str]], rebuild: bool = False) -> dict | None:
    freshness = index_freshness(db_path, roots)
    if rebuild:
        result = rebuild_index(db_path, roots)
        result["reason"] = "forced-rebuild"
        return result
    if freshness["status"] == "stale":
        result = rebuild_index(db_path, roots)
        result["reason"] = freshness.get("reason", freshness["status"])
        return result
    return None


def term_variants_for(term: str) -> set[str]:
    variants = {term}
    if term.endswith("s") and len(term) > 3:
        variants.add(term[:-1])
    elif len(term) > 2:
        variants.add(term + "s")
    if term in {"tag", "tags", "tagged", "tagging"}:
        variants.update({"tag", "tags", "tagged", "tagging"})
    if term in {"config", "configs", "configuration"}:
        variants.update({"config", "configs", "configuration"})
    return variants


def evidence_from_text(text: str, plan: SearchPlan, max_items: int = 4) -> list[dict]:
    evidence = []
    in_tags_section = False
    for line_no, line in enumerate(text.splitlines(), start=1):
        stripped = line.strip()
        lowered = stripped.lower()
        heading = re.match(r"^#{1,6}\s+(.+?)\s*$", stripped)
        if heading:
            in_tags_section = heading.group(1).strip().lower() == "tags"
            if in_tags_section:
                continue
        if in_tags_section:
            continue
        if not stripped:
            continue
        reasons = []
        for phrase in plan.phrases:
            if phrase and phrase in lowered:
                reasons.append(f"phrase:{phrase}")
        for term in sorted(plan.variants):
            if term_matches_text(lowered, term):
                reasons.append(f"term:{term}")
        if reasons:
            evidence.append({"line": line_no, "text": stripped[:260], "reasons": reasons[:5]})
            if len(evidence) >= max_items:
                break
    return evidence


def manual_score(path: Path, title: str, text: str, plan: SearchPlan) -> tuple[int, list[dict]]:
    title_l = title.lower()
    path_l = str(path).lower()
    text_l = text.lower()
    score = 0
    for phrase in plan.phrases:
        if phrase in title_l:
            score += 60
        if phrase in path_l:
            score += 45
        if phrase in text_l:
            score += 20
    for term in plan.variants:
        if term_matches_text(title_l, term):
            score += 18
        if term_matches_path(path_l, term):
            score += 10

    concept_hits = 0
    for term in plan.terms:
        variants = term_variants_for(term)
        if any(term_matches_text(title_l, variant) or term_matches_text(text_l, variant) or term_matches_path(path_l, variant) for variant in variants):
            concept_hits += 1
    if concept_hits:
        score += concept_hits * 24
    if plan.terms and concept_hits == len(plan.terms):
        score += 40

    evidence = []
    for ev in evidence_from_text(text, plan):
        line_score = 0
        for reason in ev["reasons"]:
            if reason.startswith("phrase:"):
                line_score += 35
            elif reason.startswith("term:"):
                line_score += 5
        if path.name == "summary.md":
            line_score += 10
        if path.name.endswith("-feature.md"):
            line_score += 6
        if ev["line"] < 90:
            line_score += 2
        score += line_score
        evidence.append(ev)
    if path.name == "summary.md":
        score += 18
    elif path.name.endswith("-feature.md"):
        score += 10
    else:
        score += 2
    return score, evidence


def canonicalize_results(results: list[dict], plan: SearchPlan, limit: int) -> list[dict]:
    canonical_results: dict[str, dict] = {}
    for result in results:
        path = Path(result["path"])
        canonical = Path(result.get("canonical_path") or canonical_path(path))
        key = str(canonical)
        if key not in canonical_results:
            item = dict(result)
            item["path"] = key
            item.pop("canonical_path", None)
            item["kind"] = source_kind(canonical)
            if canonical != path:
                try:
                    canonical_text = read_text(canonical)
                    item["title"] = title_for(canonical_text, canonical)
                    item["score"] += 25
                except Exception:
                    pass
            canonical_results[key] = item
            continue
        existing = canonical_results[key]
        existing["score"] = max(existing["score"], result["score"] + 10)
        for ev in result.get("evidence", []):
            if len(existing["evidence"]) >= 4:
                break
            if ev not in existing["evidence"]:
                existing["evidence"].append(ev)
    ranked = list(canonical_results.values())
    ranked.sort(key=lambda item: (-int(item["score"]), item["path"]))
    return ranked[:limit]


def scan_lookup(roots: list[tuple[Path, str]], plan: SearchPlan, limit: int) -> list[dict]:
    results = []
    for root, label in roots:
        for path in candidate_files(root):
            try:
                text = read_text(path)
            except Exception:
                continue
            title = title_for(text, path)
            score, evidence = manual_score(path, title, text, plan)
            if score <= 0:
                continue
            results.append(
                {
                    "score": score,
                    "kind": source_kind(path),
                    "label": label,
                    "title": title,
                    "path": str(path),
                    "relative_path": path_relative_to(path, root),
                    "evidence": evidence,
                    "source": "scan",
                }
            )
    return canonicalize_results(results, plan, limit)


def paths_for_terms(conn: sqlite3.Connection, terms: set[str]) -> set[str]:
    clean_terms = sorted(term for term in terms if term)
    if not clean_terms:
        return set()
    placeholders = ",".join("?" for _ in clean_terms)
    rows = conn.execute(
        f"SELECT DISTINCT path FROM docs_terms WHERE term IN ({placeholders}) ORDER BY path",
        clean_terms,
    ).fetchall()
    return {row[0] for row in rows}


def candidate_paths_from_terms(conn: sqlite3.Connection, plan: SearchPlan) -> tuple[list[str], str]:
    concept_sets: list[set[str]] = []
    for term in plan.terms:
        paths = paths_for_terms(conn, term_variants_for(term))
        if paths:
            concept_sets.append(paths)
    if len(concept_sets) >= 2:
        intersection = set.intersection(*concept_sets)
        if intersection:
            return sorted(intersection), "token-intersection"
        rarest = sorted(concept_sets, key=len)[:2]
        return sorted(set.union(*rarest)), "token-rarest-union"
    if concept_sets:
        return sorted(concept_sets[0]), "token-candidates"
    fallback = paths_for_terms(conn, plan.variants)
    if fallback:
        return sorted(fallback), "token-candidates"
    return [], "all-rows-fallback"


def index_lookup(db_path: Path, roots: list[tuple[Path, str]], plan: SearchPlan, limit: int) -> tuple[list[dict], dict]:
    started = time.perf_counter()
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        init_db(conn)
        candidate_paths, candidate_mode = candidate_paths_from_terms(conn, plan)
        if candidate_paths:
            placeholders = ",".join("?" for _ in candidate_paths)
            rows = conn.execute(
                f"SELECT path, canonical_path, kind, label, title, relative_path, content FROM docs WHERE path IN ({placeholders})",
                candidate_paths,
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT path, canonical_path, kind, label, title, relative_path, content FROM docs"
            ).fetchall()
            candidate_mode = "all-rows-fallback"
        results = []
        for row in rows:
            path = Path(row["path"])
            text = row["content"]
            score, evidence = manual_score(path, row["title"], text, plan)
            if score <= 0:
                continue
            results.append(
                {
                    "score": score,
                    "kind": row["kind"],
                    "label": row["label"],
                    "title": row["title"],
                    "path": row["path"],
                    "canonical_path": row["canonical_path"],
                    "relative_path": row["relative_path"],
                    "evidence": evidence,
                    "source": "sqlite-index",
                }
            )
        elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
        return canonicalize_results(results, plan, limit), {
            "source": "sqlite-index",
            "elapsed_ms": elapsed_ms,
            "db": str(db_path),
            "candidate_mode": candidate_mode,
            "candidate_rows_scored": len(rows),
            "candidate_terms": sorted(plan.variants),
        }
    finally:
        conn.close()


def print_results(query: str, results: list[dict], metadata: dict, json_output: bool) -> None:
    payload = {"query": query, "count": len(results), "metadata": metadata, "results": results}
    if json_output:
        print(json.dumps(payload, indent=2))
        return
    print(f"Conversation lookup: {query}")
    print(f"Results: {len(results)}")
    if metadata:
        source = metadata.get("source") or metadata.get("mode")
        elapsed = metadata.get("elapsed_ms")
        db = metadata.get("db")
        if source or elapsed is not None:
            print(f"Lookup source: {source or 'unknown'}" + (f" ({elapsed} ms)" if elapsed is not None else ""))
        if db:
            print(f"Index: {db}")
        if metadata.get("fallback_reason"):
            print(f"Fallback reason: {metadata.get('fallback_reason')}")
        if metadata.get("candidate_mode"):
            print(f"Candidate mode: {metadata.get('candidate_mode')} ({metadata.get('candidate_rows_scored')} rows scored)")
        if metadata.get("index_freshness"):
            freshness = metadata["index_freshness"]
            print(f"Index freshness: {freshness.get('status')} ({freshness.get('reason')})")
            if freshness.get("latest_source_updated_at"):
                print(f"Latest indexed source: {freshness.get('latest_source_updated_at')} {freshness.get('latest_source_path')}")
        if metadata.get("index_rebuilt"):
            rebuilt = metadata["index_rebuilt"]
            print(f"Index rebuilt: {rebuilt.get('reason', 'yes')} ({rebuilt.get('indexed')} files, {rebuilt.get('elapsed_ms')} ms)")
    for idx, result in enumerate(results, start=1):
        print(f"\n{idx}. score={result['score']} kind={result['kind']} label={result['label']}")
        print(f"   title: {result['title']}")
        print(f"   path: {result['path']}")
        for ev in result.get("evidence", [])[:3]:
            print(f"   line {ev['line']}: {ev['text']}")
    if results:
        print(f"\nTOP_RESULT={results[0]['path']}")


def default_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["index", "lookup"])
    parser.add_argument("--db", required=True)
    parser.add_argument("--root", action="append", default=[])
    parser.add_argument("--query", default="")
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--rebuild", action="store_true")
    parser.add_argument("--no-index", action="store_true")
    return parser


def main(argv: list[str]) -> int:
    args = default_parser().parse_args(argv)
    db_path = Path(args.db).expanduser()
    roots = add_roots(args.root)
    if args.action == "index":
        result = rebuild_index(db_path, roots)
        manifest_json, manifest_md = manifest_paths(db_path)
        result["manifest_json"] = str(manifest_json)
        result["manifest_md"] = str(manifest_md)
        if args.json:
            print(json.dumps(result, indent=2))
        else:
            print(f"Conversation index: {result['db']}")
            print(f"Manifest JSON: {manifest_json}")
            print(f"Manifest Markdown: {manifest_md}")
            print(f"Indexed files: {result['indexed']}")
            print(f"Skipped files: {result['skipped']}")
            print(f"Elapsed: {result['elapsed_ms']} ms")
        return 0
    if not args.query.strip():
        raise SystemExit("Missing --query for lookup")
    plan = build_search_plan(args.query)
    metadata: dict
    if args.no_index:
        started = time.perf_counter()
        results = scan_lookup(roots, plan, args.limit)
        metadata = {"source": "scan", "elapsed_ms": round((time.perf_counter() - started) * 1000, 2)}
    else:
        freshness_before = index_freshness(db_path, roots)
        index_result = ensure_index(db_path, roots, rebuild=args.rebuild)
        freshness_after = index_freshness(db_path, roots)
        if freshness_after["status"] == "missing" and not args.rebuild:
            started = time.perf_counter()
            results = scan_lookup(roots, plan, args.limit)
            metadata = {
                "source": "scan-fallback",
                "elapsed_ms": round((time.perf_counter() - started) * 1000, 2),
                "fallback_reason": freshness_after.get("reason", "index-missing"),
                "index_freshness": freshness_after,
            }
        else:
            try:
                results, metadata = index_lookup(db_path, roots, plan, args.limit)
                metadata["index_freshness"] = freshness_after
                metadata["index_freshness_before"] = freshness_before
            except Exception as exc:
                started = time.perf_counter()
                results = scan_lookup(roots, plan, args.limit)
                metadata = {
                    "source": "scan-fallback",
                    "elapsed_ms": round((time.perf_counter() - started) * 1000, 2),
                    "fallback_reason": str(exc),
                    "index_freshness": freshness_after,
                }
        if index_result:
            metadata["index_rebuilt"] = index_result
    print_results(args.query, results, metadata, args.json)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
