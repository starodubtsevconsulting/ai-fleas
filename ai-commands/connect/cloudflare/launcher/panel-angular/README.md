# Tunnel controller Angular panel

`src/main.ts` only bootstraps the application. `src/app/app.component.*` owns the
controller state, IPC actions, polling, and split-pane layout.

Named presentation components live under `src/app/components/`:

- `controller-header`: title and refresh action.
- `profile-selector`: profile/workflow selection.
- `server-list`: responsive rows/cards and start/stop actions.
- `server-details`: selected-server status and public URL.
- `connector-logs`: colored output, server filter, and search.

Every component has matching `.component.ts`, `.component.html`, and
`.component.css` files. Shared types are in `app/models.ts`; pure filtering is in
`app/utils/`. Global styles contain only the shared theme and common controls.
Styles use Angular's emulated encapsulation so each component owns its styles.
Presentation component hosts use `display: contents` to preserve flex sizing.

Run `npm run build:panel` for strict Angular template/type checking and
`npm run test:panel` for structure, status binding, search, filtering, and safe
text-rendering regression checks. The controller's `app.sh --serve-check` runs
these checks alongside the existing shell and Electron tests.

`npm run test:panel:smoke` runs an isolated Electron renderer with mock IPC. It
checks rendered rows, start/stop states, log filters/search/colors/viewport,
details collapse/reopen, and the right splitter without touching live connectors.
This is not an end-to-end test of actual tunnel IPC or network connectivity.
