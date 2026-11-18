# FacultyHub – Faculty Management System

FacultyHub is a full-stack faculty management system for colleges and universities. It brings faculty records, departments, subjects, attendance, leave, teaching workload, timetables, announcements, reports and audit trails into one role-aware web application.

| | |
|---|---|
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui (Base UI), Recharts |
| **Backend** | Node.js, Express 4, TypeScript, MongoDB 8 + Mongoose 8 |
| **Auth** | JWT access tokens + rotating httpOnly refresh-token cookies, bcrypt password hashing |
| **Tests** | Vitest + Supertest (61 API and unit tests) |

---

## 1. Problem statement

Faculty administration in many institutions is spread across spreadsheets, paper leave forms and email threads. That makes it hard to answer simple questions such as *who is on leave today?*, *which faculty are overloaded this semester?* or *which subjects still have no teacher?* Records end up inconsistent, approvals are slow and there is no audit trail.

## 2. Objectives

- Maintain a single, validated record for every faculty member, department, course and subject.
- Give **administrators**, **heads of department (HOD)** and **faculty** each the access they need and no more, enforced on the server.
- Digitise attendance and the leave approval workflow, keeping balances and attendance consistent.
- Plan teaching workload and timetables with automatic limit alerts and conflict detection.
- Produce real-time dashboards and exportable reports (PDF, Excel, CSV) from live data.
- Record important actions in an audit log.

## 3. Main features

| Module | Highlights |
|---|---|
| **Authentication** | Login/logout, JWT access + refresh rotation with reuse detection, forgot/reset password (email or dev fallback), change password, session-expiry handling, rate limiting, Helmet, CORS, NoSQL-injection sanitising |
| **Dashboards** | Admin (institution), HOD (department) and faculty (personal) dashboards, all computed from MongoDB: 8 KPI cards, attendance trends, leave stats, designation and department charts, pending requests, recent faculty, events, activity timeline, quick actions |
| **Faculty** | Full CRUD, auto-generated IDs (`FAC0001`), duplicate email/ID checks, search, filters (department, designation, status, type, archived), sorting, pagination, profile page with teaching history, attendance calendar and leave history, photo upload, archive/restore, deactivate (disables login), CSV/Excel/PDF export |
| **Departments** | CRUD, assign HOD (syncs user roles), department statistics and charts; deletion blocked while faculty, subjects or courses remain |
| **Subjects & courses** | Subject and course CRUD, codes/credits/semester/year, faculty assignment, allocation view (allocated / partial / unallocated), safe deletion |
| **Attendance** | Daily register with present/late/absent/on-leave, auto *late* by threshold, one record per faculty per day (unique index), self check-in/out (configurable, labelled *self-reported*), history, monthly calendar, department-wise and daily trend charts, exports |
| **Leave** | Apply (with document upload), working-day calculation, overlap checks, balance checks, approve/reject with remarks, cancel, balance monitoring and admin adjustment; approved leave is written into attendance without duplicates |
| **Workload** | Allocations (lecture/lab/tutorial, section), duplicate prevention, configurable min/max limits, overloaded/underutilized alerts, per-faculty and per-department charts, term filters |
| **Timetable** | Weekly grid by department/faculty/section/room, configurable periods and working days, live conflict check; prevents faculty, room and section double-booking and requires the faculty to be allocated the subject |
| **Announcements & notifications** | Targeted (all or chosen departments), priorities, categories, events, pinned, scheduled publish and expiry; in-app notifications for announcements, leave decisions, workload, timetable and HOD appointment; optional email |
| **Reports** | Faculty directory, department summary, attendance, leave, workload, subject allocation and employment status, with filters, preview, charts, PDF/Excel/CSV and print layout |
| **Audit & settings** | Audit log (logins, failed logins, CRUD, approvals, exports…) with filters; settings for institution branding/logo, academic sessions, semesters, working days, time slots, designations, attendance rules, leave policy, workload limits, notification preferences and user accounts |
| **UI/UX** | Navy/royal-blue SaaS design system, light (default) and dark mode, collapsible sidebar, mobile drawer, ⌘K global search, breadcrumbs, skeletons, empty and error states, toasts, confirmation dialogs, accessible controls |

