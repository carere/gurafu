# Gurafu

A shadcn-compatible registry for SolidJS trading charts, built on
[Zaidan](https://zaidan.carere.dev) and
[TradingView Lightweight Charts v5](https://tradingview.github.io/lightweight-charts/).

The foundation is a single TanStack Start application using Solid, Vite,
and Tailwind CSS, targeting Cloudflare Workers at <https://gurafu.carere.dev>.
Bun manages dependencies and runs the tooling; development and preview use
Cloudflare's local Workers runtime through its Vite plugin.

## Development

Install [proto](https://moonrepo.dev/proto) and [Cocogitto](https://docs.cocogitto.io/)
(`cog`, used by the conventional commit hook), then run:

```sh
proto trust .prototools
proto install
bun install
moon run gurafu:dev
```

The application runs at <http://localhost:3000>. Runtime and Moon versions are
pinned in `.prototools`. `bun install` installs the Lefthook Git hooks.

## Commands

Moon owns the project tasks; `package.json` only contains the installation hook.

| Command                              | Purpose                                              |
| ------------------------------------ | ---------------------------------------------------- |
| `moon run gurafu:dev`                | Build the registry and start development             |
| `moon run gurafu:check`              | Check formatting, imports, and lint rules with Biome |
| `moon run gurafu:fix`                | Apply Biome fixes                                    |
| `moon run gurafu:tsc`                | Check TypeScript                                     |
| `moon run gurafu:knip`               | Find unused code and dependencies                    |
| `moon run gurafu:r-validate-kobalte` | Validate the registry catalog                        |
| `moon run gurafu:r-build-kobalte`    | Validate and generate registry JSON                  |
| `moon run gurafu:build`              | Build the registry and production application        |
| `moon run gurafu:preview`            | Preview the production build locally                 |
| `moon run gurafu:deploy`             | Build and deploy to Cloudflare Workers               |
| `moon run gurafu:deploy-preview`     | Build and publish a Cloudflare Worker Preview        |

To run the same checks as CI:

```sh
moon run gurafu:check gurafu:tsc gurafu:knip gurafu:build
```

Build before running `preview`. `GET /api/health` returns `{ "status": "ok" }`
through a TanStack Start server route.

## Hosting

`wrangler.jsonc` configures the `gurafu` Worker and the custom domain
`gurafu.carere.dev`. The Cloudflare Vite plugin builds the server and static
assets into `dist/` and generates the deployment configuration.

GitHub Actions validates and builds every push to `main` and every PR. A
successful `main` build deploys production to `gurafu.carere.dev`. PRs from this
repository publish a Cloudflare Worker Preview named `pr-<number>`, with a stable
URL exposed through GitHub Deployments and the workflow summary. Fork PRs run
the checks without deployment credentials. Each deployment is checked for a
responding homepage, health endpoint, and registry catalog.

The workflow uses the repository secret `CLOUDFLARE_API_TOKEN` and repository
variable `CLOUDFLARE_ACCOUNT_ID`. The token must permit Worker deployments and
custom-domain management for the `carere.dev` zone.

For a manual production deployment, authenticate Wrangler and run
`moon run gurafu:deploy`. For a manual preview, run
`moon run gurafu:deploy-preview -- --name <preview-name>`. Worker Previews use
Cloudflare's open-beta Preview deployment feature; their configuration and
resources are separate from production. Remove a finished preview with
`bun wrangler preview delete --name <preview-name>`.

Keep local Worker secrets in a gitignored `.dev.vars` file. Set production
secrets with Wrangler when provider integrations are added.

## Logo assets

`public/logo-light.svg` and `public/logo-dark.svg` are fixed Market logo variants.
The homepage selects between them using the application's `.dark` theme class.
`public/logo.svg` and `public/favicon.svg` adapt to the system color scheme through
an embedded SVG media query. All versions share the same candlestick geometry.

## Registry

`components.json` configures the upstream `@zaidan` registry and its `kobalte`
style. Website UI lives in `src/components/ui`; shared styling is installed from
Zaidan. Add upstream components with:

```sh
bun --bun shadcn add @zaidan/button
```

Gurafu's own catalog lives at `src/registry/kobalte/registry.json`. The build
validates it before generating static JSON in `public/r/kobalte`, which is
served at `/r/kobalte/registry.json`. Generated registry files are ignored by Git
and rebuilt before development and production builds.

The catalog starts empty. There is no installable chart yet: the reusable
component API and the migration of Ashiso's indicators and multiple-timeframe
charts will be designed separately. Lightweight Charts is pinned to v5 and
reserved for that implementation.

## Source layout

```text
src/
  components/ui/      Website components installed from Zaidan
  lib/               Website utilities
  registry/kobalte/  Source code and catalog for distribution
  routes/            Application pages and server routes
  styles/            Styles installed from Zaidan
  router.tsx         TanStack router configuration
  styles.css         Tailwind and theme entry point
```

Keep distributed registry code independent of application routes and server
implementations. Consumers should be able to install the components into other
Solid applications without adopting TanStack Start or using Gurafu's hosted
services. Provider integrations and credentials will be added with the data
integration work.
