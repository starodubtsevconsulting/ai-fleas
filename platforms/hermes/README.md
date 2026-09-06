# Hermes Agent adapter

This public adapter maps an AI Fleas logical agent to a Hermes profile backed by the provider target and model selected
in the active AI Profile. Hermes is the agent platform; the selected provider target is where its model runs. A local
computer, LAN model box, or cloud-compatible endpoint therefore changes profile configuration without changing the
platform contract.

The portable `hermes` command owns installation and profile-management operations. A launcher may present or invoke
those operations, but it does not own their configuration or agent-lifecycle semantics.

| Portable concept | Hermes realization |
| --- | --- |
| logical agent | profile-scoped Hermes agent configuration |
| agent instance | configured Hermes profile |
| instance ID | exact Hermes profile ID |
| runtime scope | selected AI Profile, workflow, and project |
| activate | reconcile and verify the exact Hermes profile |
| deactivate | explicitly delete the exact non-default profile |
| send/receive | Hermes conversation within the selected profile |
