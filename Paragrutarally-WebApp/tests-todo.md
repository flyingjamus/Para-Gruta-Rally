# Testing Todo List

This document outlines the prioritized testing tasks to ensure comprehensive coverage across the Paragrutarally WebApp.

## Strategy
Follow the patterns defined in `TESTING_BEST_PRACTICES.md`:
-   **Unit Tests (`.unit.spec.tsx`)**: Component logic, rendering, mocked dependencies.
-   **Integration Tests (`.integration.spec.tsx`)**: Firebase Emulator integration.
-   **Shared Logic (`.tests.ts`)**: Reusable test scenarios.

## 1. High Priority (Core Management & Stability)

These areas handle critical data or user access and currently lack comprehensive test suites in `test/pages`.

### Admin Management Pages
- [ ] **UserManagementPage** (`src/pages/admin/UserManagementPage.jsx`)
    - Unit: Test listing users, filtering, and role badges.
    - Integration: Test `createUser` and `updateUser` flows via emulators.
    - Modals: Cover `CreateUserModal` and `UpdateUserModal` interactions.
    
- [ ] **TeamsManagementPage** (`src/pages/admin/TeamsManagementPage.jsx`)
    - Unit: Test team tables, industry grouping, and empty states.
    - Integration: Test `AddTeamPage` and `EditTeamPage` flows.
    
- [ ] **KidsManagementPage** (`src/pages/admin/KidsManagementPage.jsx`)
    - Unit: Test searching, pagination (if any), and `AddKidPage` navigation.

### Critical Modals
- [ ] **CreateUserModal / UpdateUserModal**
    - Verify form validation (required fields, email format).
    - Detailed error handling for duplicate emails.
- [ ] **ParentKidEditModal**
    - Existing usage in `ParentDashboardPage` might be covered, but ensure dedicated unit tests exist for edge cases.

### Logic & Utilities
- [ ] **src/utils/formatUtils.js**
    - Precise unit tests for all formatting functions (dates, capitalization).
- [ ] **src/utils/excelUtils.js**
    - Unit tests ensuring correct `exceljs` calls and data mapping.

## 2. Medium Priority (Event & Instructor Flows)

### Event Management
- [ ] **EventManagementPage**
    - Test event listing and status filters.
- [ ] **CreateEventPage / EditEventPage**
    - Create a shared `EventForm.tests.ts` if the form logic is similar.
    - Test validation for dates and location fields.

### Instructor Workflow
- [ ] **InstructorEventsPage**
    - Verify instructors only see their events.
- [ ] **InstructorCommentModal**
    - Test comment submission and history display.

## 3. Low Priority (Read-Only & Static)

- [ ] **View* Pages** (`ViewEventsPage`, `ViewKidPage`, `ViewTeamPage`)
    - Basic rendering tests to ensure they don't crash with null data.
- [ ] **LegalModal**
    - Verify content rendering.

## Completed / Reference (Do Not Duplicate)
The following have established patterns in `test/pages`:
- [x] `InstructorFormsPage`
- [x] `HostDashboardPage`
- [x] `ParentDashboardPage`
- [x] `MyFormsPage`
- [x] `FormsManagementPage`
