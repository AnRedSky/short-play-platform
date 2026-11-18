# V4 interaction specification

## Global rules

- Read state from the backend; never seed business records in browser memory.
- Disable submit controls while a request is pending and prevent duplicate submissions.
- Only display success after the server returns success.
- Preserve the API error code and request ID; render 401/403/404/409 distinctly.
- Destructive or access-changing actions require confirmation.
- Every project-scoped request carries the route project ID. The backend rechecks membership and permission.
- Versioned content creates a new immutable version; the UI does not silently overwrite old versions.
- File uploads use multipart requests; download is an authenticated binary request.
- When an API capability is missing, do not show an enabled fake action.

## Story and StoryBible

1. Load stories and StoryBible versions concurrently for the current project.
2. Create Story with title (required, max 200), logline (max 500), synopsis (max 5000).
3. Create StoryBible version with a JSON object. Invalid JSON is rejected before submit; backend persists the version.
4. Select a Story or Bible version to inspect the exact server response.
5. Story update and archive are unavailable until their API contracts are implemented.

## Episodes, script versions, scenes and dialogue

1. Load episodes with pagination.
2. Create episode with episode_number (1–999), title (required, max 200), synopsis (max 5000).
3. Open an episode and create a Script.
4. Create ScriptVersion content (max 200,000 characters); each save creates a new version.
5. Load scenes for a selected ScriptVersion; create a scene with unique scene_number, location, time_of_day and summary.
6. Create dialogue with order_number, character_name and content.
7. The current backend does not expose script-list or dialogue-list reads. V4 only keeps the returned newly-created Script in the active view and reports the missing read contract; it does not claim historical scripts/dialogue can be reloaded.

## Assets

- Character/scene/prop metadata is created through the creation domain and versions are created through the version endpoints.
- Media upload requires a selected file and title; server validates the file and returns the Asset record.
- Asset detail returns its version list. A new version upload includes the file and note.
- Download is a protected request; failures such as missing storage object are surfaced as API errors.
- No cross-project asset reference is allowed.

## Storyboards and Shot Contract

1. Load project episodes.
2. Create a storyboard for a selected episode.
3. Load shots for the storyboard and create a shot with number, shot size and description.
4. Load Shot Contract versions for a shot.
5. Validate Contract JSON and create a new immutable version.
6. Storyboard listing is not possible until the backend provides a list endpoint; V4 does not invent historic boards.

## Generation and workflows

- Provider health is fetched from `GET /models/providers`; health is not treated as a model capability catalogue.
- Generation task creation sends capability, prompt, parameters, provider/model codes, optional shot ID and an Idempotency-Key.
- Task detail is fetched by task ID; cancel is a cooperative server command. Attempts and result/error data come from the server.
- Workflow runs can be listed, created, inspected, cancelled and recovered using the workflow API.
- No retry action is shown because no generation-task retry endpoint exists.
- A provider configuration or missing Mork adapter must fail closed; the UI never substitutes a mock provider.

## Enterprise administration

- Project settings use PATCH and project member management uses GET/POST/DELETE APIs.
- User creation supports department and role assignment; account activation uses PATCH.
- Role creation and assignment use the real RBAC API. Permission strings are submitted to the backend for validation.
- Department creation supports a parent department; member overview comes from the organization members endpoint.

## Responsive behavior

- Desktop (>=1200px): persistent 248px navigation, full-width content canvas, multi-column forms and data tables.
- Tablet (768–1199px): navigation collapses to compact rail; content and forms reduce columns; tables remain horizontally scrollable.
- Mobile (<768px): navigation becomes compact/hidden according to shell behavior; page headings stack, forms become single-column, tab strips scroll horizontally, drawers/modals fit viewport and tables scroll horizontally.
- Keyboard: native form controls, semantic buttons, focusable navigation and Escape closes transient dialogs where provided.
