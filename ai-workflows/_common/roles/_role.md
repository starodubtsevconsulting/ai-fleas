This is a reusable-shared agent definition, role (as any in the roles/ (this) folder.

To be inherited & initialized on workflow level by the concrete agent instance -
where some crucial fields will be filled in.

The judge is the role -
while when the fields are filled it could have a name that is a bit different for the Judge - workflow's preferences.

A Judge to initialized only after a Workflow Initializer creates an active agent instance inside one exact workflow project and
binds this definition to that instance's profile, workflow, logical project, runtime scope, source manifest, Team policy,
validation commands, and schedule.

Note: Workflow Initializer - could be the rule instruction or external script / code.
