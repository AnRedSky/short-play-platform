# Backend API gaps blocking a complete real-interaction prototype

These are verified contract gaps in the current `develop` baseline. V4 deliberately does not fake these operations.

| Domain | Missing API / behavior | Needed to complete the page |
|---|---|---|
| Stories | PATCH/DELETE/archive Story; story detail if not supplied by list | Story lifecycle and optimistic concurrency |
| Scripts | GET scripts by episode; GET dialogues by scene; script/scene/dialogue updates | Reloadable script editor and complete dialogue inspection |
| Assets | Asset relation list/create/remove; project-scene reference selector; lifecycle/archive/delete | Fixed-version references and impact analysis |
| Storyboards | GET storyboards by episode/project; storyboard detail/version history | Reloadable storyboard workspace |
| Generation | GET task list; retry endpoint; task event stream; capability/model catalog | Full queue monitoring and retry workflow |
| Provider | Provider configuration, model capability config, secret reference validation | Administer actual Mork integration without exposing credentials |
| QA | RuleSet list/version; QualityRun create/list/detail; issues and re-run | Real QA gate and failure diagnosis |
| Review | Review queue/detail; approve/reject; reason; rework creation | Version-bound human review lifecycle |
| Timeline | Timeline create/read/update; immutable TimelineVersion; Track/Clip CRUD; stale reference checks | Persistent multi-track editor |
| Export | ExportJob list/detail/cancel; profile catalog; validation report; full timeline-video renderer | Full render/validate/deliver lifecycle. The current image-slideshow endpoint can create an export and return a downloadable Asset, now wired in V4. |
| Usage & budget | UsageRecord aggregation; budget CRUD; threshold alerts | Real budget and cost dashboard |
| Notifications | Inbox list/read/read-all and event snapshot | Real notification center |
| Search | Project-scoped search endpoint | Search without crossing project boundary |

## Required engineering rules

- Add schemas, domain services, migrations, router permissions, audit events and negative cross-project tests with each API.
- Use immutable subject/version references for QA and Review.
- Use integer PTS + rational time_base for Timeline; never persist floating-point seconds as authoritative time.
- Export must bind an immutable TimelineVersion and pass ffprobe, full decode and checksum validation before download becomes available.
- No success state may be inferred from task creation alone.
- Mork missing/unconfigured must return a stable error such as PROVIDER_NOT_CONFIGURED. Mock provider must be available only in explicit CI/test environments.
- Update the OpenAPI runtime snapshot and API coverage matrix in the same PR as endpoint changes.