## 4. Architecture

```
┌──────────────────────────┐   HTTPS / JSON (Axios + TanStack Query)   ┌──────────────────────────────┐
│  Next.js frontend (3000) │ ────────────────────────────────────────▶ │  Express REST API (5050/api) │
│  App Router, React 19    │ ◀──────────────────────────────────────── │  routes → middleware →       │
│  AuthProvider (memory    │   Bearer access token  +  httpOnly        │  controllers → services       │
│  access token)           │   refresh cookie (/api/auth)              │  Zod validation, RBAC, audit  │
└──────────────────────────┘                                           └──────────────┬───────────────┘
                                                                                       │ Mongoose
                                                                               ┌───────▼────────┐
                                                                               │   MongoDB      │
                                                                               └────────────────┘
```

- **Separate apps.** The frontend never touches the database; every page reads from and writes to the REST API.
- **Security in depth.** The frontend hides navigation and pages by role, but **every endpoint enforces authentication, role checks and department/self scope on the server** (`authorize()` + `scope.service.ts`).
- **Standard responses.** `{ success, message?, data, meta? }` for success and `{ success: false, message, details? }` for errors, with correct HTTP status codes (400/401/403/404/409/500) from a central error handler.

### Auth flow
1. `POST /api/auth/login` returns a 15-minute JWT **access token** (kept in memory only) and sets a 7-day opaque **refresh token** in an httpOnly cookie. Only a SHA-256 hash of the refresh token is stored.
2. On a 401 `TOKEN_EXPIRED`, the Axios interceptor calls `/auth/refresh` once (single-flight), which **rotates** the refresh token. If an already-rotated token is reused, all of that user's sessions are revoked.
3. On page load, the app restores the session through `/auth/refresh`. Changing or resetting a password revokes all sessions.

## 5. Database schema overview

| Collection | Purpose | Key fields / constraints |
|---|---|---|
| `users` | Login accounts | `email` (unique), bcrypt `password` (never returned), `role` (admin/hod/faculty), `faculty` ref, `isActive` |
| `refreshtokens` | Session store | `tokenHash` (unique), `user`, `expiresAt` (TTL index), `revokedAt` |
| `faculties` | Faculty records | `facultyId` & `email` (unique), personal + professional fields, `department` ref, `user` ref, `status`, `isArchived` |
| `departments` | Departments | `name`, `code` (unique), `head` → faculty |
| `courses` | Programmes | `code` (unique), `department` ref |
| `subjects` | Subjects | `code` (unique), `department`, `course`, `semester`, `academicYear`, `credits`, `assignedFaculty[]` |
| `academicsessions` | Academic years | `name` (unique, e.g. 2026-27), semesters, `isCurrent` |
| `attendances` | Daily attendance | **unique (`faculty`, `date`)**, `status`, check-in/out, `source` (manual/self/leave), `leave` ref, `markedBy` |
| `leaveapplications` | Leave workflow | `faculty`, `department`, `leaveType`, dates, `days`, `status`, reviewer & remarks, document |
| `leavebalances` | Balances | **unique (`faculty`, `academicYear`)**, per-type `allocated`/`used` |
| `workloads` | Teaching allocations | **unique (`faculty`, `subject`, `academicYear`, `section`, `type`)**, `weeklyHours` |
| `timetables` | Weekly classes | `faculty`, `subject`, `section`, `room`, `dayOfWeek`, `startTime`/`endTime` (overlap-checked) |
| `announcements` | Notices & events | audience, departments, priority, `publishAt`/`expiresAt`, `eventDate` |
| `notifications` | In-app notifications | `user`, `type`, `isRead` |
| `auditlogs` | Audit trail | `user`, `action`, `module`, `recordId`, timestamp, IP |
| `systemsettings` | Singleton configuration | institution, academic year, working days, slots, designations, attendance/leave/workload rules, notification prefs |
| `counters` | Sequences | atomic counter for faculty IDs |

