# Example profile-wide command resources

Reusable command implementations remain in the sibling `ai-commands/`
catalog. This folder contains only profile-owned configuration selected by an
explicit `commands[].config` reference.

The source-control example binds the provider-neutral `source-control` command
to the reusable `git` provider command. Authentication and the populated Git
identity remain local.
