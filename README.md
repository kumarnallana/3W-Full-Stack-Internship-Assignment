# Mini Social — 3W Full-Stack Assessment

Mini Social is a complete React, Express, and MongoDB social-post application. It keeps the assessment scope focused—authentication, posts, images, likes, and comments—while providing an original mobile-first interface and honest runtime behavior.

The important correctness rule is simple: **a network failure never becomes a successful login**. Real mode uses only the Express/MongoDB API. A separate browser-only demo is available only when `VITE_APP_MODE=demo` is explicitly configured.

## Delivered product

- Account creation and login with matching frontend and server validation.
- Minimum 8-character and maximum 64-character passwords.
- Independent show/hide control for every password field.
- bcrypt password hashing; plaintext passwords are never stored.
- JWT authentication through an HTTP-only cookie; the real client never stores the token in browser storage.
- Protected public feed with pagination.
- Text-only, image-only, and text-plus-image posts.
- Persistent likes and embedded comments with immediate UI updates.
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
│   │   ├── controllers/  # authentication and post use cases
│   │   ├── middleware/   # auth, uploads, errors, async boundaries
│   │   ├── models/       # User and Post—the only two collections
│   │   ├── routes/       # /api/auth and /api/posts
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

The frontend defaults to `VITE_APP_MODE=real`. If the API or MongoDB is not available, it shows a connection error and remains unauthenticated.

## Run the explicit demo

The demo is useful for an interviewer who wants to inspect the product without configuring MongoDB. Set this in `frontend/.env.local`:

```env
VITE_APP_MODE=demo
```

Then run only the frontend:

```bash
pnpm --filter ./frontend dev
```

Use the **Use the verified demo account** button on the login page. Demo login still verifies the supplied email and password; incorrect or short passwords fail. Demo accounts, posts, likes, and comments are isolated to browser storage and are clearly labelled `Demo` in the interface.

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
| `POST` | `/api/posts` | Required | Create multipart text/image post |
| `POST` | `/api/posts/:postId/like` | Required | Toggle the current user's like |
| `POST` | `/api/posts/:postId/comments` | Required | Add a comment |

Authentication routes are rate-limited. Post/comment length, file type, file size, email, username, and password rules are checked at both relevant boundaries.

## Verification

Run the complete build and regression suite:

```bash
pnpm check
```

The targeted tests cover:

- rejection of the original one-character-password defect in the browser and server rules;
- valid password boundaries;
- email normalization and signup validation;
- bcrypt hashing and wrong-password rejection;
- text-only/image-only post schema behavior;
- rejection of empty posts;
- enforcement of the two-collection data model.

The completed UI was also exercised through the browser at 360px, 390px, 768px, and 1440px. The verified journey includes login, independent password visibility, feed loading, post creation, like/unlike, comments, refresh persistence, and real-mode API failure behavior.

## Product decisions

- TaskPlanet was treated as behavioral inspiration, not a visual template.
- WhatsApp integration and unrelated social-network features remain out of scope.
- Mobile bottom navigation is used only at compact widths; desktop receives a proper side navigation and context rail.
- The dark visual system is restrained and content-led rather than relying on blanket glassmorphism or glow effects.
- The older automatic Offline Explorer behavior was removed because it could conceal backend failures and invalidate an assessment demo.

See [IMPLEMENTATION_DECISIONS.md](./IMPLEMENTATION_DECISIONS.md) for the implementation rationale and acceptance criteria.
