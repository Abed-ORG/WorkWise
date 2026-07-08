# WorkWise Performance Audit

## Purpose

This document summarizes performance risks found in the codebase during a repository review on July 8, 2026.

It is intentionally evidence-based:

- Items marked **Verified in code** are directly supported by the current implementation.
- Items marked **Needs production measurement** cannot be confirmed from the repository alone and should not be treated as proven causes until instrumented.

This is not a hosting-only issue. The current codebase contains several patterns that will add latency even in a healthy production environment.

## Scope Reviewed

Primary flows reviewed:

- Loading dashboard data
- Loading project board/backlog/overview data
- Opening task details
- Creating tasks
- Posting comments
- Sending invitation, password reset, and verification emails

Main files reviewed:

- `server/src/services/task.service.ts`
- `server/src/services/comment.service.ts`
- `server/src/services/notification.service.ts`
- `server/src/services/mail.service.ts`
- `server/src/services/auth.service.ts`
- `server/src/modules/users/users.service.ts`
- `server/src/modules/projects/projects.service.ts`
- `client/src/pages/DashboardPage.tsx`
- `client/src/pages/ProjectOverviewPage.tsx`
- `client/src/components/TaskDetailModal.tsx`
- `server/prisma/schema.prisma`

## Executive Summary

### Verified in code

1. Task list APIs overfetch large nested payloads.
2. Task creation and related writes perform multiple sequential database operations before responding.
3. Notifications are generated inline during user-facing write requests.
4. Email delivery is synchronous in request paths.
5. A new Nodemailer transporter is created for every email send.
6. Opening the task detail modal triggers multiple API calls, plus one extra download per image attachment preview.
7. There are two Prisma client instantiation patterns in the backend, which is not ideal for connection management.

### Needs production measurement

1. Whether Render cold starts materially affect users.
2. Whether Render, Supabase, and the mail provider are regionally far apart.
3. Whether database time, network transfer time, or provider time is the dominant bottleneck in production.
4. Whether large payload size is causing noticeable browser-side parse and render cost in real deployments.

## Findings

### 1. Heavy task list payloads

Status: **Verified in code**

#### Evidence

`server/src/services/task.service.ts` defines a shared `taskSummaryInclude` object used by list endpoints. It includes:

- `project`
- `status`
- `sprint`
- `assignee`
- `creator`
- `parent`
- `comments` with authors
- `activities` with users

That include is used by:

- `getProjectTasks`
- `getAssignedTasks`
- task create/update responses
- subtask responses

#### Why this is a problem

Board, backlog, overview, and dashboard-style screens usually need task summary data, not full discussion history and activity history for every task.

Loading comments and activities for every task causes:

- larger SQL result sets
- more relation joins / nested fetch work
- larger JSON serialization cost on the server
- larger transfer payloads over the network
- more JSON parse cost in the browser

This becomes worse as task count, comment count, and activity count increase.

#### Affected areas

- Project backlog
- Project board
- Project overview
- Dashboard assigned tasks
- Any mutation response returning full task objects

#### Recommended improvement

Split task responses into at least two shapes:

- `TaskListItem`: summary fields only
- `TaskDetail`: full task with comments, activities, and documents

Suggested summary shape:

- `id`
- `title`
- `type`
- `priority`
- `status`
- `order`
- `dueDate`
- `projectId`
- `sprintId`
- `parentId`
- minimal `assignee`
- minimal `creator`
- minimal `project` only where the screen actually needs it

Remove `comments` and `activities` from list endpoints entirely.

#### Implementation approach

1. Create a dedicated `taskListInclude` or explicit `select`.
2. Keep `getTaskById` as the detail endpoint.
3. Update frontend task list pages to rely on summary data only.
4. If counts are needed, return `commentCount` / `activityCount` instead of full arrays.

#### Validation

Measure before and after:

- response payload size in KB
- DB query time
- API total response time
- browser JSON parse time

## 2. Dashboard fetches too much data for a small view

Status: **Verified in code**

#### Evidence

`client/src/pages/DashboardPage.tsx` loads all assigned tasks and then uses only a small filtered subset for the "Today's focus" section.

The UI ultimately needs only a few fields:

- task title
- due date
- project name
- project id

#### Why this is a problem

The dashboard is paying the cost of the full assigned-task endpoint even though it only renders up to 5 focus tasks.

#### Recommended improvement

Create a dedicated endpoint for the dashboard, for example:

- `GET /tasks/assigned/me/focus`

Suggested behavior:

- return only open tasks
- optionally filter to due today / overdue on the server
- return only the fields needed for dashboard rendering
- cap results server-side

#### Validation

Compare:

- dashboard API count
- total bytes transferred on first dashboard load
- dashboard first content render timing

