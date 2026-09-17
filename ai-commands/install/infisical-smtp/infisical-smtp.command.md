# Infisical SMTP overlay

Reconcile only the SMTP environment of one existing, explicitly selected Infisical Compose backend. The command does
not adopt or reinstall the stack, manage its database, provision the relay, create credentials, or send email. It is
separate from the `infisical` installer, which owns only its own deployment.

The private profile binds command ID `infisical-smtp` to a `config.env` containing exact SSH alias, deployment root,
Compose path, project and backend service names, protected SMTP file path, and expected non-secret relay metadata.
See [the fictional template](infisical-smtp.command.example.config). No credential value belongs in this file or Git.
The remote SMTP file must already exist as a root-owned regular file with mode `0600`; the approved recovery credential
store holds a separate copy. Infisical cannot fetch its own startup SMTP credential from itself as the sole source.

| Operation | Result |
| --- | --- |
| `validate` | Check the profile binding and exact configuration locally; no SSH or secret access. |
| `status` | Read-only remote verification of file protection, expected metadata, Compose overlay and baseline fingerprint, backend health, and exact runtime SMTP environment. Emits only fixed status codes. |
| `apply --apply` | Add the backend-only SMTP file reference if absent, or reconcile a changed SMTP file; validate the resolved Compose change, recreate only the backend, wait for health, and record a scoped, value-free ownership receipt. |

Only a Compose service with no existing `env_file` or the exact configured SMTP file is supported. Existing unrelated
`SMTP_*` values in the Compose environment fail closed. Before adding the reference, the command creates a mode-`0600`
backup of the original Compose file. It compares resolved Compose configurations in memory and requires all other
services and all preexisting backend settings to remain identical; only the declared SMTP keys may appear. Failed
validation restores the Compose backup. If backend startup fails, it also recreates the original backend. It never prints resolved Compose,
Docker diagnostics, environment values, or the credential.

The receipt at `<remote_root>/.infisical-smtp-owner.json` records the profile/workflow/project scope, a hash of the
non-secret configuration, and a hash of the resolved Compose baseline after excluding the SMTP keys. Later drift fails
closed. The receipt asserts ownership of the SMTP overlay only, not the underlying deployment. If an existing healthy
overlay exactly matches the selected configuration, first apply records the receipt without restarting the backend.

After apply, verify TLS and relay authentication separately, then send one credential-free message to an explicitly
approved recipient and confirm inbox delivery. Those steps, and any Infisical-generated invitation/reset test, are
outside this command. A healthy backend alone does not prove delivery.
