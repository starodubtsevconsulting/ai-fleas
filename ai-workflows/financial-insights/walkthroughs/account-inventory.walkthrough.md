# Worked use case: bank accounts and credit cards

Fictional instructional example; all identifiers, paths, observations, and answers are invented, not executed evidence.

**Request:** “How many bank accounts and credit cards do I have for Q2 2027?”

**Plan:** inventory distinct accounts identified within the authorized organization and data scope. Count deposit accounts, credit-card accounts, and identifiable physical cards separately; records alone cannot prove a complete lifetime inventory.

1. **Discover before counting.** Resolve the profile's account mappings and list each business's statement folders, including shared accounts and adjacent-period exports. Read statement headers or valid sidecars for institution, owner, account type, masked identifier, currency, and statement interval. Inspect original headers when extracted fields conflict. Do not copy full account numbers into an answer.
2. **Resolve identities cautiously.** Repeated monthly statements, screenshots, and exports are evidence for the same account, not additional accounts. A matching last four digits alone is insufficient: compare institution, holder, product, currency, and available references. A currency wallet or sub-balance may belong to one account rather than being another bank account. A payment processor balance is a separate financial source, not automatically a bank account. Record unresolved identity collisions instead of merging them silently.

| Observed fictional evidence | Inventory decision | Q2 coverage |
| --- | --- | --- |
| Bank A operating account ending 1042, CAD; three monthly statements plus one duplicate | One deposit account | April–June complete |
| Bank B savings account ending 6081, CAD | One deposit account | April only; May–June missing |
| Card issuer C account ending 9027, with primary card 1190 and additional card 2208 on the same statement | One credit-card account; two identified cards | Through June 20 only |
| Processor settlement report and a USD wallet under the operating account | Separate processor source and account sub-balance | Verify exports and account relationship; do not add bank accounts |

3. **Answer on the observed scope.** “The supplied records identify **two bank deposit accounts and one credit-card account with two cards**. This is the documented inventory, not confirmation that no other accounts exist. One bank account lacks May–June statements, and card coverage stops June 20.” Count uncertain accounts separately as unresolved candidates.
4. **Build the closing inputs.** Save a private inventory with institution, type, masked ID, owner/business, currency, linked cards, source citations, account relationship, and available intervals. Include known opened/closed dates where supported. Feed every identified financial source into the [quarter handover checklist](quarter-handover.walkthrough.md), requesting only the missing intervals. Transactions may reveal another account or card; add it as a candidate until verified.

**Recover and cache:** missing identifiers require a statement header or owner confirmation; absent statements do not prove a closed account. Store the real inventory and coverage privately and cache the answer under the [data FAQ contract](../flows/data-faq-cache.md). Revalidate when accounts or statements change.
