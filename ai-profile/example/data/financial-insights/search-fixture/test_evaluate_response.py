"""Standard-library tests for the fictional Q4 search evaluator."""

import copy
import json
import unittest
from pathlib import Path

from evaluate_response import evaluate

HERE = Path(__file__).resolve().parent
ORACLE = json.loads((HERE / "expected.json").read_text())


def valid_response():
    answer = ORACLE["search_answers"]
    records = []
    for doc in ORACLE["documents"]:
        status = doc["status"]
        customer = answer["customer_invoices"].get(doc["ref"])
        if customer:
            status = customer["payment_status"]
        citations = [f"{doc['source']} page 1"]
        records.append({
            "ref": doc["ref"],
            "kind": doc["kind"],
            "business": (doc["from"] if doc["kind"] == "customer-invoice" else doc["to"]).replace(" (fictional)", ""),
            "folder_business": doc["business"],
            "source": doc["source"],
            "page": 1,
            "amount": doc["amount"],
            "currency": "CAD",
            "payment_status": status,
            "citations": citations,
        })
    for ref, path, row in (
        ("DEMO-AI-204", "example-consulting", 2),
        ("DEMO-AI-101", "example-lodging", 2),
        ("DEMO-CN-204", "example-consulting", 4),
        ("DEMO-LOD-2601", "example-lodging", 3),
        ("DEMO-MED-2601", "example-media", 2),
    ):
        record = next(item for item in records if item["ref"] == ref and path in item["source"])
        record["citations"].append(
            f"corporate/reports/2026/{path}/q4/statements/statement-q4-2026.csv row {row}"
        )
    ai = answer["ai_compute_unique_invoices_gross"]
    activity = answer["matched_statement_activity"]
    credit = answer["credit_note"]
    exclusions = []
    for doc in ORACLE["documents"]:
        if doc["id"] == "cloud-storage-decoy":
            exclusions.append({"ref": doc["ref"], "reason": "cloud storage outside AI-compute expenses",
                               "source": doc["source"], "page": 1})
        if doc["id"] == "duplicate-ai-invoice":
            exclusions.append({"ref": doc["ref"], "reason": "duplicate copy filed under wrong business folder",
                               "source": doc["source"], "page": 1})
    return {
        "searched": [{"business": business, "sections": ["in", "out", "statements"]}
                     for business in ORACLE["businesses"]],
        "records": records,
        "totals": {
            "ai_compute_gross": str(ai["total_cad"]),
            "credit": str(credit["amount_cad"]),
            "ai_compute_net_of_credit": str(credit["invoice_net_of_credit_cad"]),
            "matched_gross_payments": str(activity["gross_vendor_payments_cad"]),
            "refunds": str(activity["refund_cad"]),
            "net_cash_outflow": str(activity["net_cash_outflow_cad"]),
            "unmatched_invoice_amount": str(activity["unmatched_invoice_amount_cad"]),
        },
        "exclusions": exclusions,
        "notes": [],
        "limitations": [],
    }


class EvaluateResponseTests(unittest.TestCase):
    def test_complete_evidence_based_response_passes(self):
        passed, total, errors = evaluate(valid_response(), ORACLE)
        self.assertEqual([], errors)
        self.assertEqual(total, passed)

    def test_duplicate_and_decoy_counted_or_misclassified_fail(self):
        response = valid_response()
        response["totals"]["ai_compute_gross"] = "244.14"
        response["exclusions"] = [item for item in response["exclusions"]
                                   if item["ref"] != "DEMO-STO-206"]
        passed, total, errors = evaluate(response, ORACLE)
        self.assertLess(passed, total)
        self.assertTrue(any("ai_compute_gross" in error for error in errors))
        self.assertTrue(any("DEMO-STO-206" in error for error in errors))

    def test_missing_payment_cannot_be_called_paid(self):
        response = valid_response()
        record = next(item for item in response["records"] if item["ref"] == "DEMO-AI-307")
        record["payment_status"] = "paid"
        passed, total, errors = evaluate(response, ORACLE)
        self.assertLess(passed, total)
        self.assertTrue(any("DEMO-AI-307" in error and "payment status" in error for error in errors))

    def test_bad_statement_row_and_wrong_folder_are_detected(self):
        response = valid_response()
        record = next(item for item in response["records"]
                      if item["ref"] == "DEMO-AI-101" and "example-lodging" in item["source"])
        record["folder_business"] = "example-consulting"
        record["citations"] = [c.replace("row 2", "row 3") for c in record["citations"]]
        passed, total, errors = evaluate(response, ORACLE)
        self.assertLess(passed, total)
        self.assertTrue(any("folder_business" in error for error in errors))
        self.assertTrue(any("statement citation" in error or "missing matching statement" in error for error in errors))

    def test_unparseable_amount_fails(self):
        response = valid_response()
        response["totals"]["refunds"] = "unknown"
        passed, total, errors = evaluate(response, ORACLE)
        self.assertLess(passed, total)
        self.assertTrue(any("decimal amount" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
