# Mini Social Implementation Decisions

## Product interpretation

The assessment asks for a small social application, not a broad social network. The implemented product therefore concentrates effort on the complete core journey: create an account, authenticate, publish text and/or an image, view the shared feed, like a post, and comment.

The supplied TaskPlanet recordings were treated as product research. Their useful mental models were retained, while three observed defects shaped this implementation:

- unverified WhatsApp updates were not copied because WhatsApp is outside the assignment;
- the desktop experience received dedicated navigation, width, and context behavior;
- every password field owns its visibility state and never exposes sibling values.

The assignment requires each feed item to display its author's username, but it does not request user profile pages, profile routes, bios, or clickable avatars. Those features were intentionally not invented. Post images do support a focused full-screen viewer because it directly improves consumption of the required image-post feature without changing the data model or assessment scope.

## Correctness decisions

### Authentication is never simulated implicitly

The earlier frontend changed to mock behavior after a failed request and accepted any non-empty password. That combination made an unavailable backend look like successful authentication.

The replacement has two visible modes:

- `real` is the default and only talks to the Express API;
- `demo` must be configured before Vite starts and uses a visibly labelled local environment.

Demo may also activate when real mode cannot receive any HTTP response because of a network failure, unreachable backend, or timeout. HTTP 400/401/403/409/500 responses never activate it. Signup enforces the full password policy in both modes. Login accepts any non-empty password as an attempt and then verifies the actual credential; it does not incorrectly reuse signup-strength validation. Demo mode compares a digest of the submitted password against the selected demo account instead of accepting arbitrary credentials.

### Validation is defense in depth

The frontend provides immediate, field-specific feedback, semantic length attributes, `aria-invalid`, linked error descriptions, and focus on the first invalid field. The backend independently enforces the same signup policy before any database or hashing operation. Login separately validates presence/length before credential comparison.

### Password handling

- Signup passwords contain 8–64 characters with at least one letter and one number.
- The backend stores a bcrypt hash with cost factor 12.
- Login uses bcrypt comparison and returns the generic response “Email or password is incorrect.”
- Sessions are signed JWTs delivered through an HTTP-only cookie; the real client never reads or stores the token in JavaScript.

## Data architecture

Only `users` and `posts` are modeled as MongoDB collections. Likes and comments are bounded subdocuments inside a post, which satisfies the assessment constraint and makes a feed read self-contained. Author usernames are stored as snapshots with interactions to preserve understandable historical feed content.

Replies remain embedded comments. The API converts a reply-to-reply into a reply to the original root while retaining the clicked target's ID and username, so the interface never grows beyond one visual indentation level. Mentions store canonical user IDs and username snapshots resolved by the server. Client-supplied usernames are never treated as authoritative.

The feed query is intentionally global rather than user-scoped. Account A can publish, log out, and Account B will receive Account A's post from the same `posts` collection. Only viewer-specific state, such as `viewerHasLiked`, is calculated for the currently authenticated account.

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
- Demo mode is labelled and credential-aware; automatic entry is limited to network failure, an unreachable backend, or timeout.
- Replies retain their target context while remaining one level deep.
- Mention suggestions support keyboard and touch input and store validated user identities.
- Notifications are future work because the assessment architecture has no notification collection or delivery channel.