## 3. Task creation does multiple sequential database operations

Status: **Verified in code**

#### Evidence

`createTask` currently does the following in sequence:

1. verify project membership
2. verify assignee membership if provided
3. verify sprint if provided
4. load default status if no status is provided
5. create task
6. create task activity
7. create project activity
8. create notification if assigned to another user

#### Why this is a problem

Every awaited operation adds latency to the response path. Even if each query is individually fast, the total can still become noticeable in production.

#### Recommended improvement

Separate critical work from non-critical work.

Critical path:

- validation required for correctness
- task creation

Non-critical path:

- project activity creation
- notification creation
- socket emissions

#### Implementation approach

Option A:

- keep validation and task creation synchronous
- move activity creation and notifications to a background queue

Option B:

- store an outbox record in the same transaction as task creation
- process the outbox asynchronously

Option C:

- if a queue is not yet available, at least run independent follow-up work in parallel after task creation

Important note:

Do not move correctness-critical validation out of band.

#### Validation

Track:

- p50 / p95 response time for task creation
- query count per create request
- time spent in DB vs notification follow-up

## 4. Notification fan-out happens inline on write requests

Status: **Verified in code**

#### Evidence

`notifyProjectMembers` loads project members and then calls `createNotification` for each member. `createNotification` itself performs more reads before inserting the notification.

Current per-recipient work includes:

- read user notification preference
- read project notification preference
- create notification
- emit realtime user event

This happens inside user-facing flows such as:

- task moved
- comment added
- sprint started
- sprint completed

#### Why this is a problem

Latency grows with team size. A project with more members means more DB work before the original request completes.

#### Recommended improvement

Move notification fan-out out of the request path.

Preferred design:

1. write the main business event
2. enqueue a notification job or outbox record
3. let a worker process recipients asynchronously

If background jobs are not yet available:

- reduce per-recipient reads by batching recipient preferences where possible
- avoid separate preference reads per user when a bulk query can serve the same purpose

#### Validation

Measure request duration for:

- comment creation in small vs large projects
- task moves in small vs large projects

## 5. Email sending is synchronous in request paths

Status: **Verified in code**

#### Evidence

These flows all await email delivery before returning:

- project invitations
- password reset
- email change verification

#### Why this is a problem

API latency becomes directly dependent on:

- SMTP provider speed
- Resend API speed
- DNS/TLS connection setup
- network conditions between the app host and the mail provider

This can make the application feel slow even when the database is healthy.

#### Recommended improvement

Move email sending to an asynchronous job flow.

Suggested behavior:

1. persist the invitation / reset token / verification request
2. enqueue an email job
3. return success immediately
4. let a worker deliver the email
5. record delivery result separately

If a queue is not available yet:

- add strict timeout protection around email calls
- consider returning accepted status once the DB state is committed

#### Product note

This change may require minor UX copy updates, for example:

- "Invitation queued for delivery"
- "If the address exists, a reset email will be sent shortly"

#### Validation

Measure:

- request time before and after queueing
- mail provider delivery success rate
- time-to-delivery separately from API response time

## 6. Nodemailer transporter is recreated for every send

Status: **Verified in code**

#### Evidence

`server/src/services/mail.service.ts` creates a new transporter inside `sendMail`.

#### Why this is a problem

Creating a transporter per request can repeatedly incur:

- connection setup
- auth negotiation
- TLS handshake cost

#### Recommended improvement

Reuse a single transporter instance at process level when SMTP is configured.

Suggested implementation:

- initialize transporter once
- enable pooling if supported by the provider
- use a provider SDK if it performs better operationally for your email vendor

#### Validation

Measure:

- SMTP send duration before and after reuse
- connection count
- timeout / failure rate

## 7. Task detail modal triggers many network requests

Status: **Verified in code**

#### Evidence

Opening the task detail modal triggers:

- `getTaskById`
- `getProjectById`
- `getProjectSprints`
- `getProjectStatuses`
- `getTaskChildren`
- `getTaskAttachments`

Then for every image attachment, the client also calls `fetchTaskAttachmentBlob` to build previews.

#### Why this is a problem

A single user action turns into many network round-trips. On high-latency environments this will feel slow even if each endpoint is acceptable on its own.

#### Recommended improvement

Reduce modal load fan-out.

Options:

1. Enrich `getTaskById` so it includes children and attachment metadata when that is appropriate.
2. Stop refetching project/sprints/statuses if they are already cached for the current page.
3. Do not auto-download every image preview on modal open.
4. Load attachment previews lazily when the attachment section is visible or when the user opens an image.

#### Additional note

The current attachment design stores raw base64 file data in the database. That is functional but expensive compared with object storage for larger usage patterns.

