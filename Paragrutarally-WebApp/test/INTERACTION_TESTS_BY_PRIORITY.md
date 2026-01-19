# Interaction tests (Vitest + React Testing Library) — prioritized checklist

This file is a living checklist of **UI/interaction** tests to add next. It’s organized by priority (P0 → P2) and maps each item to the likely spec file to create under `test/`.

Conventions used in this repo:
- UI tests live in `test/**/*.ui.spec.{ts,tsx}` (jsdom project).
- Prefer role-based queries (`getByRole`, `findByRole`) and `userEvent` for interactions.
- Mock at module boundaries (services/toasts), not React internals.

## P0 — core routing/auth + critical admin actions

### 1) Route protection + redirects
- **Target:** `src/components/routing/ProtectedRoute.jsx`
- **Why:** A small break here blocks the whole app.
- **New spec:** `test/routing/ProtectedRoute.ui.spec.tsx`
- **Scenarios:**
  - [ ] Shows loading UI when auth/permissions are loading.
  - [ ] Redirects unauthenticated users to `/login` (preserves `from` in router state).
  - [ ] Allows access when authenticated and no role requirement.
  - [ ] Denies access when role missing and shows “Access Denied”.
  - [ ] “Go to Dashboard” button navigates to role-based dashboard (`window.location.href`).
  - [ ] `RequireInstructorOnly`: admin is denied when `strictRole` is true.
- **Mocking notes:** mock `useAuth()` and `usePermissions()`; render with `MemoryRouter` + `Routes`.

### 2) Admin users table: sorting + delete confirmation flow
- **Target:** `src/components/tables/UsersTable.jsx`
- **Why:** High-risk destructive action; needs confidence.
- **New spec:** `test/tables/UsersTable.ui.spec.tsx`
- **Scenarios:**
  - [ ] Sort toggles per header click: `asc` → `desc` → reset; order updates accordingly.
  - [ ] Clicking “Delete” opens confirmation modal with correct user details.
  - [ ] Clicking overlay (outside modal) cancels and closes.
  - [ ] Confirm calls `deleteUserCompletely(user.id)` and then calls `onUserDeleted`.
  - [ ] Error path: service rejects; shows error alert and does not call `onUserDeleted`.
- **Mocking notes:** mock `@/services/userService.js`; stub `window.alert`.

### 3) Role redirect handler (if used for post-login navigation)
- **Target:** `src/components/routing/RoleRedirectHandler.jsx`
- **New spec:** `test/routing/RoleRedirectHandler.ui.spec.tsx`
- **Scenarios:**
  - [ ] Navigates to correct dashboard for each role.
  - [ ] Handles missing/unknown role safely (e.g., to `/login`).

## P1 — key user workflows (forms + dashboards)

### 4) Parent/Host dashboard: expand/collapse + comment edit/save/cancel
- **Targets:** `src/pages/parent/ParentDashboardPage.jsx`, `src/pages/host/HostDashboardPage.jsx`
- **New specs:**
  - `test/pages/ParentDashboardPage.ui.spec.tsx`
  - `test/pages/HostDashboardPage.ui.spec.tsx`
- **Scenarios:**
  - [ ] Expanding a kid shows details; collapsing hides them.
  - [ ] “Edit comments” enters edit mode; textarea shows existing comments.
  - [ ] “Cancel” restores previous comments and exits edit mode.
  - [ ] “Save” calls the save method and updates UI state (success path + failure path).
- **Mocking notes:** mock the Firestore/service layer used by these pages (don’t hit emulators here unless necessary).

### 5) Forms: submit/edit flows from user-facing pages
- **Targets:** `src/pages/parent/MyFormsPage.jsx`, `src/pages/instructor/InstructorFormsPage.jsx`
- **New specs:**
  - `test/pages/MyFormsPage.ui.spec.tsx`
  - `test/pages/InstructorFormsPage.ui.spec.tsx`
- **Scenarios:**
  - [ ] “View form” opens the form view and renders fields.
  - [ ] “Submit form” validates required fields and blocks submit on invalid data.
  - [ ] Submitting calls the service with correct payload and shows success state.
  - [ ] Editing an existing submission loads data and saves updates.
- **Mocking notes:** mock `src/firebase/services/forms` (or whatever module the page uses) at the boundary.

### 6) Admin forms management: create + view + action buttons
- **Target:** `src/pages/admin/FormsManagementPage.jsx` (and/or `src/components/forms/FormsManagement.js`)
- **New spec:** `test/pages/FormsManagementPage.ui.spec.tsx`
- **Scenarios:**
  - [ ] “Create New Form” triggers navigation / builder creation flow.
  - [ ] Card click opens form details; action buttons don’t trigger card click (stopPropagation).
  - [ ] Error banner close button clears error state.

## P2 — regression coverage + secondary interactions

### 7) Search/filter UX on dashboards
- **Targets:** `src/pages/*/*Dashboard*`
- **New specs:** per page (only after stabilizing P0/P1)
- **Scenarios:**
  - [ ] Typing filters list results; “clear search” resets and restores list.
  - [ ] Pagination controls (where present) disable/enable appropriately.

### 8) “Update” flows from tables/cards
- **Targets:** `src/components/tables/UsersTable.jsx`, other management tables
- **New specs:** extend existing table specs
- **Scenarios:**
  - [ ] Clicking “Update” calls `onUpdateUser(user)` and does not trigger other handlers.

### 9) Excel import/export UI (if/when present in UI)
- **Targets:** `src/utils/excelUtils.js` and any import UI component/page
- **New spec:** `test/pages/*Import*.ui.spec.tsx`
- **Scenarios:**
  - [ ] Upload rejects wrong file type; accepts `.xlsx` and calls import handler.

## First test to write

If you’re starting today, start with **P0.1 `ProtectedRoute`** because it’s self-contained (easy mocks) and immediately protects against app-wide breakage. Then do **P0.2 `UsersTable` delete flow** (highest-risk interaction).
