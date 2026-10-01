# UX and UI review record

Copy this compact record into the selected project's work item or PR. Fill only the checks relevant to the change. Record observed behavior, not a presumed pass from code inspection.

## Context

- User task and affected routes/components:
- Candidate revision and environment:
- Current behavior and intended change:
- Supported languages and switch/route behavior (or not applicable):
- Viewports checked (width and height; include phone, desktop, and any affected breakpoint):
- States checked (for example default, empty, loading, error, success):

## Review

| Check | Observation and evidence | Result: pass / fail / not run |
| --- | --- | --- |
| Primary task and navigation path | | |
| Content hierarchy, wording, and readability | | |
| Changed visible content and behavior in every supported language | | |
| Language switch, localized routes/links, and accessible labels | | |
| Responsive layout, wrapping, clipping, and horizontal overflow | | |
| Scroll reachability and usable controls at narrow width | | |
| Keyboard navigation, focus, and control labels | | |
| Relevant links, forms, and state transitions | | |
| Existing visual patterns and adjacent screens | | |

## Evidence and follow-up

- Screenshots or recording (route, language, viewport, date, revision):
- Focused automated checks (command, result, revision), if applicable:
- Independent UI acceptance receipt, if required:
- Failures, exclusions, or unverified behavior (reason, owner, next action):

Do not mark a check as passed when it was not exercised. A local preview and a screenshot are useful evidence for layout, while deployed behavior needs its own verification if deployment is in scope.