Every collection has `createdAt`/`updatedAt` timestamps. Application-level referential checks include: no deleting departments that still have faculty, subjects or courses; no deleting subjects that have workload or timetable entries; no unassigning faculty who have workload for that subject; and no moving a department head out of their department.

### Business rules worth knowing
- **Attendance %** = (present + late) ÷ (recorded days − on-leave days) × 100. Leave days don't count against attendance.
- **Approved leave → attendance:** each working day in the range gets one `on_leave` record linked to the leave. Existing *absent* records are converted. Days already marked present/late are left alone and reported back to the approver. Marking someone present on an approved-leave day is refused, and cancelling an approved (future) leave reverts both balance and attendance.
- **Leave days** count working days only (configurable). Applications are checked against balance (allocated − used − pending), overlaps, the maximum length and the back-dating window.
- **Workload status** is computed against the configurable min/max weekly hours. Exceeding the max is allowed but flagged.
- **Self check-in** is *self-reported*. It is labelled as such everywhere and is not biometric or location-verified.

## 6. Folder structure

```
.
├── backend/
│   ├── src/
│   │   ├── config/        env + MongoDB connection
│   │   ├── controllers/   one file per module (auth, faculty, leave, …)
│   │   ├── middleware/    auth/RBAC, validation, sanitising, uploads, rate limits, errors
│   │   ├── models/        Mongoose schemas (16 models)
│   │   ├── routes/        REST route table
│   │   ├── services/      business logic (leave, attendance, workload, export, audit, email, scope…)
│   │   ├── utils/         HTTP helpers, date helpers
│   │   ├── validators/    Zod request schemas
│   │   ├── scripts/       seed.ts, verify-seed.ts
│   │   ├── app.ts         Express app factory
│   │   └── server.ts      entry point
│   ├── tests/             Vitest + Supertest suites
│   └── uploads/           avatars, logos, leave documents (git-ignored)
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── (auth)/        login, forgot-password, reset-password
│       │   └── (dashboard)/   dashboard, faculty, departments, subjects, attendance, leaves,
│       │                      workload, timetable, announcements, notifications, reports,
│       │                      audit-logs, settings, profile
│       ├── components/
│       │   ├── ui/            shadcn/ui primitives
│       │   ├── layout/        sidebar, topbar, breadcrumbs, search, notifications
│       │   ├── shared/        data table, stat card, states, dialogs, selects, export menu…
│       │   ├── charts/        Recharts wrappers
│       │   ├── dashboard/ faculty/ attendance/ leave/ forms/ settings/
│       ├── contexts/          auth context
│       ├── hooks/             settings, options, debounce
│       ├── lib/               api client, navigation, constants, utils
│       ├── schemas/           Zod form schemas
│       └── types/             shared TypeScript types
├── package.json           root convenience scripts
└── README.md
```

## 7. Installation & setup

### Prerequisites
- **Node.js 20+** (developed on Node 22)
- **MongoDB 6+**, either local (`mongod`) or a MongoDB Atlas connection string

### MongoDB setup
- **Local:** install MongoDB Community and start it, e.g. `mongod --dbpath ~/data/db`. The default URI is `mongodb://127.0.0.1:27017/facultyhub`.
- **Docker:** `docker run -d --name facultyhub-mongo -p 27017:27017 mongo:8`
- **Atlas:** create a cluster and put its connection string in `backend/.env` as `MONGO_URI`.

### Install dependencies
```bash
npm run install:all
```

### Environment configuration
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

