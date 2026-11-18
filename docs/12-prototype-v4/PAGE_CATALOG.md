# V4 page catalog and traceability

| Existing navigation | Route | Real API-backed behavior in V4 | Known limitation |
|---|---|---|---|
| Workbench overview | `/` | Current identity, organization, permission summary | Operational metrics require usage/task/review APIs |
| Project space | `/projects` | List/create/update projects; list/add/remove project members; enter project | Project delete/archive lifecycle not exposed as a dedicated command |
| Story bible | `/projects/:projectId/stories` | List/create stories; list/create immutable StoryBible versions; JSON validation | Story update/archive endpoints absent |
| Episodes & scripts | `/projects/:projectId/episodes` | List/create episodes; create scripts; create/list script versions; create/list scenes; create dialogues | Script list and dialogue list endpoints absent; update/delete endpoints absent |
| Asset center | `/projects/:projectId/assets` | List/create characters/scenes/props; create asset versions; multipart upload; asset detail; upload version; authenticated download | Asset relation/reference API and deletion lifecycle absent |
| Storyboards & shots | `/projects/:projectId/storyboards` | List project episodes; create storyboard; list/create shots; list/create Shot Contract versions | Storyboard list/detail endpoint absent; scene selector is not populated from a project-scene list in this screen |
| AI generation | `/projects/:projectId/tasks` | Read Provider health; create/query/cancel generation task; list/create/read/cancel/recover workflow runs; display attempts/nodes | Generation task list/retry and SSE/event endpoints absent; provider/model configuration absent; backend currently has synchronous execution path |
| Quality & review | `/projects/:projectId/reviews` | No write action exposed | No QA RuleSet/Run/Issue or Review/decision/rework APIs |
| Timeline editor | `/projects/:projectId/editor` | No write action exposed | No Timeline/Version/Track/Clip persistence API |
| Export & delivery | `/projects/:projectId/exports` | Create an actual image-slideshow export from selected project image assets; display server ExportJob/Asset response and authenticated download | No ExportJob list/detail/cancel, full video timeline renderer, validation report or independent export artifact lifecycle |
| User management | `/admin/users` | List/create/update active state; create with department and initial role | No delete, password reset or role update on existing user endpoint |
| Roles & permissions | `/admin/roles` | List/create/read roles; assign role to user | No role update/delete or assignment removal endpoint |
| Organization & departments | `/admin/departments` | List organizations/departments/members; create department with parent | No department update/delete or member transfer endpoint |

## Page states

All API-backed pages must distinguish loading, empty, success, validation error, 401, 403, 404, 409, and server/network failure. Request IDs are displayed when returned by the API. A route/API authorization failure must never be rendered as an empty dataset.

## Navigation integrity

Production navigation retains the existing route contract and uses the current project ID from the route. Leaving a project clears the active project context. No page may construct a fallback/demo project ID.
