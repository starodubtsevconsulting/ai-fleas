# Hermes App installation target

Canonical target: `hermes-app`. Human aliases include `Hermes` and `Hermes App`.

This target owns physical Hermes package status, installation, stable update checks, and upgrades. It delegates to the
existing reviewed Hermes installer while the legacy `hermes-app install` route remains compatible. Uninstall fails
closed until an ownership-safe uninstaller is implemented; it never deletes profiles, conversations, or workflow groups.
