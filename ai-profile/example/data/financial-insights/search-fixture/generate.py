#!/usr/bin/env python3
"""Generate deterministic, fictional Q4 Financial Insights search records."""
import csv
import hashlib
import json
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import simpleSplit
from reportlab.pdfgen import canvas

HERE = Path(__file__).resolve().parent
DATA = HERE.parent
REPORTS = DATA / "corporate/reports/2026"
BASE = "ai-profile/example/data/financial-insights"

# All parties, references, transactions, and amounts below are invented fixtures.
DOCS = [
    {"id":"client-consulting","business":"example-consulting","section":"in","file":"doc-001.pdf","kind":"customer-invoice","ref":"DEMO-CNS-2601","date":"2026-10-04","due":"2026-11-03","from":"Example Consulting (fictional)","to":"Sample Client Cedar (fictional)","description":"Planning and advisory services","amount":"2450.00","status":"payment status not shown"},
    {"id":"client-lodging","business":"example-lodging","section":"in","file":"doc-001.pdf","kind":"customer-invoice","ref":"DEMO-LOD-2601","date":"2026-10-09","due":"2026-11-08","from":"Example Lodging (fictional)","to":"Sample Guest Birch (fictional)","description":"Short-stay accommodation services","amount":"895.00","status":"payment status not shown"},
    {"id":"client-media","business":"example-media","section":"in","file":"doc-001.pdf","kind":"customer-invoice","ref":"DEMO-MED-2601","date":"2026-10-12","due":"2026-11-11","from":"Example Media Studio (fictional)","to":"Sample Client Maple (fictional)","description":"Audio and video production services","amount":"1275.50","status":"payment status not shown"},
    {"id":"ai-consulting-paid","business":"example-consulting","section":"out/expenses","file":"doc-002.pdf","kind":"vendor-invoice","category":"AI compute and model inference","ref":"DEMO-AI-204","date":"2026-10-05","due":"2026-11-04","from":"Fictional Compute Works","to":"Example Consulting (fictional)","description":"AI model inference and compute usage","amount":"62.15","status":"statement payment matched"},
    {"id":"ai-lodging-paid","business":"example-lodging","section":"out/expenses","file":"doc-002.pdf","kind":"vendor-invoice","category":"AI compute and model inference","ref":"DEMO-AI-101","date":"2026-10-08","due":"2026-11-07","from":"Fictional Compute Works","to":"Example Lodging (fictional)","description":"AI model inference and compute usage","amount":"48.30","status":"statement payment matched"},
    {"id":"ai-media-unmatched","business":"example-media","section":"out/expenses","file":"doc-002.pdf","kind":"vendor-invoice","category":"AI compute and model inference","ref":"DEMO-AI-307","date":"2026-11-03","due":"2026-12-03","from":"Fictional Compute Works","to":"Example Media Studio (fictional)","description":"AI model inference and compute usage","amount":"31.40","status":"payment status not shown"},
    {"id":"cloud-storage-decoy","business":"example-consulting","section":"out/expenses","file":"doc-003.pdf","kind":"vendor-invoice","category":"cloud file storage","ref":"DEMO-STO-206","date":"2026-10-11","due":"2026-11-10","from":"Fictional Cloud Archive","to":"Example Consulting (fictional)","description":"Cloud file storage and backup plan; no AI compute or model inference","amount":"24.00","status":"statement payment matched"},
    {"id":"ai-consulting-unpaid","business":"example-consulting","section":"out/expenses","file":"doc-004.pdf","kind":"vendor-invoice","category":"AI compute and model inference","ref":"DEMO-AI-209","date":"2026-11-14","due":"2026-12-14","from":"Fictional Compute Works","to":"Example Consulting (fictional)","description":"AI model inference and compute usage","amount":"29.99","status":"explicitly unpaid"},
    {"id":"ai-credit","business":"example-consulting","section":"out/expenses","file":"doc-005.pdf","kind":"vendor-credit-note","category":"AI compute credit","ref":"DEMO-CN-204","related_ref":"DEMO-AI-204","date":"2026-11-12","from":"Fictional Compute Works","to":"Example Consulting (fictional)","description":"Service adjustment credit applied to invoice DEMO-AI-204; refund issued","amount":"8.30","status":"credit applied and refund matched"},
    {"id":"duplicate-ai-invoice","business":"example-consulting","section":"out/expenses","file":"doc-006.pdf","kind":"duplicate-copy","category":"AI compute and model inference","ref":"DEMO-AI-101","related_ref":"DEMO-AI-101","date":"2026-10-08","due":"2026-11-07","from":"Fictional Compute Works","to":"Example Lodging (fictional)","description":"Copy of DEMO-AI-101 filed under the wrong business folder","amount":"48.30","status":"duplicate; exclude from totals"},
]

