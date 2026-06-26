# WorkWise Demo Guide

## Demo Goal

This demo showcases the complete WorkWise project management workflow, from signing in and creating a project through backlog grooming, sprint planning, sprint execution, AI-assisted planning, analytics, documentation, notifications, profile management, and logout. The goal is to show how WorkWise brings the day-to-day Scrum workflow into one workspace for small development teams.

## Pre-Demo Checklist

- [ ] Backend is running and reachable.
- [ ] Frontend is running and pointed at the correct backend URL.
- [ ] Database is connected and migrations are applied.
- [ ] Demo seed data is loaded and checked.
- [ ] Gemini API key is configured and AI generation is working.
- [ ] Socket.io connection is established after login.
- [ ] Notifications are being created and can be marked as read.
- [ ] Test user credentials are ready and verified.
- [ ] Browser cache is cleared or a clean browser profile is prepared.

## Presenter Flow

Use a prepared demo account, sample project name, teammate email addresses, and a few realistic task examples before starting. Keep the browser zoom and window size consistent so the audience can follow each click clearly.

### 1. Login

- Click: Open the WorkWise application and enter the prepared email and password on the login screen, then click **Login**.
- Expected result: The application authenticates the user and redirects to the main dashboard.
- Explain: WorkWise uses secure JWT-based authentication to protect project, task, sprint, document, notification, and AI features.

### 2. Dashboard Overview

- Click: Review the dashboard landing page, including project summaries, assigned work, recent activity, or any visible overview widgets.
- Expected result: The dashboard gives the user a central view of current work and navigation into projects, tasks, analytics, notifications, and profile settings.
- Explain: The dashboard is the starting point for the project manager or developer. It helps the team quickly understand active projects, workload, and recent updates before moving into detailed planning.

### 3. Create A Project

- Click: Click the project creation action, enter a project name, project key, and description, then submit the form.
- Expected result: WorkWise creates a new project workspace and adds the presenter as an admin member.
- Explain: Projects are the top-level workspaces in WorkWise. Each project contains team members, backlog tasks, sprints, documents, activity history, and project-specific permissions.

### 4. Invite Team Members

- Click: Open the project members or settings area, click the invite action, enter a teammate email address, choose a role, and send the invitation.
- Expected result: The invitation is created and the teammate appears as invited or pending. If email delivery is configured, the teammate receives an invitation email.
- Explain: WorkWise supports role-based project collaboration. Admins can invite teammates as admins, developers, or viewers so the project can match the team's real responsibilities.

### 5. Create Backlog Tasks

- Click: Open the project backlog or task creation screen. Create several tasks with titles, descriptions, priorities, labels, assignees, due dates, and acceptance criteria where appropriate.
- Expected result: New tasks appear in the project backlog and become available for sprint planning.
- Explain: The backlog is where the team captures planned work before it is committed to a sprint. Rich task metadata helps the team prioritize, assign, estimate, and track work clearly.

### 6. Sprint Planning

- Click: Open the sprint area and create a sprint with a name, sprint goal, start date, end date, and activation setting.
- Expected result: The sprint is created for the project. If activated, it becomes the active sprint for execution.
- Explain: Sprint planning turns a prioritized backlog into a focused delivery window. The sprint goal gives the team a shared outcome, while dates and active state make sprint progress measurable.

### 7. Move Tasks Into A Sprint

- Click: Select backlog tasks and assign or move them into the sprint using the task editor, backlog controls, or sprint planning interface.
- Expected result: Selected tasks are associated with the sprint and appear in the sprint task list or board.
- Explain: Moving tasks into a sprint represents commitment. The team can pull the most valuable and realistic work into the active sprint while leaving lower-priority tasks in the backlog.

### 8. Sprint Board Drag & Drop

- Click: Open the sprint board. Drag a task from **To Do** to **In Progress**, then move another task through review or done columns.
- Expected result: Task cards move between board columns and their status is persisted.
- Explain: The sprint board gives the team a visual workflow for daily execution. Drag and drop makes status updates fast, while persisted task state keeps the whole team aligned.

### 9. AI Task Breakdown

- Click: Open the AI task breakdown feature, enter a feature description and project context, then generate suggestions.
- Expected result: WorkWise returns a structured breakdown of implementation tasks or subtasks that can guide backlog creation.
- Explain: AI task breakdown helps teams turn a broad feature idea into actionable work. This is especially useful during planning when the team needs to identify frontend, backend, database, testing, and acceptance work.

### 10. AI Sprint Suggestions

