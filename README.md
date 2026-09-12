# Personal Assistant

A React + Vite personal assistant workspace with a drag-and-drop task board and a small Express API.

## Getting started

```bash
npm install
npm run dev
```

The client runs at `http://localhost:5173` and the API runs at `http://localhost:3001`.

The initial API health check is available at `http://localhost:3001/api/health`.

## Deploy to Render

This repository includes `render.yaml` for a single Render Web Service. The service builds the React client, serves it from Express, and keeps SQLite data on a persistent disk.

1. Push the repository to GitHub or GitLab.
2. In Render, choose **New > Blueprint** and select the repository.
3. Render will use `render.yaml` to create the service and persistent disk.
4. Open the generated service URL and create the first account.

The local API URL remains available during development. In production the client uses the same origin as the Express service.

## Database

The API uses SQLite and creates `data/workbench.sqlite` on first start. Boards, phases, cards, due dates, priorities, and attachment names are persisted there. The client loads the workspace from `GET /api/workspace` and saves changes through `PUT /api/workspace`.

To use a different database file, set `DATABASE_PATH` before starting the API.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
