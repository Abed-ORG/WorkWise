# WorkWise API Documentation

Base URL:

- Local: `http://localhost:3000` when `PORT=3000`
- Production: the Render backend URL

Most responses use this envelope:

```json
{
  "success": true,
  "data": {}
}
```

Protected routes require:

```http
Authorization: Bearer <accessToken>
```

## Health

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | No | Return backend health status. |

## Auth

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | No | Create a user account. |
| `POST` | `/auth/login` | No | Authenticate and return access/refresh tokens. |
| `POST` | `/auth/refresh` | No | Exchange a refresh token for a new access token. |
| `POST` | `/auth/logout` | Yes | End the current session client-side. |
| `POST` | `/auth/forgot-password` | No | Send a password reset link if the email exists. |
| `POST` | `/auth/reset-password` | No | Set a new password using a reset token. |
| `GET` | `/auth/admin-test` | Yes, admin | Verify admin-only route access. |

Register request:

```json
{
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "password": "strong-password"
}
```

Login response:

```json
{
  "success": true,
  "message": "User logged in successfully",
  "data": {
    "user": {
      "id": "user_id",
      "name": "Ada Lovelace",
      "email": "ada@example.com"
    },
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token"
  }
}
```

Refresh request:

```json
{
  "refreshToken": "jwt_refresh_token"
}
```

Reset password request:

```json
{
  "token": "password-reset-token",
  "password": "new-strong-password"
}
```

## Users

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/users/me` | Yes | Get the current user profile. |
| `PATCH` | `/api/users/me` | Yes | Update current user profile fields. |
| `PATCH` | `/api/users/me/onboarding` | Yes | Mark onboarding as completed or dismissed. |

Update profile request:

```json
{
  "name": "Ada L.",
  "avatarUrl": "https://example.com/avatar.png"
}
```

Update onboarding request:

```json
{
  "status": "COMPLETED"
}
```

`status` may be `COMPLETED` or `DISMISSED`.

## Projects

Project routes are mounted under `/api/projects` and require authentication.

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/projects` | Yes | List projects where the user is a member. |
| `POST` | `/api/projects` | Yes | Create a project and add the creator as an admin. |
| `GET` | `/api/projects/:projectId` | Yes, project member | Get project details. |
| `PATCH` | `/api/projects/:projectId` | Yes, project admin | Update project name or description. |
| `DELETE` | `/api/projects/:projectId` | Yes, project admin | Delete a project. |
| `POST` | `/api/projects/:projectId/members/invite` | Yes, project admin | Invite a user by email. |
| `GET` | `/api/projects/:projectId/members/invitations` | Yes, project admin | List pending project invitations. |
| `PATCH` | `/api/projects/:projectId/members/:memberId/role` | Yes, project admin | Change a member role. |
| `DELETE` | `/api/projects/:projectId/members/:memberId` | Yes, project admin | Remove a member. |
| `GET` | `/api/projects/invitations/me` | Yes | List invitations for the current user. |
| `POST` | `/api/projects/invitations/:invitationId/accept` | Yes | Accept an invitation. |
| `POST` | `/api/projects/invitations/:invitationId/decline` | Yes | Decline an invitation. |

Create project request:

```json
{
  "name": "WorkWise",
  "key": "WW",
  "description": "AI-assisted project management"
}
```

Project keys must be uppercase letters, 2 to 5 characters.

Invite member request:

```json
{
  "email": "teammate@example.com",
  "role": "DEVELOPER"
}
```

Roles are `ADMIN`, `DEVELOPER`, or `VIEWER`.

## Tasks

Task routes are mounted under `/tasks` and require authentication.

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/tasks` | Yes | Create a task. |
| `GET` | `/tasks/assigned/me` | Yes | List tasks assigned to the current user. |
| `GET` | `/tasks/project/:projectId` | Yes, project member | List tasks for a project. |
| `GET` | `/tasks/:id` | Yes, project member | Get a task by ID. |
| `PATCH` | `/tasks/:id` | Yes, project member | Update task fields. |
| `DELETE` | `/tasks/:id` | Yes, project member | Delete a task. |
| `POST` | `/tasks/:id/comments` | Yes, project member | Add a comment to a task. |
| `GET` | `/tasks/:id/documents` | Yes, project member | List documents linked to a task. |
| `PUT` | `/tasks/:id/documents` | Yes, project member | Replace linked task documents. |

Create task request:

```json
{
  "title": "Build sprint board",
  "description": "Add board columns and drag/drop status updates.",
  "acceptanceCriteria": "- Columns render by status\n- Moving a card persists status",
  "priority": "HIGH",
  "labels": ["frontend", "scrum"],
  "dueDate": "2026-07-10T00:00:00.000Z",
  "projectId": "project_id",
  "sprintId": "sprint_id",
  "assigneeId": "user_id"
}
```

Task status values are `BACKLOG`, `TODO`, `IN_PROGRESS`, `IN_REVIEW`, and `DONE`.
Task priority values are `LOW`, `MEDIUM`, `HIGH`, and `URGENT`.

Update task request:

```json
{
  "status": "IN_PROGRESS",
  "priority": "URGENT",
  "order": 120
}
```

Link task documents request:

```json
{
  "documentIds": ["document_id_1", "document_id_2"]
}
```

## Comments

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/tasks/:id/comments` | Yes | Create a comment on a task. |
| `PATCH` | `/comments/:commentId` | Yes | Update a comment. |
| `DELETE` | `/comments/:commentId` | Yes | Delete a comment. |

Comment request:

```json
{
  "content": "This is ready for review."
}
```

## Sprints

