# Mini Social Implementation Decisions

## Product interpretation

The assessment asks for a small social application, not a broad social network. The implemented product therefore concentrates effort on the complete core journey: create an account, authenticate, publish text and/or an image, view the shared feed, like a post, and comment.

The supplied TaskPlanet recordings were treated as product research. Their useful mental models were retained, while three observed defects shaped this implementation:

- unverified WhatsApp updates were not copied because WhatsApp is outside the assignment;
- the desktop experience received dedicated navigation, width, and context behavior;
- every password field owns its visibility state and never exposes sibling values.

## Correctness decisions

### Authentication is never simulated implicitly

The earlier frontend changed to mock behavior after a failed request and accepted any non-empty password. That combination made an unavailable backend look like successful authentication.

The replacement has two explicit modes:

- `real` is the default and only talks to the Express API;
- `demo` must be configured before Vite starts and uses a visibly labelled local environment.

A runtime network failure does not change modes. In both modes, a one-character password fails validation. Demo mode also compares a digest of the submitted password against the selected demo account instead of accepting arbitrary credentials.

### Validation is defense in depth

The frontend provides immediate, field-specific feedback, semantic length attributes, `aria-invalid`, linked error descriptions, and focus on the first invalid field. The backend independently validates the same minimum/maximum boundaries before any database or hashing operation.

### Password handling

- Passwords contain 8–64 characters.
- The backend stores a bcrypt hash with cost factor 12.
- Login uses bcrypt comparison and returns the generic response “Email or password is incorrect.”
- Sessions are signed JWTs delivered through an HTTP-only cookie; the real client never reads or stores the token in JavaScript.

## Data architecture

Only `users` and `posts` are modeled as MongoDB collections. Likes and comments are bounded subdocuments inside a post, which satisfies the assessment constraint and makes a feed read self-contained. Author usernames are stored as snapshots with interactions to preserve understandable historical feed content.

Images are kept outside MongoDB. Development uses an ignored upload directory; production can use Cloudinary through the same storage service.

## UI architecture

The existing mobile-first component system was preserved because it already separated authentication, shell, feed, composer, post, comment, and feedback responsibilities. The correctness refactor was isolated in configuration, API, context, and validation modules instead of burying behavior inside components.

The visual hierarchy remains intentionally restrained:

- compact mobile typography and touch-sized controls;
- a readable feed column instead of full-width desktop posts;
- coral for primary/active states and mint for supporting context;
- borders and surface levels before shadows or blur;
- purposeful motion with reduced-motion support.

## Acceptance criteria

- Real signup/login persist through MongoDB and reject invalid credentials.
- The API remains the source of truth in real mode.
- Text-only, image-only, and combined posts are accepted; empty posts are rejected.
- Likes toggle once per user and comments preserve author/time information.
- Images keep their aspect ratio and fail gracefully.
- Mobile, tablet, and desktop layouts have no horizontal overflow.
- API, validation, and content errors remain visible without destroying the layout.
- Demo mode is explicit, labelled, credential-aware, and never a network-error fallback.
