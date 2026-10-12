#!/usr/bin/env python3
"""Score a model's JSON response against the fictional Q4 search answer key."""

import argparse
import json
import sys
from decimal import Decimal, InvalidOperation
from pathlib import Path

HERE = Path(__file__).resolve().parent
ORACLE_PATH = HERE / "expected.json"


def _decimal(value, label, errors):
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        errors.append(f"{label}: expected a decimal amount, got {value!r}")
        return None


def evaluate(response, oracle=None):
    """Return (passed checks, total checks, diagnostics) for one parsed object."""
    if oracle is None:
        oracle = json.loads(ORACLE_PATH.read_text())
    errors = []
    checks = 0

    def check(condition, message):
        nonlocal checks
        checks += 1
        if not condition:
            errors.append(message)

    if not isinstance(response, dict):
        return 0, 1, ["response must be a JSON object"]

    requested = set(oracle["businesses"])
    searched = response.get("searched")
    searched_pairs = set()
    if isinstance(searched, list):
        for item in searched:
            if isinstance(item, dict) and isinstance(item.get("sections"), list):
                searched_pairs.update((item.get("business"), section) for section in item["sections"])
    for business in sorted(requested):
        for section in ("in", "out", "statements"):
            check((business, section) in searched_pairs,
                  f"searched must include {business}/{section}")

    documents = oracle["documents"]
    expected_by_source = {item["source"]: item for item in documents}
    response_records = response.get("records")
    records = {}
    if isinstance(response_records, list):
        for item in response_records:
            if isinstance(item, dict) and isinstance(item.get("source"), str):
                if item["source"] in records:
                    errors.append(f"duplicate response record for source {item['source']}")
                    checks += 1
                records[item["source"]] = item
    for expected in documents:
        ref = expected["ref"]
        got = records.get(expected["source"])
        check(got is not None, f"missing source record {ref} at {expected['source']}")
        if got is None:
            continue
        for key, expected_key in (("kind", "kind"), ("business", "to"),
                                  ("folder_business", "business"), ("source", "source"),
                                  ("currency", None)):
            if key == "currency":
                value = "CAD"
            elif key == "business" and expected["kind"] == "customer-invoice":
                value = expected["from"].replace(" (fictional)", "")
            else:
                value = expected[expected_key]
            if key == "business":
                value = value.replace(" (fictional)", "")
            check(got.get(key) == value, f"{ref}: {key} should be {value!r}")
        check(_decimal(got.get("amount"), f"{ref}.amount", errors) == Decimal(expected["amount"]),
              f"{ref}: amount should be {expected['amount']}")
        if expected["section"] == "in" or expected["kind"] in ("vendor-invoice", "vendor-credit-note", "duplicate-copy"):
            check(got.get("page") == 1, f"{ref}: cite PDF page 1")
        citations = got.get("citations")
        citations = citations if isinstance(citations, list) else []
        check(any(expected["source"] in str(c) and "page 1" in str(c).lower() for c in citations),
              f"{ref}: missing source PDF page citation")

        status = str(got.get("payment_status", "")).lower()
        expected_status = expected["status"].lower()
        if expected["kind"] == "customer-invoice":
            expected_status = oracle["search_answers"]["customer_invoices"][ref]["payment_status"].lower()
        if expected_status == "statement payment matched" or expected_status == "payment matched in statement":
            check("matched" in status or "evidenced" in status,
                  f"{ref}: payment status must reflect matched statement evidence")
        elif expected_status == "explicitly unpaid":
            check("unpaid" in status and "no evidence" not in status,
                  f"{ref}: distinguish explicit unpaid from missing payment evidence")
        elif expected_status == "payment status not shown":
            check("not shown" in status or "no matching payment evidence" in status,
                  f"{ref}: do not claim a payment status not shown by evidence")
        elif expected_status == "credit applied and refund matched":
            check("credit" in status and "refund" in status,
                  f"{ref}: identify the credit and matched refund separately")
        elif expected_status.startswith("duplicate;"):
            check("duplicate" in status and "exclude" in status,
                  f"{ref}: identify and exclude the misplaced duplicate")

    # Every response citation to a statement must identify an exact source row.
    stmt_paths = {item["source"] for item in oracle["statements"]}
    statement_citations = []
    for item in records.values():
        for citation in item.get("citations", []) if isinstance(item.get("citations"), list) else []:
            citation = str(citation)
            if any(path in citation for path in stmt_paths):
                statement_citations.append(citation)
                check(" row " in citation.lower(), f"statement citation must include one-based row: {citation}")

    answers = oracle["search_answers"]
    ai = answers["ai_compute_unique_invoices_gross"]
    activity = answers["matched_statement_activity"]
    credit = answers["credit_note"]
    expected_totals = {
        "ai_compute_gross": ai["total_cad"],
        "credit": credit["amount_cad"],
        "ai_compute_net_of_credit": credit["invoice_net_of_credit_cad"],
        "matched_gross_payments": activity["gross_vendor_payments_cad"],
        "refunds": activity["refund_cad"],
        "net_cash_outflow": activity["net_cash_outflow_cad"],
        "unmatched_invoice_amount": activity["unmatched_invoice_amount_cad"],
    }
    totals = response.get("totals")
    totals = totals if isinstance(totals, dict) else {}
    for key, expected in expected_totals.items():
        check(_decimal(totals.get(key), f"totals.{key}", errors) == Decimal(str(expected)),
              f"totals.{key} should be {expected}")

    exclusions = response.get("exclusions")
    exclusions = exclusions if isinstance(exclusions, list) else []
    exclusion_map = {item.get("ref"): item for item in exclusions if isinstance(item, dict)}
    for ref in ("DEMO-STO-206", "DEMO-AI-101"):
        item = exclusion_map.get(ref)
        check(item is not None, f"exclusions must explicitly list {ref}")
        if item:
            expected = next(d for d in documents if (d["ref"] == ref and
                             (d["id"] == "cloud-storage-decoy" if ref == "DEMO-STO-206" else d["id"] == "duplicate-ai-invoice")))
            check(item.get("source") == expected["source"], f"{ref}: exclusion needs its exact source path")
            reason = str(item.get("reason", "")).lower()
            if ref == "DEMO-STO-206":
                check("storage" in reason and ("not ai" in reason or "outside" in reason or "exclude" in reason),
                      "DEMO-STO-206: explain that cloud storage is outside AI-compute expenses")
            else:
                check("duplicate" in reason and ("wrong" in reason or "different" in reason or "duplicate" in reason),
                      "DEMO-AI-101 duplicate: explain why the misplaced copy is excluded")

    # Require statement support for the two paid AI invoices, credit refund, and
    # two customer receipts. Row numbers are one-based and include the header.
    required_matches = {
        "DEMO-AI-204": ("example-consulting", "row 2"),
        "DEMO-AI-101": ("example-lodging", "row 2"),
        "DEMO-CN-204": ("example-consulting", "row 4"),
        "DEMO-LOD-2601": ("example-lodging", "row 3"),
        "DEMO-MED-2601": ("example-media", "row 2"),
    }
    for ref, (business, row) in required_matches.items():
        expected_doc = next(d for d in documents if d["ref"] == ref and d["business"] == business)
        record = records.get(expected_doc["source"], {})
        citations = record.get("citations", []) if isinstance(record.get("citations"), list) else []
        check(any(business in str(c) and row in str(c).lower() for c in citations),
              f"{ref}: missing matching statement citation ({business} {row})")

    for item in response_records if isinstance(response_records, list) else []:
        if isinstance(item, dict) and item.get("source") not in expected_by_source:
            check(False, f"unexpected source {item.get('source')!r}")
    passed = checks - len(errors)
    return passed, checks, errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("response", nargs="?", help="JSON response file (default: stdin)")
    args = parser.parse_args()
    try:
        raw = Path(args.response).read_text() if args.response else sys.stdin.read()
        response = json.loads(raw)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"Invalid response JSON: {exc}", file=sys.stderr)
        return 2
    passed, total, errors = evaluate(response)
    print(f"Checks passed: {passed}/{total}")
    for error in errors:
        print(f"- {error}")
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