`backend/.env`

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `5050` | API port (5000 is avoided because macOS AirPlay uses it) |
| `CLIENT_URL` | `http://localhost:3000` | Allowed CORS origin(s), comma-separated |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/facultyhub` | Main database |
| `MONGO_URI_TEST` | `…/facultyhub_test` | **Wiped** by the test suite |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | placeholders | **Change in production** (long random strings) |
| `JWT_ACCESS_EXPIRES` / `REFRESH_TOKEN_DAYS` | `15m` / `7` | Token lifetimes |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | empty | Optional. When `SMTP_HOST` is empty, emails are printed to the API console and the forgot-password screen shows the reset link (development only) |
| `SEED_DEMO_PASSWORD` | `Demo@123` | Password given to every seeded demo account |

`frontend/.env.local`

| Variable | Default |
|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:5050/api` |

### Seed the database
```bash
npm run seed
```
This **clears** the configured database and loads realistic demo data: 7 departments, 28 faculty (including retired/resigned records), 34 subjects across two academic years, 3 academic sessions, about 100 days of attendance, 20 leave applications in every status, 112 workload allocations, about 350 conflict-free timetable entries, announcements/events, notifications and audit history. Dates are relative to the day you seed, so the dashboard always has "today" data. Run `npm run verify:seed --prefix backend` to re-check the timetable for conflicts and print the workload distribution.

### Run (development)
```bash
npm run dev            # API on :5050 and web on :3000, together
# or separately
npm run dev:backend
npm run dev:frontend
```
Open **http://localhost:3000**.

### Production build
```bash
npm run build
npm start
```

### Tests
```bash
npm test               # backend: 61 tests, needs MongoDB (uses MONGO_URI_TEST)
npm run typecheck      # backend + frontend TypeScript
```
The suites cover authentication (hashing, rotation/reuse, reset flow, injection), RBAC and department scoping, faculty CRUD and duplicate validation, attendance (late flagging, no duplicates, future dates, self check-in, percentages), the leave workflow (overlap, balance, approval → attendance, no self-approval, cancellation), timetable conflicts (faculty/room/section, back-to-back slots), workload limits and report exports in every format.

## 8. Demo credentials (development only)

All seeded accounts use the password **`Demo@123`** (set by `SEED_DEMO_PASSWORD`, hashed with bcrypt before insertion).

| Role | Email | Scope |
|---|---|---|
| Administrator | `admin@facultyhub.com` | Entire institution |
| Head of Department | `hod@facultyhub.com` | Computer Science and Engineering (Dr. Rajesh Iyer) |
| Faculty | `faculty@facultyhub.com` | Priya Sharma, CSE (not checked in today, so you can try self check-in) |

Every other seeded faculty member can also sign in with their listed email and the same password. The login page has one-click demo buttons in development builds. **Never use these credentials or the default JWT secrets in production.**

## 9. API overview

Base URL: `http://localhost:5050/api`. All routes except `auth/*`, `health` and `settings/public` require `Authorization: Bearer <accessToken>`.

