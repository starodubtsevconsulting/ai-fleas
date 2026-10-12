# Financial Insights challenge fixtures

This scenario defines a separate public, fictional stress set for visual and
mechanical preparation checks. It supplements the compatible three-form set;
it does not change that baseline, its source bytes, its evaluator facts, or its
recorded comparisons. The challenge set is evaluator-oriented preparation
evidence, never authority to publish a normalized financial record.

## Scope and source boundary

The five fictional originals live only beneath
`ai-profile/example/data/financial-insights-challenges/corporate/reports/2026/example-consulting/q4/incoming/unprocessed/`.
Their root is deliberately separate from the compatible source tree. Every
identity, reference, label, date and amount is invented and visibly marked as a
test fixture. A deterministic ReportLab generator owns the files. The raster
federal form contains no hidden embedded source text; its expected facts come
from manual page transcripts, never from OCR output.

The set contains six pages across five PDFs:

1. a raster-only federal submission confirmation;
2. a Quebec submission confirmation whose page content is visibly sideways at
   90 degrees (the PDF is not repaired with a rotation tag);
3. a Quebec submission confirmation that prints an amount but no currency code;
4. a two-page Quebec obligation, with components and date on page 1 and the
   printed total on page 2; and
5. a Quebec obligation whose printed total conflicts with the sum of its
   printed components.

## CHALLENGE-1: source coverage and provenance

The evaluator-only `expected.json` must identify each source by its public
relative path, byte SHA-256, page count, and per-field source pages. The
separate manually reviewed `transcripts.json` records what is visible on each
page. It is not OCR output, model input, a normalized sidecar, or a source of
unprinted claims. A result that omits a source page cannot claim complete
coverage for a multi-page form.

Each expected field includes `expected_support`:

* `printed` means the value or text is visible on the cited page;
* `inferred` means a normalizer may derive the value from stated context, while
  the visual assessment must retain the underlying observed value;
* `unknown` means the source does not establish the value; and
* `ambiguous` means the source supplies incompatible evidence that must remain
  visible to review.

## CHALLENGE-2: missing currency and conflicting arithmetic

For the missing-currency Quebec confirmation, the raw visual observation for
currency is `null` with `unknown` support. A contextual normalizer may propose
`CAD` with `inferred` support because the form is a Quebec payroll remittance,
but a visual checker must not report CAD as printed.

For the conflicting-total obligation, retain both the literal printed total and
the independently summed printed components. Its total assertion is
`ambiguous`, and the result must surface the arithmetic discrepancy. A checker
must not choose a replacement total, erase the printed total, or silently treat
the component sum as the form's total.

## CHALLENGE-3: verification and stop condition

Render all six pages before accepting a fixture revision. Verify the raster PDF
has no extractable text and that the sideways page remains visibly sideways.
Keep rendered QA images and command logs in the ignored
`notes/benchmarks/local-models/runs/fi-challenge-data-2026-10-12/` location.
The suite is ready for evaluator integration when page count, source hashes,
page transcripts, support states and arithmetic facts agree with the rendered
originals. Current runners do not yet score this extended schema.
