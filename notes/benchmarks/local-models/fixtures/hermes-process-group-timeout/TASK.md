Modify only the staged `run-installer-with-timeout.py` named in the assignment. Preserve its interface: `TIMEOUT COMMAND [ARG ...]`, positive integer timeout, inherited standard streams, normal child exit status, timeout diagnostic, and exit status 124.

The helper starts `COMMAND` with `start_new_session=True`. On timeout, send SIGTERM to that child's process group, wait up to five seconds, then send SIGKILL to the group if it has not stopped; reap the direct child. On external SIGINT or SIGTERM, forward the received signal to the same process group and reap the direct child. A descendant that remains in the group must not survive either path. Handle races where the group has already exited.

Do not edit the production helper, verifier, tests, or any other file. Do not create scratch files or directories. Inspect the changed staged file before reporting completion.