Sprint routes are mounted under `/api/projects/:projectId/sprints` and require authentication.

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/projects/:projectId/sprints` | Yes, project member | List project sprints. |
| `POST` | `/api/projects/:projectId/sprints` | Yes, project admin | Create a sprint. |
| `POST` | `/api/projects/:projectId/sprints/start` | Yes, project admin | Start a new active sprint. |
| `GET` | `/api/projects/:projectId/sprints/:sprintId` | Yes, project member | Get sprint details. |
| `DELETE` | `/api/projects/:projectId/sprints/:sprintId` | Yes, project admin | Delete a sprint. |
| `POST` | `/api/projects/:projectId/sprints/:sprintId/complete` | Yes, project admin | Complete an active sprint. |
| `GET` | `/api/projects/:projectId/sprints/:sprintId/documents` | Yes, project member | List documents linked to a sprint. |
| `PUT` | `/api/projects/:projectId/sprints/:sprintId/documents` | Yes, project member | Replace linked sprint documents. |

Create sprint request:

```json
{
  "name": "Sprint 12",
  "goal": "Ship document linking",
  "startDate": "2026-07-01T00:00:00.000Z",
  "endDate": "2026-07-14T23:59:59.000Z",
  "activateNow": true
}
```

Complete sprint request:

```json
{
  "moveIncompleteToBacklog": true
}
```

Link sprint documents request:

```json
{
  "documentIds": ["document_id_1", "document_id_2"]
}
```

## Documents

Document routes are project scoped and require authentication.

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/projects/:projectId/documents?q=term` | Yes, project member | List or search project documents. |
| `POST` | `/api/projects/:projectId/documents` | Yes, project member | Create a document. |
| `GET` | `/api/projects/:projectId/documents/:documentId` | Yes, project member | Get a document by ID. |
| `PUT` | `/api/projects/:projectId/documents/:documentId` | Yes, project member | Update a document by ID. |
| `DELETE` | `/api/projects/:projectId/documents/:documentId` | Yes, project member | Delete a document. |
| `GET` | `/api/projects/:projectId/document` | Yes, project member | Get the legacy single project document. |
| `PUT` | `/api/projects/:projectId/document` | Yes, project member | Save the legacy single project document. |

Create or update document request:

```json
{
  "title": "API Notes",
  "content": "<p>Document content from the rich text editor.</p>"
}
```

Document titles are required and must be under 150 characters.

## Activity Feed

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/activities/projects/:projectId` | Yes, project member | Return project activity feed entries. |

Optional query parameters:

| Query | Purpose |
| --- | --- |
| `cursor` | Pagination cursor from a previous response. |

Example:

```http
GET /activities/projects/project_id?cursor=activity_id
```

## Notifications

Notification routes are mounted under `/notifications` and require authentication.

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/notifications` | Yes | List current user's notifications. |
| `PATCH` | `/notifications/read-all` | Yes | Mark all notifications as read. |
| `PATCH` | `/notifications/:notificationId/read` | Yes | Mark one notification as read. |
| `PATCH` | `/notifications/preference` | Yes | Update notification preference. |

Update notification preference request:

```json
{
  "preference": "MENTIONS_ONLY"
}
```

Preferences are `ALL`, `MENTIONS_ONLY`, and `NONE`.

## AI

AI routes are mounted under `/api/ai` and require authentication. They use Gemini when `GEMINI_API_KEY` is configured.

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/ai/task-breakdown` | Yes | Generate suggested tasks/subtasks from a feature description. |
| `POST` | `/api/ai/acceptance-criteria` | Yes | Generate acceptance criteria for a task. |

Task breakdown request:

```json
{
  "featureDescription": "Let users link documentation pages to sprint tasks.",
  "projectContext": "React frontend, Express backend, Prisma database."
}
```

Acceptance criteria request:

```json
{
  "title": "Link documents to tasks",
  "description": "Users should attach existing project documents to a task."
}
```

## AI Digest And Retrospective

Digest and retrospective routes are project scoped, require authentication, and depend on the AI report storage migrations being applied.

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/projects/:projectId/digests` | Yes, project member | List generated daily digests for a project. |
| `POST` | `/api/projects/:projectId/digests/generate` | Yes, project member | Generate a daily digest for current project activity. |
| `GET` | `/api/projects/:projectId/sprints/:sprintId/retrospective` | Yes, project member | Get a sprint retrospective. |
| `POST` | `/api/projects/:projectId/sprints/:sprintId/retrospective/generate` | Yes, project member | Generate a sprint retrospective. |
| `PATCH` | `/api/projects/:projectId/sprints/:sprintId/retrospective/notes` | Yes, project member | Update manual retrospective notes. |

Update retrospective notes request:

```json
{
  "manualNotes": "Discuss code review delays and improve handoff checklists."
}
```

Digest response shape:

```json
{
  "success": true,
  "data": {
    "id": "digest_id",
    "title": "Daily Digest",
    "summary": "Progress and blockers summary.",
    "completedCount": 3,
    "inProgressCount": 5,
    "blockerCount": 1,
    "source": "manual"
  }
}
```

Retrospective response shape:

```json
{
  "success": true,
  "data": {
    "id": "retrospective_id",
    "whatWentWell": "The team completed the board workflow.",
    "whatDidnt": "Some tasks were under-specified.",
    "actionItems": "Add acceptance criteria before sprint start.",
    "manualNotes": "Team notes."
  }
}
```

## Realtime Socket.io

Socket.io is initialized on the same HTTP server as Express.

Authentication:

```js
io(API_BASE_URL, {
  auth: { token: accessToken }
});
```

Client events:

| Event | Payload | Purpose |
| --- | --- | --- |
| `project:join` | `projectId` | Join a project room after membership is verified. |
| `project:leave` | `projectId` | Leave a project room. |

Server-side helpers emit project events to `project:<projectId>` rooms and user-specific events to `user:<userId>` rooms.