- Click: Open the AI sprint suggestion or planning assistance feature and request sprint recommendations for the current backlog or project context.
- Expected result: WorkWise suggests a reasonable sprint scope, priorities, or planning guidance based on available work.
- Explain: AI sprint suggestions help the team reason about what should fit into the next sprint. The presenter should emphasize that the AI supports planning decisions while the team remains responsible for final scope.

### 11. AI Sprint Risk Analysis

- Click: Open the AI risk analysis or sprint insight feature for the active sprint and generate an analysis.
- Expected result: WorkWise highlights potential sprint risks such as too much work in progress, unclear tasks, urgent items, blockers, or missed due dates.
- Explain: Risk analysis helps the team identify problems early, before the sprint review. It turns project data into actionable coaching for the Scrum master, product owner, and developers.

### 12. Analytics Dashboard

- Click: Open the analytics dashboard for the project or sprint.
- Expected result: The analytics view shows project or sprint metrics such as task status distribution, completion progress, priority mix, workload, or trend information.
- Explain: Analytics gives stakeholders a higher-level view of execution health. It complements the sprint board by showing patterns that may not be obvious from individual task cards.

### 13. Project Documents

- Click: Open project documents, create a document, add rich text content, save it, search for it, and link it to a relevant task or sprint if the flow is available.
- Expected result: The document is saved under the project and can be found later through document search or linked references.
- Explain: WorkWise keeps project knowledge close to the work. Requirements, meeting notes, architecture notes, and acceptance details can live beside the tasks and sprints they support.

### 14. Notifications

- Click: Open the notification center from the header or navigation. Review unread notifications, mark one as read, then mark all as read if available.
- Expected result: Notifications display recent user-relevant updates and read states update in the interface.
- Explain: Notifications keep users aware of project changes, invitations, assignments, and other updates without requiring them to manually inspect every project area.

### 15. User Profile

- Click: Open the user profile page or account menu. Review profile details and update editable fields such as display name or avatar URL if appropriate.
- Expected result: The profile page shows the current user's account information and saves valid profile updates.
- Explain: The profile area lets users manage their identity inside WorkWise. This supports clearer assignment, collaboration, and notification context across projects.

### 16. Logout

- Click: Open the account menu and click **Logout**.
- Expected result: The user session ends and the application returns to the login screen.
- Explain: Logout completes the secure session flow. It demonstrates that protected project data is only available to authenticated users.

## Backup Plan

### Gemini API Unavailable

Continue the presentation with prepared AI output screenshots or pre-created example results. Explain that the AI features call Gemini from the backend and that the same workflow remains usable manually when the external AI provider is unavailable.

### Internet Unavailable

Switch to a local development environment if it is already running, or use a recorded walkthrough of the main flow. Explain the product workflow from the prepared project data and focus on the user experience rather than live network-dependent behavior.

### Render Sleeping

If the production backend is slow to respond, give it a moment to wake up and refresh once. Use the delay to explain that Render may cold-start inactive services, then continue once the API responds. Keep a local backend ready as a fallback for time-sensitive demos.

### Email Service Unavailable

Continue by showing the invitation record or pending member state in the application. Explain that email delivery is handled by SMTP or Resend, and that the core invitation workflow is still visible even if the external email provider is temporarily unavailable.

### Database Unavailable

Move to a backup environment with a known-good database, such as a local seeded database or an alternate hosted instance. If no database is available, use screenshots or a recorded demo and explain that WorkWise stores projects, tasks, sprints, documents, notifications, and activity history in PostgreSQL through Prisma.

### Browser Refresh Issues

Navigate back through the application menu or manually return to the app root URL. If a production route refresh shows a 404, explain that single-page applications require a host rewrite to `index.html`, then continue from the app's main entry point or switch to the local Vite server.

## Key Features Highlighted

- End-to-end Scrum workflow from project creation through backlog management, sprint planning, execution, and review.
- Role-based project collaboration with member invitations and project-level permissions.
- Rich task management with assignment, priority, labels, due dates, comments, acceptance criteria, and linked documents.
- Sprint management with active sprint tracking, board-based execution, and drag-and-drop status updates.
- AI-assisted planning through task breakdown, sprint suggestions, risk analysis, acceptance criteria, digests, and retrospectives where configured.
- Project documentation with rich text editing, search, and links between documents, tasks, and sprints.
- Realtime project updates and notification workflows for team awareness.
- Analytics views that help teams and stakeholders understand progress, workload, and sprint health.
- Secure full-stack architecture with React, Express, Prisma, PostgreSQL, Socket.io, JWT authentication, and backend-only AI integration.
