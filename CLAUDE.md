# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Website for "Перша баптистська церква" (First Cherkasy Baptist church). pnpm workspace with two packages:

- `frontend/` (`@fcb/app`) — Astro 7 site, SSR (`output: "server"`) on the Vercel adapter, Tailwind v4, React only as the integration Sanity requires.
- `studio/` (`@fcb/studio`) — Sanity Studio v6 (content schemas + Presentation tool).

UI copy, schema titles, and month/day name constants are all **Ukrainian**. Keep new user-facing strings in Ukrainian.

## Commands

```shell
pnpm dev                      # runs studio (:3333) and frontend (:4321) in parallel
pnpm --filter @fcb/app dev    # frontend only
pnpm --filter @fcb/app build  # astro check && tsc --noEmit && astro build  ← the type/lint gate
pnpm --filter @fcb/studio dev
pnpm --filter @fcb/studio deploy   # deploys the Studio to <studioHost>.sanity.studio
```

There is no test suite. `pnpm --filter @fcb/app build` is the only automated verification — run it after non-trivial frontend changes.

Node >= 22.12. pnpm only (do not generate a package-lock.json).

## Environment

Two separate env files, different prefixes — they are not shared:

- `frontend/.env` — `PUBLIC_SANITY_STUDIO_PROJECT_ID`, `PUBLIC_SANITY_STUDIO_DATASET`, `SANITY_API_READ_TOKEN`, `PUBLIC_SANITY_STUDIO_URL`, `PUBLIC_SANITY_VISUAL_EDITING_ENABLED`.
- `studio/.env` — `SANITY_STUDIO_PROJECT_ID`, `SANITY_STUDIO_DATASET`, `SANITY_STUDIO_PREVIEW_URL`, `SANITY_STUDIO_STUDIO_HOST`.

`PUBLIC_SANITY_VISUAL_EDITING_ENABLED` is a single switch with wide consequences (see `frontend/src/utils/sanity.ts` `loadQuery`): `"true"` → drafts perspective + stega encoding + read token + no CDN; anything else → published perspective + CDN + no stega. Production must have it off, and `PUBLIC_SANITY_STUDIO_URL` must point at the deployed Studio (stega "Open in Studio" links are built from it). See README.md "Visual Editing notes" for the `createDataAttribute` pattern needed on non-string fields (images, Portable Text arrays), which stega cannot encode.

## Data flow

All GROQ lives in `frontend/src/utils/sanity.ts` — typed `getX()` wrappers plus the matching TS interfaces, all going through the shared `loadQuery`. Add new queries there rather than calling `sanityClient` from a page, and reuse the `imageProjection` fragment so `width`/`height`/`lqip` come along (used by `utils/image.ts` `buildSrcSet` for responsive images without layout shift).

The exception is `utils/preacherSchedule.mjs`, which queries `sanity:client` from the **browser** because the schedule re-fetches when the user changes month/year.

**Month indexing is a live trap.** Sanity's `monthlySchedule.month` is 1–12; JS `Date` months are 0–11. `preacherSchedule.mjs` passes `month + 1` into the query and the schema's `prepare` uses `MONTHS_UK[month - 1]`. Check which convention you're in before touching schedule code.

## Frontend conventions

- Pages in `src/pages`, `.astro` components in `src/components` (calendar sub-components under `components/calendar/`).
- **Interactive logic is plain `.mjs` in `src/utils`, not framework components.** The pattern: the `.astro` file renders empty markup with ids/`data-*` attributes holding JSON, then a `<script>` block imports an `init*` function from a `.mjs` module and wires it to those DOM nodes (`calendar.astro` → `calendar.mjs`, `grafik.astro` → `preacherSchedule.mjs`, `Layout.astro` → `initHeaderBehavior.mjs` + `icon.mjs`). Follow this instead of adding React islands.
- Path alias `@/*` → `frontend/src/*` (root `tsconfig.json` additionally maps `@fcb/app/*` and `@fcb/studio/*`).
- Styling is split: Tailwind v4 via `src/styles/global.css` (custom breakpoints and a `container` utility declared there with `@theme`/`@utility`), plus a hand-written legacy `public/css/style.css` linked directly from `Layout.astro` — component classes like `.preachers-table` live there, not in Tailwind.
- `Layout.astro` currently hard-codes `noindex, nofollow`. Removing that is a deliberate go-live decision, not a cleanup.
- Video assets under `public/img/` are Git LFS tracked (see `.gitattributes`).

## Studio

Schemas in `studio/src/schemaTypes/`, registered in `schemaTypes/index.ts` — a new type must be added to that array. Documents: `post`, `event`, `preacher`, `monthlySchedule`; objects: `blockContent`, `seo`.

`sanity.config.ts` wires the Presentation tool: `mainDocuments` maps `/post/:slug` back to a document and `locations` maps a post to its preview URL. New previewable routes need entries in both.

Custom inputs live in `studio/src/components/` (e.g. `DayPicker.tsx`, attached to `monthlySchedule.assignments[].day` via `components.input`).

Studio code uses its own Prettier config (in `studio/package.json`: no semicolons, single quotes, no bracket spacing, width 100). The frontend uses `frontend/.prettierrc` (width 120, default semicolons/double quotes). Match the package you're editing.
