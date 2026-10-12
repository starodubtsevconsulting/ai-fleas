#!/usr/bin/env python3
"""Reproduce fictional one-page tax evidence and verifier-only answers."""
import json
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter

ROOT = Path(__file__).resolve().parent
CASES = [
    ('01', 'TX-FICTION-001', 'GST', 100, 'CAD', '2026-04-03', 'settled'),
    ('02', 'TX-FICTION-002', 'QST', 200, 'CAD', '2026-04-06', 'settled'),
    ('03', 'TX-FICTION-001', 'GST', 100, 'CAD', '2026-04-03', 'settled'),
    ('04', 'TX-FICTION-004', 'GST', 300, 'CAD', '2026-04-05', 'scheduled'),
    ('05', 'TX-FICTION-005', 'QST', 400, 'CAD', '2026-04-04', 'liability'),
    ('06', 'TX-FICTION-006', 'QST', 500, 'CAD', '2026-07-01', 'settled'),
    ('07', 'TX-FICTION-007', 'GST', 20, 'CAD', '2026-04-07', 'refunded'),
    ('08', 'TX-FICTION-008', 'GST', 25, 'USD', '2026-05-02', 'settled'),
    ('09', 'TX-FICTION-009', 'GST', 30, None, '2026-04-04', 'settled'),
]
STATUS_TEXT = {
    'settled': 'Payment completed and settled.',
    'scheduled': 'Payment scheduled only. Not completed or settled.',
    'liability': 'Amount owing only. No payment has been made.',
    'refunded': 'Refund completed and settled; funds returned to payer.',
}

def main():
    (ROOT / 'documents').mkdir(exist_ok=True)
    documents = []
    for ident, transaction, tax, amount, currency, date, status in CASES:
        document = f'receipt-{ident}'
        relative = f'documents/{document}.pdf'
        c = canvas.Canvas(str(ROOT / relative), pagesize=letter, invariant=1, pageCompression=1)
        c.setTitle(f'Fictional tax evidence {document}')
        c.setAuthor('Fictional benchmark fixture')
        c.setSubject('Synthetic test evidence; no real financial information')
        c.setFillColor(colors.HexColor('#ebedf0'))
        c.saveState()
        c.translate(306, 360)
        c.rotate(33)
        c.setFont('Helvetica-Bold', 29)
        c.drawCentredString(0, 0, 'FICTIONAL TEST FIXTURE')
        c.restoreState()
        c.setFillColor(colors.HexColor('#15283b'))
        c.setFont('Helvetica-Bold', 20)
        c.drawString(48, 736, 'FICTIONAL TEST FIXTURE')
        c.setFont('Helvetica', 11)
        c.drawString(48, 710, 'Synthetic Canada / Quebec GST and QST evidence')
        c.drawString(48, 691, 'Provider: Fictional Tax Evidence Service')
        c.setStrokeColor(colors.HexColor('#c6cdd4'))
        c.line(48, 676, 564, 676)
        rows = [
            ('Document reference', document),
            ('Transaction ID', transaction),
            ('Tax type', tax),
            ('Amount', f'${amount:.2f}'),
            ('Currency', currency or ''),
            ('Transaction date', date),
            ('Status', status.upper()),
        ]
        for index, (label, value) in enumerate(rows):
            y = 640 - index * 39
            c.setFont('Helvetica-Bold', 12)
            c.drawString(48, y, label)
            c.setFont('Helvetica', 14)
            c.drawString(238, y, value)
            c.line(238, y - 7, 554, y - 7)
        c.setFont('Helvetica-Bold', 12)
        c.drawString(48, 338, 'Status explanation')
        c.setFont('Helvetica', 11)
        c.drawString(48, 315, STATUS_TEXT[status])
        if ident == '03':
            c.drawString(48, 286, 'Duplicate copy of receipt-01; same transaction, not a second payment.')
        if ident == '08':
            c.drawString(48, 286, 'Synthetic currency challenge; not a real tax payment example.')
        c.setFont('Helvetica', 10)
        c.drawString(48, 96, 'All values and identifiers are invented solely for benchmark testing.')
        c.drawString(48, 78, 'This document is not a government form, receipt, or tax advice.')
        c.drawRightString(564, 48, 'Page 1 of 1')
        c.save()
        documents.append({'document': document, 'file': relative, 'page': 1, 'expected': {
            'transaction_id': transaction, 'tax_type': tax, 'amount': amount,
            'currency': currency, 'date': date, 'status': status}})
    excluded = {'receipt-03': 'duplicate_transaction', 'receipt-04': 'not_settled',
                'receipt-05': 'liability_not_payment', 'receipt-06': 'outside_period',
                'receipt-09': 'unknown_currency'}
    def period(end):
        is_week = end == '2026-04-07'
        period_excluded = dict(excluded)
        if is_week:
            period_excluded['receipt-08'] = 'outside_period'
        return {'start': '2026-04-01', 'end': end,
                'included_documents': ['receipt-01', 'receipt-02', 'receipt-07'] + ([] if is_week else ['receipt-08']),
                'excluded_documents': period_excluded,
                'currency_totals': {'CAD': {'gross': 300, 'refunds': 20, 'net': 280},
                                    'USD': {'gross': 0 if is_week else 25, 'refunds': 0, 'net': 0 if is_week else 25}}}
    expected = {'schema_version': 1, 'fictional': True, 'documents': documents,
                'periods': {'week': period('2026-04-07'), 'quarter': period('2026-06-30')}}
    (ROOT / 'expected.json').write_text(json.dumps(expected, indent=2) + '\n')

if __name__ == '__main__':
    main()