STATEMENTS = {
    "example-consulting": [
        ["2026-10-20","DEMO-TXN-CNS-001","Vendor payment; invoice DEMO-AI-204","-62.15","CAD"],
        ["2026-10-27","DEMO-TXN-CNS-002","Vendor payment; invoice DEMO-STO-206","-24.00","CAD"],
        ["2026-11-16","DEMO-TXN-CNS-003","Refund; credit DEMO-CN-204 for invoice DEMO-AI-204","8.30","CAD"],
        ["2026-12-05","DEMO-TXN-CNS-004","Office supplies; no invoice reference","-12.40","CAD"],
    ],
    "example-lodging": [
        ["2026-10-21","DEMO-TXN-LOD-001","Vendor payment; invoice DEMO-AI-101","-48.30","CAD"],
        ["2026-10-30","DEMO-TXN-LOD-002","Guest receipt; invoice DEMO-LOD-2601","895.00","CAD"],
    ],
    "example-media": [
        ["2026-11-15","DEMO-TXN-MED-001","Client receipt; invoice DEMO-MED-2601","1275.50","CAD"],
        ["2026-12-01","DEMO-TXN-MED-002","Office supply purchase; no invoice reference","-19.00","CAD"],
    ],
}

def doc_path(item):
    return REPORTS / item["business"] / "q4" / item["section"] / item["file"]

def make_pdf(path, item):
    path.parent.mkdir(parents=True, exist_ok=True)
    pdf = canvas.Canvas(str(path), pagesize=letter, invariant=1, pageCompression=1)
    pdf.setTitle("Fictional search fixture - " + item["id"])
    pdf.setAuthor("Fictional Financial Insights test data")
    pdf.setFillColor(colors.HexColor("#18344f")); pdf.rect(42, 716, 528, 42, fill=1, stroke=0)
    pdf.setFillColor(colors.white); pdf.setFont("Helvetica-Bold", 15)
    pdf.drawString(54, 731, "FICTIONAL TEST DOCUMENT")
    pdf.setFillColor(colors.black)
    title = "CREDIT NOTE" if item["kind"] == "vendor-credit-note" else (
        "DUPLICATE COPY - DO NOT COUNT TWICE" if item["kind"] == "duplicate-copy" else
        "CUSTOMER INVOICE" if item["kind"] == "customer-invoice" else "VENDOR INVOICE")
    pdf.setFont("Helvetica-Bold", 13); pdf.drawString(54, 688, title)
    rows = [
        ("Document reference", item["ref"]),
        ("Issue date", item["date"]),
        ("From", item["from"]),
        ("To", item["to"]),
        ("Description", item["description"]),
    ]
    if item.get("due"):
        rows.append(("Due date", item["due"]))
    if item.get("related_ref"):
        rows.append(("Related invoice", item["related_ref"]))
    rows += [("Amount", "$" + item["amount"] + " CAD"), ("Payment status", item["status"])]
    y = 650
    for label, value in rows:
        value_lines = simpleSplit(value, "Helvetica", 10, 345)
        pdf.setFont("Helvetica-Bold", 9); pdf.drawString(58, y, label)
        pdf.setFont("Helvetica", 10)
        for offset, line in enumerate(value_lines):
            pdf.drawString(205, y - offset * 13, line)
        row_height = max(35, len(value_lines) * 13 + 10)
        pdf.setStrokeColor(colors.HexColor("#d8dee6")); pdf.line(54, y-row_height+10, 558, y-row_height+10)
        y -= row_height
    pdf.setFont("Helvetica", 8)
    pdf.drawString(54, 88, "Every business, party, document, date, amount, and reference is invented for testing.")
    pdf.drawString(54, 74, "Not a real invoice, receipt, tax document, or payment instruction.")
    pdf.drawString(54, 60, "All amounts are fictional Canadian dollars. Page 1 of 1.")
    pdf.save()

