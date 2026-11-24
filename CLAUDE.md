# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Website for "Перша баптистська церква" (First Cherkasy Baptist church). pnpm workspace with two packages:

- `frontend/` (`@fcb/app`) — Astro 7 site, SSR (`output: "server"`) on the Vercel adapter, Tailwind v4, React only as the integration Sanity requires.
- `studio/` (`@fcb/studio`) — Sanity Studio v6 (content schemas + Presentation tool).

UI copy, schema titles, and month/day name constants are all **Ukrainian**. Keep new user-facing strings in Ukrainian. (`404.astro` and the `post`/`event` schema field titles are still English template leftovers, not a pattern to follow.)

## Commands

```shell
pnpm dev                      # runs studio (:3333) and frontend (:4321) in parallel
pnpm --filter @fcb/app dev    # frontend only
pnpm --filter @fcb/app build  # astro check && tsc --noEmit && astro build  ← the type/lint gate
pnpm --filter @fcb/studio dev
pnpm --filter @fcb/studio deploy   # deploys the Studio to <studioHost>.sanity.studio
```

There is no test suite and no lint script. `pnpm --filter @fcb/app build` is the only automated verification — run it after non-trivial frontend changes. (`frontend/.eslintrc` is dead: it holds Prettier options and no ESLint is installed in that package.)

Node >= 22.12. pnpm only (do not generate a package-lock.json).

## Environment

Two separate env files, different prefixes — they are not shared:

- `frontend/.env` — `PUBLIC_SANITY_STUDIO_PROJECT_ID`, `PUBLIC_SANITY_STUDIO_DATASET`, `SANITY_API_READ_TOKEN`, `PUBLIC_SANITY_STUDIO_URL`, `PUBLIC_SANITY_VISUAL_EDITING_ENABLED`.
- `studio/.env` — `SANITY_STUDIO_PROJECT_ID`, `SANITY_STUDIO_DATASET`, `SANITY_STUDIO_PREVIEW_URL`, `SANITY_STUDIO_STUDIO_HOST`.

`PUBLIC_SANITY_VISUAL_EDITING_ENABLED` is a single switch with wide consequences (see `frontend/src/utils/sanity.ts` `loadQuery`): `"true"` → drafts perspective + stega encoding + read token + no CDN; anything else → published perspective + CDN + no stega. It also gates ISR in `astro.config.mjs` — with visual editing on, the Vercel cache is switched off so the Presentation tool can never serve a stale draft. Production must have it off, and `PUBLIC_SANITY_STUDIO_URL` must point at the deployed Studio (stega "Open in Studio" links are built from it). See README.md "Visual Editing notes" for the `createDataAttribute` pattern needed on non-string fields (images, Portable Text arrays), which stega cannot encode; `post/[slug].astro` is the worked example.

## Data flow

All GROQ lives in `frontend/src/utils/sanity.ts` — typed `getX()` wrappers plus the matching TS interfaces, all going through the shared `loadQuery`. Add new queries there rather than calling `sanityClient` from a page, and reuse the `imageProjection` fragment so `width`/`height`/`lqip` come along (used by `utils/image.ts` `buildSrcSet` for responsive images without layout shift).

Routes and what each fetches:

| Route | Page | Data |
| --- | --- | --- |
| `/` | `index.astro` | static sections; `News.astro` takes the 6 newest posts |
| `/news` | `news.astro` | `getPosts()` |
| `/post/[slug]` | `post/[slug].astro` | `getPost()`; `Astro.rewrite('/404')` when the doc is missing |
| `/calendar` | `calendar.astro` → `components/calendar/EventCalendar.astro` | **not Sanity**: Supabase, fetched in the browser (`utils/calendarApi.mjs`) |
| `/calendar/admin` | `calendar/admin.astro` → `components/calendar/CalendarAdmin.astro` | Supabase email/password login (same session as `/grafik/admin`); writes allowed only for users in `cal_admins` (RLS) |
| `/grafik` | `grafik.astro` → `components/grafik/Grafik.astro` | **not Sanity**: Supabase, fetched in the browser (`utils/grafikApi.mjs`) |
| `/grafik/admin` | `grafik/admin.astro` → same component with `admin` | Supabase email/password login; writes allowed only for users in `grafik_admins` (RLS) |

The preacher schedule (`/grafik`, `/grafik/admin`) does not use Sanity at all. `utils/preacherSchedule.mjs` renders the table, the per-date cards, the yearly stats and the admin editor; `utils/grafikApi.mjs` talks to Supabase over plain REST (no SDK). Tables: `grafik_preachers`, `grafik_months` (`key` = `YYYY-MM`, `services` jsonb, `a` jsonb = `{serviceId: {preacherId: slot}}`), `grafik_settings` (note + weekly template), `grafik_admins` (who may edit). The publishable key is public by design; override URL/key with `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY`. The Sanity `preacher`/`monthlySchedule` types are now unused by the site.

**Stega hygiene.** With visual editing on, every string returned by Sanity carries invisible stega characters. Harmless inside text nodes, breaking inside URLs and attributes — hence `stegaClean(post.slug.current)` in `News.astro` and `news.astro`. Wrap any Sanity string used to build an `href`, `src`, id, or query param.

## Frontend conventions

- Pages in `src/pages`, `.astro` components in `src/components` (calendar sub-components under `components/calendar/`).
- **Interactive logic is plain `.mjs` in `src/utils`, not framework components.** Two shapes, both in use:
  - the `.astro` file renders empty markup with ids and `data-*` attributes holding JSON, then a `<script>` block imports an `init*` function and wires it to those DOM nodes (`calendar.astro` → `eventCalendar.mjs`, `grafik.astro` → `preacherSchedule.mjs`, `Hero.astro` → `initHeroSlider.mjs` + `initMobileContentSliders.mjs`);
  - side-effect modules that find their own DOM and run on import (`initHeaderBehavior.mjs`, `icon.mjs`, both imported from `Layout.astro`).

  Follow this instead of adding React islands.
