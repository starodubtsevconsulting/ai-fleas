# Goal-backed continuation

Use only after verifying that the selected Coder transport can set a persistent goal, identify its session or task,
observe status, and stop or resume it without duplicating work. A goal is a completion contract for Coder's own
implementation iterations, not extra authority. Include outcome, write/read scopes, constraints, completion evidence,
turn or time budget, and conditions that require a report to Admin. Keep independent Command Runner, review, and human
gates outside Coder's goal.

Set the goal once, verify acknowledgement and its task/session identity, then monitor with bounded waits. Let Coder
investigate, revise, and self-check within its allowed scope until it meets the completion contract or encounters a
scope/design blocker. Admin inspects the final diff and obtains independent checks after the goal reports back. Do not
use this strategy merely by placing the word “goal” in a prompt: an ordinary one-shot A2A message has no verified
cross-turn continuation. If the transport has a shorter hard task timeout than the expected work, repair that transport
or use smaller stages first; a scheduler that only polls cannot extend the remote task's lifetime.
