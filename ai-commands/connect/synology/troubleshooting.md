# Synology troubleshooting

Use the command's read-only diagnostics before changing DSM or credentials. Never treat an HTTP or DSM error number as
proof that the stored password is wrong.

## `SYNO.Core.Share_DSM_API_ERROR_403`

For DSM 7.3.2 share creation, `403` commonly means the mutating request used the pre-7.3.2 flat payload. It does not by
itself mean that the administrator password or group membership is wrong. The supported command path must:

1. request a CSRF token during login and send it as `X-SYNO-TOKEN`;
2. send the share name as the top-level JSON parameter;
3. send creation fields inside the JSON `shareinfo` envelope;
4. keep the envelope to the verified fields declared by the command;
5. verify the share, dedicated account, Team Folder, permission, and secret-store receipt after apply;
6. repeat apply and confirm that the consumer credential was not rotated.

The focused test `pins the DSM 7.3.2 create-share wire format` prevents the payload from silently returning to the old
flat shape. A live accepted apply and an idempotent repeat apply remain the acceptance test.

If `403` remains after the payload test passes, run `api catalog` and `api status <share-id>`. Successful authenticated
reads show that the credential works. Then verify the discovered request format, CSRF token propagation, DSM version,
and only afterward the administrator's DSM privileges. Do not rotate or expose a stored password merely because a
mutating endpoint rejected its request shape.

## `DSM_API_ERROR_3300`

For the same DSM release family, `3300` after changing the envelope usually means unsupported or legacy fields were
included inside `shareinfo`. Compare the envelope with the regression test and remove undeclared fields. Do not switch
to UI creation until the command's payload has been checked and a read-only status call confirms the live state.

## Authentication errors

Authentication failures occur before share reconciliation. Check the exact documented DSM authentication code, the
declared Infisical binding, account state, two-factor requirements, and certificate pin. Keep credentials out of
arguments, logs, tickets, and agent-visible output.