- Path alias `@/*` → `frontend/src/*` (root `tsconfig.json` additionally maps `@fcb/app/*` and `@fcb/studio/*`).
- Sliders are Swiper 14 (`createPanoramaEffect.mjs` is a custom Swiper effect module). Icons are `lucide`: write `<i data-lucide="name">` and `icon.mjs` replaces it via `createIcons` on every page.
- `Layout.astro` currently hard-codes `noindex, nofollow`. Removing that is a deliberate go-live decision, not a cleanup.

## Styling: three layers, and the direction of travel

1. `frontend/public/css/style.css` — hand-written BEM for the home-page sections (`.hero`, `.intro`, `.features`, `.news-card`, `.service-card`, `.btn`, `.section-head`, `.visually-hidden`). Linked directly from `Layout.astro`, so Tailwind never sees it.
2. `<style is:global>` blocks inside the component that owns them — `Header.astro`, `Footer.astro`, `Donate.astro`, `CodeBlock.astro`, the four `components/calendar/*` files, and `grafik.astro` (which is where every `.preachers-*` rule lives, ~300 lines of it).
3. Tailwind v4 utilities via `src/styles/global.css`, which declares the custom `max-*` breakpoints and the `container` utility with `@theme`/`@utility`. Used for page-level layout and for the newer pages (`news.astro`, `post/[slug].astro`).

Git history has been steadily moving sections out of (1) into (2) or (3), one section per commit. Put new styles in (2) or (3); don't grow `style.css`.

## Dates: two live traps

**Month indexing.** Sanity's `monthlySchedule.month` is 1–12; JS `Date` months are 0–11. `preacherSchedule.mjs` passes `month + 1` into its query, `getMonthlySchedule()` expects the 1-based value, and the schema's `prepare` uses `MONTHS_UK[month - 1]`. Check which convention you're in before touching schedule code.

**Event calendar.** `/calendar` is an Apple-Calendar-style app (`components/calendar/EventCalendar.astro` + `utils/eventCalendar.mjs`): year/month/day/list views with pinch/trackpad zoom, categories, search, light/dark theme. `/calendar/admin` (`utils/calendarAdmin.mjs`) edits events and categories. Data is Supabase, like `/grafik`: `cal_categories` (name, color), `cal_events` (date/end_date, start/end time, `repeat` + `repeat_until`, `exdates` = days removed from a series, `color`, `tint_day`), `cal_admins`. Repeats are expanded in the browser, so one row = one series. Both CSS files (`EventCalendar.css`, `CalendarAdmin.css`) are scoped under the `.cc` root so they can't leak into the site. The Sanity `event` type is now unused by the site.

**Week start.** The calendar grid is Monday-first (`DAYS_UK_SHORT` starts at "Пн", leading offset is `(getDay() + 6) % 7`); the preacher table is Sunday-first (`DAY_NAMES` starts at "Нд", indexed by raw `getDay()`). Don't move a day-index helper between them. `/grafik` renders only the month's services: the saved list from `grafik_months`, or the weekly template from `grafik_settings` (Wed 10:00, Sat 17:00 "Розбір Слова", Sun 11:00) when the month isn't saved yet. The first Sunday is bread-breaking (хліболамання) unless a service sets `bb`.

`MONTHS_UK` exists in three places: exported from `calendar.mjs` (`/grafik` imports it for its `<select>`), a private copy at the bottom of `preacherSchedule.mjs`, and again in `studio/src/schemaTypes/documents/monthlySchedule.ts` (the Studio can't import from the frontend). Change all three together.

## Studio

Schemas in `studio/src/schemaTypes/`, registered in `schemaTypes/index.ts` — a new type must be added to that array. Documents: `post`, `event`, `preacher`, `monthlySchedule`, `heroCarousel`; objects: `blockContent`, `seo`.

`structureTool` no longer uses the default structure: `heroCarousel` is pinned as a singleton (fixed `documentId: 'heroCarousel'`) and then filtered out of `S.documentTypeListItems()`. Any further singleton needs both halves — the explicit `listItem` **and** the filter — or it shows up twice and editors can create duplicates.

`sanity.config.ts` also wires the Presentation tool: `mainDocuments` maps `/post/:slug` back to a document, and `locations` maps `post` to its preview URL and `heroCarousel` to `/`. New previewable routes need matching entries. Note `defineLocations` requires `select` when you pass `resolve`; for a document that always lives at one URL, pass the static `{locations: [...]}` shape instead.

Custom inputs live in `studio/src/components/`. `DayPicker.tsx` is attached to `monthlySchedule.assignments[].day` via `components.input`: the stored value is a plain day **number**, and the `<input type="date">` is only UI sugar assembled from the sibling `month`/`year` through `useFormValue`. (`buildScheduleMap` in `preacherSchedule.mjs` still parses a `YYYY-MM-DD` string defensively for older data.)

Studio code uses its own Prettier config (in `studio/package.json`: no semicolons, single quotes, no bracket spacing, width 100). The frontend uses `frontend/.prettierrc` (width 120, default semicolons/double quotes). Match the package you're editing.

## Repo odds and ends

- `.agents/skills/` and `skills-lock.json` at the root are vendored third-party agent skills, not application code.
- `references/EVENT-CALENDAR.png` is the design reference the calendar page was built against.
- Video assets under `frontend/public/img/` are Git LFS tracked (see `.gitattributes`).
- `README.md` is still mostly the upstream Sanity template readme; the "Environment variables" and "Visual Editing notes" sections are the project-specific parts worth reading.
