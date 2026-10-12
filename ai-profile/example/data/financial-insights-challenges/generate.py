#!/usr/bin/env python3
"""Generate deterministic fictional payroll challenge PDFs and evaluator facts."""
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

HERE = Path(__file__).resolve().parent
SOURCE_DIR = HERE / 'corporate/reports/2026/example-consulting/q4/incoming/unprocessed'
REL_ROOT = 'ai-profile/example/data/financial-insights-challenges'


def pdf_canvas(path):
    return canvas.Canvas(str(path), pagesize=letter, invariant=1, pageCompression=1)


def banner(c, title, page, pages):
    c.setFillColor(colors.HexColor('#14344c'))
    c.rect(36, 721, 540, 42, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont('Helvetica-Bold', 16)
    c.drawString(48, 738, 'FICTIONAL TEST FIXTURE')
    c.setFillColor(colors.black)
    c.setFont('Helvetica-Bold', 11)
    c.drawString(48, 699, title)
    c.setFont('Helvetica', 9)
    c.drawString(48, 677, 'Synthetic Canadian payroll remittance form - not a government form')
    c.drawString(48, 108, f'All identities, references, dates and amounts are invented. Page {page} of {pages}')


def rows(c, items, note, page=1, pages=1, title='Revenu Quebec payroll remittance'):
    banner(c, title, page, pages)
    for index, (label, value) in enumerate(items):
        y = 642 - index * 37
        c.setStrokeColor(colors.HexColor('#cccccc'))
        c.line(48, y - 11, 562, y - 11)
        c.setFont('Helvetica-Bold', 10)
        c.drawString(48, y, label + ':')
        c.setFont('Helvetica', 11)
        c.drawString(296, y, value)
    c.setFont('Helvetica', 9)
    c.drawString(48, 166, note)


def font(size, bold=False):
    return ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf' if bold else '/System/Library/Fonts/Supplemental/Arial.ttf', size)


def raster_federal(path):
    image = Image.new('RGB', (1224, 1584), 'white')
    draw = ImageDraw.Draw(image)
    draw.rectangle((72, 58, 1152, 142), fill='#14344c')
    draw.text((96, 82), 'FICTIONAL TEST FIXTURE', font=font(30, True), fill='white')
    draw.text((96, 188), 'Federal Payroll Deductions submission confirmation', font=font(22, True), fill='black')
    draw.text((96, 230), 'Synthetic Canadian payroll remittance form - not a government form', font=font(16), fill='black')
    items = [
        ('Business', 'Example Consulting (fictional)'), ('Provider status', 'To be processed'),
        ('Confirmation Number', 'FICTIONAL-FED-CH-01'), ('Confirmation date', '2026-10-03'),
        ('Date payment made to employees', '2026 Sep'), ('Reporting period end', '2026-09-30'),
        ('Due Date', '2026-10-15'), ('Payment Date', '2026-10-11'),
        ('Gross payroll', '24,680.50'), ('Number of employees', '7'),
        ('Amount payable', '2,345.67'), ('Currency', 'CAD')]
    for i, (label, value) in enumerate(items):
        y = 285 + i * 82
        draw.line((96, y + 72, 1120, y + 72), fill='#cccccc', width=2)
        draw.text((96, y), label + ':', font=font(18, True), fill='black')
        draw.text((620, y), value, font=font(20), fill='black')
    draw.text((96, 1360), 'Submission scheduling only. No completed or settled payment is evidenced.', font=font(15), fill='black')
    draw.text((96, 1450), 'All names, references, dates and amounts are invented. Page 1 of 1', font=font(14), fill='black')
    c = pdf_canvas(path)
    c.drawImage(ImageReader(image), 0, 0, width=612, height=792)
    c.save()


def sideways_quebec(path):
    c = pdf_canvas(path)
    c.saveState()
    c.translate(612, 0)
    c.rotate(90)
    # Scale a full letter form into the rotated page so its content stays
    # visibly sideways without relying on a PDF /Rotate viewer hint.
    c.scale(612 / 792, 612 / 792)
    rows(c, [
        ('Business', 'Example Consulting (fictional)'), ('Provider status', 'To be processed'),
        ('Confirmation reference', 'FICTIONAL-QC-CH-02'),
        ('Reporting period end', '2026-09-30'), ('Confirmation date', '2026-10-04'),
        ('Scheduled execution', '2026-10-12'), ('Payment total', '2,369.24'), ('Currency', 'CAD')],
        'Submission scheduling only. No completed or settled payment is evidenced.',
        title='Revenu Quebec payment submission confirmation')
    c.restoreState()
    c.save()


def missing_currency(path):
    c = pdf_canvas(path)
    rows(c, [
        ('Business', 'Example Consulting (fictional)'), ('Provider status', 'To be processed'),
        ('Confirmation reference', 'FICTIONAL-QC-CH-03'),
        ('Reporting period end', '2026-09-30'), ('Confirmation date', '2026-10-05'),
        ('Scheduled execution', '2026-10-13'), ('Payment total', '2,401.18')],
        'Submission scheduling only. No completed or settled payment is evidenced.',
        title='Revenu Quebec payment submission confirmation')
    c.save()


def split_obligation(path):
    c = pdf_canvas(path)
    rows(c, [
        ('Business', 'Example Consulting (fictional)'), ('Reporting period start', '2026-07-01'),
        ('Reporting period end', '2026-09-30'), ('Due date', '2026-10-15'),
        ('Income tax', '1,210.00'), ('QPP', '780.00'), ('Health Services Fund', '230.00')],
        'Components continue on page 2. Obligation only; no payment is evidenced.', 1, 2,
        'Revenu Quebec payroll source deductions TPZ-1015')
    c.showPage()
    rows(c, [('QPIP', '110.00'), ('CNESST', '0.00'), ('Total remittance', '2,330.00'), ('Currency', 'CAD')],
        'This page completes the source obligation. No submission or settlement is evidenced.', 2, 2,
        'Revenu Quebec payroll source deductions TPZ-1015')
    c.save()


def conflicting_obligation(path):
    c = pdf_canvas(path)
    rows(c, [
        ('Business', 'Example Consulting (fictional)'), ('Reporting period start', '2026-07-01'),
        ('Reporting period end', '2026-09-30'), ('Due date', '2026-10-15'),
        ('Income tax', '1,200.00'), ('QPP', '800.00'), ('Health Services Fund', '250.00'),
        ('QPIP', '100.00'), ('CNESST', '0.00'), ('Total remittance', '2,300.00'), ('Currency', 'CAD')],
        'Obligation source form. No submission or settlement is evidenced.',
        title='Revenu Quebec payroll source deductions TPZ-1015')
    c.save()


def field(value, support, pages, observed_value=None):
    result = {'value': value, 'expected_support': support, 'source_pages': pages}
    if observed_value is not None or support == 'unknown':
        result['observed_value'] = observed_value
    return result


def document(identifier, filename, expected, provenance, transcript_pages, extra=None):
    path = SOURCE_DIR / filename
    # Every canonical expected path has source support and page coverage. Form
    # family, jurisdiction and lifecycle are contextual interpretations; values
    # printed as labeled dates or amounts remain printed evidence.
    provenance = dict(provenance)
    for key, value in expected.items():
        if key not in provenance:
            support = 'printed' if key.startswith(('reportingPeriod.', 'dates.', 'amounts.')) else 'inferred'
            provenance[key] = field(value, support, [1] if support == 'printed' else transcript_pages)
    result = {
        'id': identifier,
        'file': f'{REL_ROOT}/corporate/reports/2026/example-consulting/q4/incoming/unprocessed/{filename}',
        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'page_count': len(__import__('pypdf').PdfReader(str(path)).pages),
        'expected': expected,
        'field_provenance': provenance,
        'transcript_pages': transcript_pages,
    }
    if extra:
        result.update(extra)
    return result


def main():
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    raster_federal(SOURCE_DIR / 'federal-raster-confirmation.pdf')
    sideways_quebec(SOURCE_DIR / 'quebec-sideways-confirmation.pdf')
    missing_currency(SOURCE_DIR / 'quebec-missing-currency-confirmation.pdf')
    split_obligation(SOURCE_DIR / 'quebec-two-page-obligation.pdf')
    conflicting_obligation(SOURCE_DIR / 'quebec-conflicting-total-obligation.pdf')

    common = {'reportingPeriod.end': '2026-09-30'}
    docs = [
        document('federal-raster-confirmation', 'federal-raster-confirmation.pdf', {**common, 'currency': 'CAD', 'documentRole': 'submission-confirmation', 'jurisdiction': 'ca-federal', 'dates.submissionDate': '2026-10-03', 'dates.dueDate': '2026-10-15', 'dates.scheduledExecutionDate': '2026-10-11', 'amounts.components.grossPayroll': 24680.50, 'amounts.components.employeeCount': 7, 'amounts.arithmetic.total': 2345.67, 'obligationLifecycle.state': 'scheduled', 'obligationLifecycle.providerStatus': 'to-be-processed', 'obligationLifecycle.settlement': 'pending'}, {'currency': field('CAD', 'printed', [1]), 'amounts.arithmetic.total': field(2345.67, 'printed', [1])}, [1]),
        document('quebec-sideways-confirmation', 'quebec-sideways-confirmation.pdf', {**common, 'currency': 'CAD', 'documentRole': 'submission-confirmation', 'jurisdiction': 'ca-qc', 'dates.submissionDate': '2026-10-04', 'dates.scheduledExecutionDate': '2026-10-12', 'amounts.arithmetic.total': 2369.24, 'obligationLifecycle.state': 'scheduled', 'obligationLifecycle.providerStatus': 'to-be-processed', 'obligationLifecycle.settlement': 'pending'}, {'currency': field('CAD', 'printed', [1]), 'amounts.arithmetic.total': field(2369.24, 'printed', [1])}, [1], {'layout_challenge': 'content_visibly_sideways_90_degrees_no_rotation_tag'}),
        document('quebec-missing-currency-confirmation', 'quebec-missing-currency-confirmation.pdf', {**common, 'currency': 'CAD', 'documentRole': 'submission-confirmation', 'jurisdiction': 'ca-qc', 'dates.submissionDate': '2026-10-05', 'dates.scheduledExecutionDate': '2026-10-13', 'amounts.arithmetic.total': 2401.18, 'obligationLifecycle.state': 'scheduled', 'obligationLifecycle.providerStatus': 'to-be-processed', 'obligationLifecycle.settlement': 'pending'}, {'currency': field('CAD', 'inferred', [1]), 'amounts.arithmetic.total': field(2401.18, 'printed', [1])}, [1], {'visual_assessment': {'currency': field(None, 'unknown', [1], None)}}),
        document('quebec-two-page-obligation', 'quebec-two-page-obligation.pdf', {**common, 'currency': 'CAD', 'documentRole': 'obligation', 'jurisdiction': 'ca-qc', 'reportingPeriod.start': '2026-07-01', 'dates.dueDate': '2026-10-15', 'amounts.components.incomeTax': 1210.00, 'amounts.components.qpp': 780.00, 'amounts.components.healthServicesFund': 230.00, 'amounts.components.qpip': 110.00, 'amounts.components.cnesst': 0.00, 'amounts.arithmetic.total': 2330.00, 'obligationLifecycle.state': 'obligation-recorded', 'obligationLifecycle.settlement': 'pending'}, {'dates.dueDate': field('2026-10-15', 'printed', [1]), 'amounts.components.incomeTax': field(1210.00, 'printed', [1]), 'amounts.components.qpp': field(780.00, 'printed', [1]), 'amounts.components.healthServicesFund': field(230.00, 'printed', [1]), 'amounts.components.qpip': field(110.00, 'printed', [2]), 'amounts.components.cnesst': field(0.00, 'printed', [2]), 'amounts.arithmetic.total': field(2330.00, 'printed', [2]), 'currency': field('CAD', 'printed', [2])}, [1, 2], {'coverage_requirement': {'required_pages': [1, 2], 'complete_only_when_all_pages_seen': True}}),
        document('quebec-conflicting-total-obligation', 'quebec-conflicting-total-obligation.pdf', {**common, 'currency': 'CAD', 'documentRole': 'obligation', 'jurisdiction': 'ca-qc', 'reportingPeriod.start': '2026-07-01', 'dates.dueDate': '2026-10-15', 'amounts.components.incomeTax': 1200.00, 'amounts.components.qpp': 800.00, 'amounts.components.healthServicesFund': 250.00, 'amounts.components.qpip': 100.00, 'amounts.components.cnesst': 0.00, 'amounts.arithmetic.total': 2300.00, 'obligationLifecycle.state': 'obligation-recorded', 'obligationLifecycle.settlement': 'pending'}, {'currency': field('CAD', 'printed', [1]), 'amounts.arithmetic.total': field(2300.00, 'ambiguous', [1]), 'amounts.components.incomeTax': field(1200.00, 'printed', [1]), 'amounts.components.qpp': field(800.00, 'printed', [1]), 'amounts.components.healthServicesFund': field(250.00, 'printed', [1]), 'amounts.components.qpip': field(100.00, 'printed', [1]), 'amounts.components.cnesst': field(0.00, 'printed', [1])}, [1], {'arithmetic_issue': {'kind': 'printed_total_conflicts_with_components', 'printed_total': 2300.00, 'components_sum': 2350.00, 'expected_support': 'ambiguous', 'source_pages': [1]}}),
    ]
    manual_pages = {
        'federal-raster-confirmation': [{
            'page': 1,
            'visible_text': ['Federal Payroll Deductions submission confirmation', 'Provider status: To be processed', 'Confirmation Number: FICTIONAL-FED-CH-01', 'Confirmation date: 2026-10-03', 'Date payment made to employees: 2026 Sep', 'Reporting period end: 2026-09-30', 'Due Date: 2026-10-15', 'Payment Date: 2026-10-11', 'Gross payroll: 24,680.50', 'Number of employees: 7', 'Amount payable: 2,345.67', 'Currency: CAD'],
        }],
        'quebec-sideways-confirmation': [{
            'page': 1,
            'visible_text': ['Revenu Quebec payment submission confirmation', 'Provider status: To be processed', 'Confirmation reference: FICTIONAL-QC-CH-02', 'Reporting period end: 2026-09-30', 'Confirmation date: 2026-10-04', 'Scheduled execution: 2026-10-12', 'Payment total: 2,369.24', 'Currency: CAD'],
            'layout_note': 'All page content is visibly sideways at 90 degrees.',
        }],
        'quebec-missing-currency-confirmation': [{
            'page': 1,
            'visible_text': ['Revenu Quebec payment submission confirmation', 'Provider status: To be processed', 'Confirmation reference: FICTIONAL-QC-CH-03', 'Reporting period end: 2026-09-30', 'Confirmation date: 2026-10-05', 'Scheduled execution: 2026-10-13', 'Payment total: 2,401.18'],
            'absence_note': 'No currency code is printed anywhere on this page.',
        }],
        'quebec-two-page-obligation': [
            {'page': 1, 'visible_text': ['Revenu Quebec payroll source deductions TPZ-1015', 'Reporting period start: 2026-07-01', 'Reporting period end: 2026-09-30', 'Due date: 2026-10-15', 'Income tax: 1,210.00', 'QPP: 780.00', 'Health Services Fund: 230.00'], 'coverage_note': 'Components continue on page 2.'},
            {'page': 2, 'visible_text': ['QPIP: 110.00', 'CNESST: 0.00', 'Total remittance: 2,330.00', 'Currency: CAD'], 'coverage_note': 'This page completes the source obligation.'},
        ],
        'quebec-conflicting-total-obligation': [{
            'page': 1,
            'visible_text': ['Revenu Quebec payroll source deductions TPZ-1015', 'Reporting period start: 2026-07-01', 'Reporting period end: 2026-09-30', 'Due date: 2026-10-15', 'Income tax: 1,200.00', 'QPP: 800.00', 'Health Services Fund: 250.00', 'QPIP: 100.00', 'CNESST: 0.00', 'Total remittance: 2,300.00', 'Currency: CAD'],
            'arithmetic_note': 'Printed components sum to 2,350.00 while the literal printed total is 2,300.00.',
        }],
    }
    transcripts = {'schema_version': 1, 'fictional': True, 'review_method': 'manual transcription from rendered source pages; not OCR', 'documents': [{'id': item['id'], 'pages': manual_pages[item['id']]} for item in docs]}
    expected = {'schema_version': 1, 'fictional': True, 'source_root': REL_ROOT, 'documents': docs}
    (HERE / 'expected.json').write_text(json.dumps(expected, indent=2) + '\n')
    (HERE / 'transcripts.json').write_text(json.dumps(transcripts, indent=2) + '\n')


if __name__ == '__main__':
    main()