def main():
    for item in DOCS:
        make_pdf(doc_path(item), item)
    for business, rows in STATEMENTS.items():
        target = REPORTS / business / "q4" / "statements" / "statement-q4-2026.csv"
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("w", newline="", encoding="utf-8") as stream:
            writer = csv.writer(stream, lineterminator="\n")
            writer.writerow(["date", "transaction_id", "description", "amount", "currency"])
            writer.writerows(rows)

    records = []
    for item in DOCS:
        path = doc_path(item)
        record = dict(item)
        record["source"] = path.relative_to(DATA).as_posix()
        record["sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
        records.append(record)
    statements = []
    for business, rows in STATEMENTS.items():
        path = REPORTS / business / "q4" / "statements" / "statement-q4-2026.csv"
        statements.append({"business": business, "source": path.relative_to(DATA).as_posix(),
                           "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "rows": rows})
    expected = {
        "schema_version": 1,
        "dataset_id": "fictional-financial-insights-search-q4-2026-v1",
        "fictional": True,
        "currency": "CAD",
        "period": {"year": 2026, "quarter": "q4"},
        "businesses": ["example-consulting", "example-lodging", "example-media"],
        "documents": records,
        "statements": statements,
        "search_answers": {
            "ai_compute_unique_invoices_gross": {
                "included_invoice_refs": ["DEMO-AI-204", "DEMO-AI-101", "DEMO-AI-307", "DEMO-AI-209"],
                "amounts_cad": [62.15, 48.30, 31.40, 29.99], "total_cad": 171.84,
                "exclusions": {"cloud_storage_invoice": "DEMO-STO-206", "duplicate_copy": "DEMO-AI-101 duplicate"},
            },
            "credit_note": {"ref": "DEMO-CN-204", "related_invoice": "DEMO-AI-204", "amount_cad": 8.30,
                            "invoice_net_of_credit_cad": 163.54},
            "matched_statement_activity": {
                "gross_vendor_payments_cad": 110.45, "refund_cad": 8.30, "net_cash_outflow_cad": 102.15,
                "invoice_refs_with_payment_evidence": ["DEMO-AI-204", "DEMO-AI-101"],
                "no_matching_payment_evidence": ["DEMO-AI-307", "DEMO-AI-209"],
                "explicitly_unpaid_invoice_refs": ["DEMO-AI-209"],
                "unmatched_invoice_amount_cad": 61.39,
                "exclusions": {"cloud_storage_invoice": "DEMO-STO-206", "duplicate_copy": "DEMO-AI-101 duplicate"},
            },
            "customer_invoices": {
                "DEMO-CNS-2601": {"business":"example-consulting","amount_cad":2450.00,"payment_status":"not shown"},
                "DEMO-LOD-2601": {"business":"example-lodging","amount_cad":895.00,"payment_status":"payment matched in statement"},
                "DEMO-MED-2601": {"business":"example-media","amount_cad":1275.50,"payment_status":"payment matched in statement"},
            },
        },
    }
    (HERE / "expected.json").write_text(json.dumps(expected, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")

if __name__ == "__main__":
    main()
