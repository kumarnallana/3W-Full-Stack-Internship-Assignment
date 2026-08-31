# 3W Mini Social Application

A responsive React frontend for the 3W full-stack internship assessment. The interface follows the familiar social-feed mental model while using an original, restrained dark visual identity and deliberately improving the mobile, desktop, loading, and password experiences observed in the TaskPlanet reference recordings.

## Current scope

The repository currently contains the frontend workstream. Backend, Express, MongoDB schemas, and image-storage implementation remain separate so they can be connected through the documented API boundary.

Implemented frontend experiences:

- Accessible signup and login screens.
- Independent visibility controls for every password field.
- Protected feed route and session bootstrap.
- Offline Explorer Mode for authentication, feed, posts, images, likes, and comments when the backend cannot be reached.
- Text-only, image-only, and combined post composer.
- Image preview, removal, type validation, and 5 MB size validation.
- Public feed cards with author, timestamp, content, media, likes, and comments.
- Optimistic like/unlike updates with rollback on failure.
- Immediate comment and new-post insertion from API responses.
- Skeleton, empty, error, retry, media-failure, and contextual loading states.
- Load-more pagination UI.
- Purpose-built mobile, tablet, laptop, and desktop layouts.
- Reduced-motion support, visible focus states, semantic controls, and accessible labels.

TailwindCSS is not installed or used.

## Project structure

```text
frontend/
├── src/
│   ├── components/
│   │   ├── auth/
│   │   ├── feedback/
│   │   ├── layout/
│   │   ├── posts/
│   │   └── ui/
│   ├── context/
│   ├── pages/
│   ├── services/
│   ├── styles/
│   └── utils/
├── .env.example
├── index.html
├── package.json
└── vite.config.js
```

The implementation rationale and provisional API contract are recorded in [`FRONTEND_IMPLEMENTATION_PLAN.md`](./FRONTEND_IMPLEMENTATION_PLAN.md).

## Run locally

Use a current LTS release of Node.js and pnpm.

```bash
cd frontend
pnpm install
cp .env.example .env
pnpm dev
```

On Windows PowerShell, copy the environment file with:

```powershell
Copy-Item .env.example .env
```

The default frontend URL is `http://localhost:5173`.

## Environment

```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_ENABLE_EXPLORER_MODE=true
```

The client sends cookies with `credentials: "include"`. If the backend returns a bearer token, the compatibility layer keeps it in `sessionStorage` for the current browser tab and attaches it to subsequent requests. An HTTP-only cookie remains the preferred production authentication mechanism.

Explorer Mode activates only when `fetch` cannot reach the configured backend or the request times out. Normal HTTP errors such as validation, authentication, and server responses are still surfaced to the UI instead of being converted into mock successes. Set `VITE_ENABLE_EXPLORER_MODE=false` to require the real API during integration testing.

## Expected backend endpoints

All path assumptions are isolated in `frontend/src/services/`:

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/auth/signup` | Create an account |
| `POST` | `/auth/login` | Authenticate |
| `POST` | `/auth/logout` | End the session |
| `GET` | `/auth/me` | Restore the current user |
| `GET` | `/posts?page=1&limit=10` | Load the public feed |
| `POST` | `/posts` | Create a post using `multipart/form-data` |
| `POST` | `/posts/:postId/like` | Toggle the current user's like |
| `POST` | `/posts/:postId/comments` | Add a comment |

The normalizers accept common response envelopes such as `{ data }`, `{ user, token }`, `{ posts, pagination }`, direct resources, and MongoDB `_id` values. Adjust only the service layer when the final backend contract differs.

## Production build

```bash
cd frontend
pnpm build
```

The generated production files are written to `frontend/dist/`.