#### Validation

Track:

- number of requests fired when opening the modal
- time to usable modal
- total bytes transferred when tasks have image attachments

## 8. Attachment storage strategy is expensive at scale

Status: **Verified in code**

#### Evidence

Attachments are uploaded as base64, stored directly in the database, and downloaded back through the API.

#### Why this is a problem

This increases:

- request payload size
- database size
- database read/write cost
- API memory and serialization overhead

#### Recommended improvement

Move attachment binaries to object storage.

Suggested design:

- store files in object storage
- keep only metadata and storage keys in Postgres
- use signed URLs or proxy download endpoints as needed

#### Validation

Compare:

- DB size growth
- attachment upload time
- attachment preview/download time
- API memory usage

## 9. Prisma client usage should be standardized

Status: **Verified in code**

#### Evidence

The codebase uses:

- a shared singleton Prisma client in `server/src/utils/prisma.ts`
- a separate `new PrismaClient()` inside `server/src/modules/projects/projects.service.ts`

#### Why this is a problem

Multiple client instances can complicate connection management and observability. This is not enough evidence by itself to call it a production bottleneck, but it is not a good backend pattern.

#### Recommended improvement

Use one shared Prisma client instance across the backend unless there is a deliberate and documented reason not to.

#### Validation

Confirm:

- active connection counts
- Prisma logs
- no behavior regressions after standardization

## 10. Missing production instrumentation

Status: **Verified in code**

#### Evidence

No request timing, DB timing, payload-size logging, or provider timing instrumentation was found in the reviewed paths.

#### Why this is a problem

Without timings, the team cannot prove:

- whether the bottleneck is DB, app, network, hosting, or external providers
- which endpoint is actually slow in production
- whether improvements worked

#### Recommended improvement

Add lightweight performance instrumentation before deeper optimization work lands.

Minimum useful metrics:

- endpoint name
- total request duration
- DB query duration
- response payload size
- email provider duration
- notification fan-out duration
- task detail modal request count

Suggested tooling options:

- request middleware with timing logs
- Prisma query event logging in non-local environments
- OpenTelemetry or an APM product
- frontend performance marks around major screen loads

## Prioritized Improvement Plan

### Phase 1: Measure first

1. Add backend request timing middleware.
2. Add Prisma query timing logs for slow queries.
3. Log email send duration and provider used.
4. Log payload size for the heaviest task endpoints.
5. Add frontend timing around dashboard load, board/backlog load, and task modal open.

### Phase 2: Remove the biggest known inefficiencies

1. Split task list DTOs from task detail DTOs.
2. Create a lightweight dashboard focus endpoint.
3. Stop returning comments and activities from list endpoints.
4. Reuse a shared SMTP transporter.
5. Standardize to one Prisma client instance.

### Phase 3: Move non-critical work off request paths

1. Queue or outbox notifications.
2. Queue or outbox email sending.
3. Queue project activity creation if it is not required synchronously.

### Phase 4: Reduce task modal network fan-out

1. Reuse cached project/sprint/status data.
2. Lazy load image previews.
3. Consolidate task detail-related requests where practical.

### Phase 5: Medium-term architecture improvements

1. Move attachments to object storage.
2. Add pagination or incremental loading where task counts can grow.
3. Consider background workers for notifications, email, and other side effects.

## What Not To Conclude Yet

The current repository review does **not** prove:

- that hosting is the primary problem
- that Supabase is the primary problem
- that Render cold starts are the primary problem
- that SMTP is the largest contributor in all environments

Those may be factors, but they require production measurements.

## Recommended Acceptance Criteria For The Dev Team

The improvement effort should not be considered complete until the team can show measured gains for the main user flows.

Suggested targets:

- dashboard load: reduced request count and reduced total payload size
- board/backlog load: task list endpoint no longer returns comments and activities
- task creation: lower p95 response time after side effects leave the critical path
- email-triggering actions: API response time no longer depends on provider round-trip time
- task detail modal: reduced request fan-out and faster time to interactive

## Suggested Immediate Tickets

1. Add request timing middleware and slow-query logging.
2. Refactor task list endpoints to use summary DTOs only.
3. Build a dedicated dashboard focus endpoint.
4. Rework notification fan-out into an async pipeline.
5. Rework email sending into an async pipeline.
6. Replace per-send transporter creation with a shared pooled transporter.
7. Standardize Prisma usage to a single shared client.
8. Reduce task detail modal fetch fan-out and lazy load previews.
9. Plan migration of attachments to object storage.

## Closing Note

This document is based on repository evidence only. It identifies code paths that are very likely to contribute to slowness. Final prioritization should be guided by production measurements collected after instrumentation is added.
