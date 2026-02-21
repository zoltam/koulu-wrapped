# AGENTS.md

## Project Purpose
- Build a "Spotify Wrapped"-style web experience for high school students.
- The app summarizes a student's school year using data from Wilma (messages, grades, attendance).
- Wilma does not provide an API for this use case, so data is gathered via server-side browser automation (Puppeteer scraping).

## Tech Stack
- Framework: Next.js App Router (TypeScript)
- UI: React, Tailwind CSS, shadcn/ui primitives, Framer Motion
- Scraping: Puppeteer in a Next.js API route
- Runtime model: client pages call internal API route, API route logs into Wilma and scrapes data

## Key App Flow
1. User opens `/signin` and submits Wilma credentials.
2. Credentials are sent to `app/api/connect-wilma/route.ts` for login verification.
3. On success, app navigates to `/wrapped?loading=true`.
4. `/wrapped` sequentially requests three scraping steps from the same API route:
   - `step: "unread"`
   - `step: "grades"`
   - `step: "attendance"`
5. Results are stored in `sessionStorage` and consumed by `components/Slideshow.tsx`.

## Source of Truth Files
- `app/api/connect-wilma/route.ts`: login + scraping logic and step routing
- `app/signin/page.tsx`: credential collection + initial auth flow
- `app/wrapped/page.tsx`: orchestration/loading states for data fetches
- `components/Slideshow.tsx`: "wrapped" slides and calculated stats
- `app/globals.css`, `tailwind.config.ts`: design tokens and styling system

## Developer Commands
- Install deps: `npm install`
- Start dev server: `npm run dev`
- Lint: `npm run lint`
- Build: `npm run build`
- Run production server: `npm run start`
- Test scraping directly: `WILMA_USERNAME=... WILMA_PASSWORD=... npm run scrape:test -- --step all --out tmp/scrape-output.json`

## Local Workflow Preference
- Do not run `npm run build` after making changes.
- The user keeps a dev server running and handles build verification manually.
- Use targeted checks (for example `npm run lint`) only when needed.
- Prefer `npm run scrape:test` for scraping checks instead of manually testing through the sign-in UI.

## Scraping and Data Extraction Rules
- Prefer extending `route.ts` step-by-step instead of adding separate scraping endpoints.
- Keep selectors resilient; Wilma DOM can change. Validate selectors before relying on them.
- If scraping fails, return structured JSON errors and preserve useful server logs.
- Reuse existing `step` dispatch pattern in `POST` for new metrics.
- Keep scraped payloads minimal: only return fields needed by UI.

## Credentials and Privacy Constraints
- Treat Wilma credentials as highly sensitive.
- Do not add credential logging (including masked logs that can leak structure).
- Avoid storing credentials beyond what current flow requires; prefer short-lived storage.
- Never commit real credentials, session data, or scraped personal data.
- If changing auth/storage behavior, call it out clearly in PR notes.

## UI and Product Guidelines
- Preserve the "wrapped" storytelling feel: animated, slide-based, short insights.
- Keep mobile-first layout behavior working (`max-w-md` slideshow container is intentional).
- When adding slides, ensure empty-data states remain graceful (`N/A`, `0`, fallback labels).
- Keep transitions smooth but lightweight (Framer Motion is already in place).

## Change Guidelines for Agents
- Make focused changes; avoid broad refactors unless required by task.
- Maintain TypeScript typing quality, especially for scraped data structures.
- When changing scraping selectors/logic, also update UI assumptions if shapes change.
- Prefer adding small helper functions over duplicating parsing logic.
- Preserve existing app routes and user flow unless explicitly asked to redesign.

## Validation Checklist Before Finishing
- App still compiles (`npm run build`) or at minimum lints cleanly (`npm run lint`).
- Sign-in -> wrapped flow still works end-to-end.
- API route returns stable JSON for each step.
- `npm run scrape:test` returns expected JSON structure for the step being verified.
- UI handles missing/partial scrape results without crashing.
- No sensitive data introduced in logs, code, or committed files.

## Known Limitations
- Wilma markup/text can vary, so selectors and Finnish status strings may require maintenance.
- Some scraped text currently shows encoding artifacts; avoid hardcoding new mojibake strings.
- Current flow performs three sequential scrape calls; this is simple but not the fastest.
