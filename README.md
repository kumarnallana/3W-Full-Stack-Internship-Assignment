# Mini Social — 3W Full-Stack Assessment

[![Live Demo](https://img.shields.io/badge/Live_Demo-Click_Here-blue?style=for-the-badge&logo=vercel)](https://frontend-g4fxx4r1u-sasi-kumar-nallana.vercel.app/)

> 🚀 **Recruiters & Reviewers:** Please click the badge above or visit **[https://frontend-g4fxx4r1u-sasi-kumar-nallana.vercel.app/](https://frontend-g4fxx4r1u-sasi-kumar-nallana.vercel.app/)** to observe the live interactive demo of this assessment!

Mini Social is a complete React, Express, and MongoDB social-post application built for the 3W Full-Stack Internship Assessment. It keeps the assessment scope focused—authentication, posts, images, likes, and comments—while providing a premium, original mobile-first interface and robust full-stack architecture.

The important correctness rule is simple: **an API rejection never becomes a successful login**. Real mode uses the Express/MongoDB API. Only a genuine network failure, unreachable backend, or timeout can move the browser into the clearly labelled local demo, where credentials are still verified exactly.

## Delivered product

- Account creation and login with matching frontend and server validation.
- Signup passwords use 8–64 characters with at least one letter and one number; login verifies any non-empty submitted password against the stored hash.
- Independent show/hide control for every password field.
- bcrypt password hashing; plaintext passwords are never stored.
- JWT authentication through an HTTP-only cookie; the real client never stores the token in browser storage.
- Protected public feed with pagination.
- Cross-account visibility: a post created by one account remains visible when another account logs in.
- Text-only, image-only, and text-plus-image posts.
- Click-to-open full-screen post images with uncropped responsive containment.
- Persistent likes and embedded comments with one-level replies, reply context, and immediate UI updates.
- ID-backed `@mention` autocomplete with keyboard and touch selection; usernames are resolved by the server rather than trusted from the client.
- Local development image storage and optional Cloudinary production storage.
- Explicit demo environment with verified credentials and local browser persistence.
- Loading, empty, error, retry, upload, and optimistic-update states.
- Purpose-built phone, tablet, and desktop layouts without TailwindCSS.

## Architecture

```text
.
├── backend/
│   ├── src/
│   │   ├── config/       # environment and MongoDB connection
│   │   ├── controllers/  # authentication, post, and user-search use cases
│   │   ├── middleware/   # auth, uploads, errors, async boundaries
│   │   ├── models/       # User and Post—the only two collections
│   │   ├── routes/       # /api/auth, /api/posts, and /api/users
│   │   ├── services/     # local/Cloudinary image persistence
│   │   └── utils/        # password/session and validation rules
│   └── test/
├── frontend/
│   └── src/
│       ├── components/
│       ├── config/
│       ├── context/
│       ├── pages/
│       ├── services/
│       ├── styles/
│       ├── utils/
│       └── validation/
├── package.json
└── pnpm-workspace.yaml
```

### MongoDB collections

The assessment constraint is enforced through exactly two Mongoose collections:

1. `users` stores username, normalized unique email, password hash, and timestamps.
2. `posts` stores an embedded author snapshot, optional text/image metadata, embedded likes, embedded comments, and timestamps.

No sessions, comments, likes, or upload metadata collections are created.

## Run the real full-stack application

Prerequisites:

- Node.js 20 or newer
- pnpm
- a local MongoDB server or MongoDB Atlas connection string

Install from the repository root:

```bash
pnpm install
```

Create local environment files:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

Set a strong `JWT_SECRET` and the correct `MONGODB_URI` in `backend/.env`. Then run both applications:

```bash
pnpm dev
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:5000/api`
- Health check: `http://localhost:5000/api/health`

The frontend defaults to `VITE_APP_MODE=real`. HTTP responses—including 400, 401, 403, 409, and 500—remain real errors. If no HTTP response is possible because the API is unreachable or times out, the browser enters the labelled Explorer/demo environment and requires valid demo credentials.

## Run the explicit demo

The demo is useful for an interviewer who wants to inspect the product without configuring MongoDB. Set this in `frontend/.env.local`:

```env
VITE_APP_MODE=demo
```

Then run only the frontend:

```bash
pnpm --filter ./frontend dev
```

Use the **Use the verified demo account** button on the login page. Demo login still verifies the supplied email and password; incorrect credentials fail. Login intentionally does not reuse signup strength rules, so even a short non-empty attempt reaches credential verification. Demo accounts, posts, likes, comments, replies, and mentions are isolated to browser storage and are clearly labelled `Demo` in the interface.

Never enable demo mode in a production deployment.

## Image storage

During local development, uploads are written to `backend/uploads/` and served from `/uploads`. For durable hosted deployments, set all three Cloudinary variables in `backend/.env`:

```env
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

The upload service selects Cloudinary only when the complete configuration exists. MongoDB stores image metadata/URLs, not base64 image bodies.

## API contract

| Method | Endpoint | Authentication | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/signup` | Public | Create account and session |
| `POST` | `/api/auth/login` | Public | Verify credentials and create session |
| `POST` | `/api/auth/logout` | Public/idempotent | Clear session cookie |
| `GET` | `/api/auth/me` | Required | Restore current account |
| `GET` | `/api/posts?page=1&limit=10` | Required | Read newest posts |
| `GET` | `/api/users?query=mira&limit=8` | Required | Find usernames for mention suggestions |
| `POST` | `/api/posts` | Required | Create multipart text/image post |
| `POST` | `/api/posts/:postId/like` | Required | Toggle the current user's like |
| `POST` | `/api/posts/:postId/comments` | Required | Add a comment or one-level reply with canonical mentions |

Authentication routes are rate-limited. Post/comment length, file type, file size, email, username, and password rules are checked at both relevant boundaries.

## Verification

Run the complete build and regression suite:

```bash
pnpm check
```

The targeted tests cover:

- distinct signup-strength and login-credential validation semantics;
- valid signup password boundaries and letter/number requirements;
- email normalization and signup validation;
- bcrypt hashing and wrong-password rejection;
- text-only/image-only post schema behavior;
- rejection of empty posts;
- enforcement of the two-collection data model.
- preservation of Account A's post in Account B's public-feed response.
- one-level reply flattening and canonical server-side mention identities;
- mention search privacy and frontend mention parsing.

The completed UI was also exercised through the browser at 360px, 390px, 430px, 768px, 1024px, and 1440px. The verified journey includes strict signup feedback, credential-based login, feed loading, reply-to-reply flattening, keyboard and pointer mention selection, and responsive comment layouts. No horizontal overflow or browser-console errors were found.

## Product decisions

- TaskPlanet was treated as behavioral inspiration, not a visual template.
- WhatsApp integration and unrelated social-network features remain out of scope.
- Standalone user profile pages remain out of scope because the assignment requires usernames on posts, not profile routes or profile management.
- Mobile bottom navigation is used only at compact widths; desktop receives a proper side navigation and context rail.
- The dark visual system is restrained and content-led rather than relying on blanket glassmorphism or glow effects.
- Explorer fallback is restricted to connection failures and timeouts. It never intercepts a real HTTP rejection, and the resulting demo environment remains visibly labelled and credential-aware.
- Mention/reply notifications remain future work. The current two-collection assessment architecture has no notification delivery model, and adding one would expand scope beyond the requested social-feed behavior.

See [IMPLEMENTATION_DECISIONS.md](./IMPLEMENTATION_DECISIONS.md) for the implementation rationale and acceptance criteria.
