# Tensey

Tensey is a free and open source app for building neural network graphs visually and exporting them to code. I am building it as a local-first tool, not a hosted service.

The project has two main parts:

- `@tensey/engine`: graph IR types, operator registration, DAG validation, shape inference, telemetry, factory helpers, and PyTorch export helpers.
- `@tensey/web`: a Vite React app for editing graphs on a canvas with a node palette, inspector, local persistence, templates, analysis output, and export actions.

## Current Shape

The application workspace is `tensey/`, not the repository root.

The web app uses React, Vite, Tailwind CSS, Zustand, lucide icons, and `@xyflow/react`. The engine package is plain TypeScript and has Vitest tests under `packages/engine/__tests__`.

This is an active FOSS project. It is useful now, but the API and UI are not frozen.

## Requirements

Use Node.js and pnpm.

This checkout has been built with:

- Node `v24.14.0`
- pnpm `10.32.1`

Other recent Node versions may work. I am not claiming support for every version until CI says so.

## Install

Run commands from the workspace directory:

```sh
cd tensey
pnpm install
```

If pnpm cannot write to its default store location, put the store inside the workspace:

```sh
cd tensey
pnpm install --store-dir .pnpm-store
```

## Run The Web App

Start the Vite development server for the web package:

```sh
cd tensey
pnpm --filter @tensey/web dev
```

Vite prints the local URL after startup, usually `http://localhost:5173/`.

## Checks

Run typechecks and tests across the workspace:

```sh
cd tensey
pnpm -r typecheck
pnpm -r test
```

The root scripts call the same workspace commands:

```sh
cd tensey
pnpm typecheck
pnpm test
```

For the web app only:

```sh
cd tensey
pnpm --filter @tensey/web typecheck
pnpm --filter @tensey/web build
```

## Project Layout

```text
tensey/
  package.json
  pnpm-lock.yaml
  pnpm-workspace.yaml
  packages/
    engine/
      src/
      __tests__/
      package.json
    web/
      src/
      package.json
```

## Contributing

Issues and patches are welcome. Keep changes small, explain the behavior change, and run the relevant checks before sending a PR.

Do not add hosted-service assumptions. Tensey should stay usable as a local app.

## License

This project is intended to be FOSS. That's why I used the MIT License.
