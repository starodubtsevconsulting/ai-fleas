# Worked solution: find an invoice

Fictional instructional example; no files described here were executed or measured.

**Request:** “Find invoice INV-204 for Cedar Vale, the consulting client, from May 2027.”

**Short plan:** resolve direction and scope; search names then content; confirm identity in original documents; report the source and any conflict.

1. **Resolve direction from the clues.** “Invoice” alone could mean money owed to or by the business. “Consulting client” identifies customer billing, so the mapped scope is `2027/consulting/Q2/in`. Read the local rules and confirm the selected business. Why: choosing `out` just because a document is called an invoice would miss this record. If the request had no client/vendor clue, inspect available entity context; ask only if ambiguity remains consequential.
2. **Search filenames with bounded output.** List this one section; search `INV-204`, then the client name and spelling variants. Return matching paths, not every document's contents. Invented results: `client-may.pdf`, `INV-204-copy.pdf`, and `INV-204-draft.pdf`. Filename absence is not proof of document absence.
3. **Search structured content.** Read invoice number, issuer, recipient, issue date, currency, total, and source path from adjacent JSON for the matches and the bounded May batch. `client-may.json` identifies INV-204, issued May 6, CAD 600.00. The draft sidecar says CAD 650.00. Why: number and counterparty identity are stronger than filenames, and conflicts require source inspection.
4. **Confirm originals one document at a time.** Inspect page 1 of each candidate. `client-may.pdf` is the final INV-204 issued to Cedar Vale for CAD 600.00. The copy has the identical invoice number, date, amount, and payment reference. The draft is visibly marked “DRAFT” and has no final payment reference. Preserve the draft conflict; do not silently edit its sidecar or claim all files agree.

| Candidate | Normalized identity/status | Amount | Decision/source |
| --- | --- | ---: | --- |
| `client-may.pdf` | INV-204; Cedar Vale; May 6; final | CAD 600.00 | Primary match: `2027/consulting/Q2/in/client-may.pdf` p1 |
| `INV-204-copy.pdf` | Same final identity/reference | CAD 600.00 | Duplicate evidence: `2027/consulting/Q2/in/INV-204-copy.pdf` p1 |
| `INV-204-draft.pdf` | INV-204; marked draft | CAD 650.00 | Conflicting draft, not a second invoice: `2027/consulting/Q2/in/INV-204-draft.pdf` p1 |

5. **Answer the lookup.** “The final invoice is `2027/consulting/Q2/in/client-may.pdf`, page 1: INV-204, Cedar Vale, May 6, 2027, CAD 600.00. A duplicate copy and a conflicting CAD 650.00 draft also exist.” A lookup does not establish payment status and does not authorize renaming or publishing JSON.

**No-match recovery:** finish the scoped filename and JSON search, inventory PDFs without JSON, then extract selected invoice-identification fields in small batches. Check the adjacent quarter only when issue-date/filed-period mismatch is plausible and authorized. If the year was omitted, start with the current year and report the actual year found. Stop after the declared scope and report “no match found in these folders” with coverage; do not claim the invoice does not exist everywhere. Two conflicting final originals remain unresolved rather than selecting the newest filename.
