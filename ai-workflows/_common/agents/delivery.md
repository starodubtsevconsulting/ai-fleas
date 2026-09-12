# Common agent delivery

An accepted messaging receipt proves only that the app accepted the send request, not delivery or execution.

Preserve the unique correlation ID, exact caller, target, return IDs, and receipt. Wait for the recipient's first-commentary
`COPY THAT` and terminal handoff before advancing a dependent gate.

Retry only after a definite messaging failure with no accepted receipt. Never resend an accepted-but-unobserved or
acknowledged packet.

After bounded observation without a matching acknowledgement, return `BLOCKED_DELIVERY_UNACKNOWLEDGED` with IDs,
receipt, recipient status, and observed-turn evidence. Do not infer an application queue or create a replacement task.
