# Example workflow-specific configuration

Reusable workflow definitions live in the monorepo `ai-workflows/` catalog. This `workflows-config/` folder contains only profile-specific policies, templates, and command configuration scoped to a workflow.

The different name is intentional: these files configure reusable workflows and the commands used within them; they do not define workflows themselves.

Configuration should live at the narrowest applicable scope.
