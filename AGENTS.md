# Repository Guidelines

## Project Structure & Module Organization
The platform is a Next.js 14 App Router app. Page logic lives in `app/`, with `page.tsx` powering the timeline and nested routes (`content/[id]`, `tags`, `guests`) handling filtered views. Shared UI stays in `components/`, while Feishu clients, SQLite helpers, and types belong in `lib/`. Generated artifacts such as `data/analytics.db` should be ignored in version control. Static assets go in `public/`, and utilities or diagnostics, including `scripts/test-feishu.js`, live in `scripts/`.

## Build, Test, and Development Commands
Install dependencies once via:
```bash
npm install
```
Use `npm run dev` for the local server at `http://localhost:3000`, `npm run build` to produce the optimized bundle, and `npm start` to serve the build. Run linting with `npm run lint` before committing so `eslint-config-next` can flag TypeScript, accessibility, and Tailwind usage issues.

## Coding Style & Naming Conventions
Match the existing formatting: two-space indentation, explicit semicolons, and single quotes for strings. Prefer `const`, lean on `async/await`, and import through the configured alias (`@/`) for internal modules. Components use PascalCase filenames (`TimelineView.tsx`); hooks, helpers, and API utilities stay camelCase. Keep Tailwind utility strings grouped on the JSX element, and when adding server handlers follow the App Router pattern (`route.ts`) to separate server logic from client code.

## Testing Guidelines
No automated unit suite exists yet, so treat `npm run lint` as the baseline gate. Validate the Feishu integration with `node scripts/test-feishu.js` once `.env.local` is populated. If you introduce tests, co-locate lightweight checks next to the module (`*.test.ts`) or drop integration probes in `scripts/`, and keep fixtures free of production data.

## Commit & Pull Request Guidelines
Write commits in the imperative mood (`Add Feishu token refresh`) and keep them scoped to a single concern. Reference related Notion or issue IDs in the body when available, and outline user-facing impact plus rollout notes in the pull request. Every PR should include screenshots for UI changes, list manual checks (lint, dev server smoke, Feishu script), and call out schema or env updates for reviewers.

## Environment & Secrets
All Feishu credentials and site configuration stay in `.env.local`; never commit them or sample values. When you add settings, document them in `README.md` and update deployment targets (Vercel, Railway). Rotate tokens when teammates change and prune unused Feishu app permissions to protect the analytics store.