| Area | Endpoints |
|---|---|
| Auth | `POST auth/login`, `auth/refresh`, `auth/logout`, `auth/forgot-password`, `auth/reset-password`, `auth/change-password`, `GET auth/me` |
| Dashboard | `GET dashboard` (role-specific), `GET search?q=` |
| Users (admin) | `GET users`, `POST users`, `PATCH users/:id`, `POST users/:id/reset-password` |
| Faculty | `GET faculty`, `GET faculty/options`, `GET faculty/:id` (`me`), `GET faculty/:id/teaching-history`, `POST faculty`, `PUT faculty/:id`, `PATCH faculty/:id/status`, `PATCH faculty/:id/restore`, `DELETE faculty/:id[?permanent=true]`, `POST faculty/:id/photo` |
| Departments | `GET departments`, `GET departments/:id`, `POST`, `PUT departments/:id`, `PUT departments/:id/head`, `DELETE departments/:id`, `GET departments/attendance` |
| Courses / Subjects | `GET/POST courses`, `PUT/DELETE courses/:id`; `GET subjects`, `GET subjects/allocation`, `GET/PUT/DELETE subjects/:id`, `POST subjects`, `PUT subjects/:id/faculty` |
| Sessions | `GET/POST sessions`, `PUT/DELETE sessions/:id`, `PATCH sessions/:id/current` |
| Attendance | `GET attendance`, `GET attendance/daily`, `POST attendance/bulk`, `PUT/DELETE attendance/:id`, `POST attendance/check-in`, `POST attendance/check-out`, `GET attendance/today`, `GET attendance/summary`, `GET attendance/calendar`, `GET attendance/trend`, `GET attendance/department-stats` |
| Leave | `GET leaves`, `GET leaves/:id`, `POST leaves` (multipart), `PATCH leaves/:id/approve`, `PATCH leaves/:id/reject`, `PATCH leaves/:id/cancel`, `GET leaves/:id/document`, `GET leaves/balance`, `GET leaves/balances`, `PUT leaves/balances/:facultyId` |
| Workload | `GET workload`, `GET workload/summary`, `POST workload`, `PUT/DELETE workload/:id` |
| Timetable | `GET timetable`, `GET timetable/meta`, `POST timetable/check-conflicts`, `POST timetable`, `PUT/DELETE timetable/:id` |
| Announcements | `GET announcements[?manage=true]`, `GET announcements/events`, `POST`, `PUT/DELETE announcements/:id` |
| Notifications | `GET notifications`, `GET notifications/unread-count`, `PATCH notifications/:id/read`, `PATCH notifications/read-all`, `DELETE notifications/:id` |
| Reports | `GET reports/:type?format=json|csv|xlsx|pdf` with `from`, `to`, `department`, `faculty`, `status`, `academicYear`, `term` (types: `faculty-directory`, `department-summary`, `attendance`, `leave`, `workload`, `subject-allocation`, `employment-status`) |
| Audit & settings | `GET audit-logs`, `GET audit-logs/facets` (admin); `GET settings`, `GET settings/public`, `PUT settings`, `POST settings/logo` (admin) |

### Role permissions (server-enforced)
| Capability | Admin | HOD (own department) | Faculty (self) |
|---|:-:|:-:|:-:|
| Manage faculty / departments / users / settings / audit | ✅ | faculty & department details only | — |
| Subjects, courses, workload, timetable | ✅ | ✅ | view own |
| Mark/edit attendance | ✅ | ✅ (if enabled) | self check-in (if enabled) |
| Approve/reject leave | ✅ | ✅ (not their own) | apply/cancel own |
| Announcements | all audiences | own department | read |
| Reports | all | department | own attendance, leave, workload |

## 10. Screenshots

> Add screenshots to `docs/screenshots/` after running the app locally.

| Screen | File |
|---|---|
| Login | `docs/screenshots/login.png` |
| Admin dashboard | `docs/screenshots/admin-dashboard.png` |
| Faculty directory | `docs/screenshots/faculty-list.png` |
| Faculty profile | `docs/screenshots/faculty-profile.png` |
| Attendance register | `docs/screenshots/attendance-mark.png` |
| Leave review | `docs/screenshots/leave-review.png` |
| Workload | `docs/screenshots/workload.png` |
| Timetable | `docs/screenshots/timetable.png` |
| Reports | `docs/screenshots/reports.png` |
| Dark mode | `docs/screenshots/dark-mode.png` |

## 11. Troubleshooting

- **`EADDRINUSE :5000` / strange responses on port 5000:** macOS AirPlay Receiver uses port 5000, which is why the API defaults to **5050**.
- **"Cannot reach the server" in the UI:** check that the API is running and that `NEXT_PUBLIC_API_URL` matches its port.
- **Signed out after re-seeding:** seeding clears refresh tokens, so sign in again.
- **Emails not arriving:** without `SMTP_HOST`, emails are printed to the API console by design.

## 12. Project status

All modules in the specification are implemented and connected to MongoDB. Possible future enhancements:
- Push or real-time (WebSocket) notifications in place of the 60-second polling of the notification bell.
- A background job to send notifications for announcements scheduled in the future (today these notify at creation only if already published).
- Frontend component and E2E tests (e.g. Playwright); the backend suite currently covers the business rules.
