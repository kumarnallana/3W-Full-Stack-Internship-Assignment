# Frontend Implementation Plan

## Audit summary

- The repository currently contains only a minimal root `README.md`.
- No frontend framework, UI components, styles, backend routes, or API types exist yet.
- The official assessment requires React, responsive styling without TailwindCSS, authentication screens, text/image post creation, a public feed, likes, comments, and immediate UI updates.
- Both supplied TaskPlanet screen recordings are product references for feed behaviour, navigation patterns, and the usability problems we should improve.
- Backend and MongoDB implementation remain outside this frontend workstream.
- Because no backend contract is present, all HTTP assumptions will be isolated in `frontend/src/services/` and documented for easy replacement.

## Implementation approach

1. Scaffold a Vite-powered React application in `frontend/` using standard CSS and centralized design tokens.
2. Build `/login`, `/signup`, and `/feed` routes with a protected feed route.
3. Create a responsive application shell:
   - mobile bottom navigation;
   - tablet spacing and sizing adjustments;
   - desktop side navigation and a readable 620-700px feed column.
4. Build focused product components: authentication layout, independent password field, composer, post card, comment thread, skeleton, empty state, and error state.
5. Centralize authentication and post requests behind service modules configured by `VITE_API_BASE_URL`.
6. Use local optimistic updates for likes and successful comment/post responses without full-page refreshes.
7. Add contextual loading, validation, error, retry, and empty states.
8. Verify the production build and inspect the interface at 375px, 768px, 1024px, and 1440px.

## Original visual direction

- Treat TaskPlanet as a behavioural reference, never as a pixel target.
- Do not reuse its blue/yellow identity, exact cards, navigation styling, or mobile-only desktop shell.
- Use a distinctive warm-neutral canvas, deep ink typography, ember-coral primary accent, and restrained mint support color.
- Prefer crisp borders, intentional whitespace, modest elevation, and one consistent icon family over generic MUI/Bootstrap defaults.
- Preserve a readable social-feed width while adapting the surrounding navigation and context for desktop.

## Expected backend contract

The exact paths are centralized and can be changed in one file when the backend is ready. Initial assumptions are:

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/posts?page=1&limit=10`
- `POST /api/posts` using `multipart/form-data`
- `POST /api/posts/:postId/like`
- `POST /api/posts/:postId/comments`

The client will accept common response envelopes such as `{ data: ... }`, `{ user, token }`, `{ posts, pagination }`, or a direct resource body. Cookie authentication is supported through `credentials: "include"`; a returned bearer token is retained only for the current browser tab for compatibility.

## Definition of done for this frontend pass

- Production build succeeds.
- No TailwindCSS is installed or referenced.
- Login and signup forms have accessible labels and independent password visibility.
- Feed supports text-only, image-only, and combined posts while blocking empty posts.
- Like and comment interactions update the relevant post without reloading the page.
- Responsive shells are intentionally different across mobile, tablet, and desktop.
- Loading, empty, error, and retry states are present.
- API assumptions and environment configuration are documented.
