# Testing best practices (Vitest + React Testing Library + Firebase emulators)

## General
- Prefer user-visible behavior assertions over implementation details.
- Keep tests isolated: one component per file, mock boundaries (services/toasts) and `vi.resetAllMocks()` in `beforeEach`.
- Use realistic data and explicit names (`userId`, `teamId`) to keep intent obvious.
- Prefer accessible names for icon-only buttons (e.g., `aria-label`) so tests can use `getByRole(..., { name })`.

## React Testing Library patterns
- Use `screen` queries (`getByRole`, `getByLabelText`) first; fall back to text/test ids only when needed.
- Use `userEvent.setup({ pointerEventsCheck: 0 })` to match existing tests and avoid Radix/JSDOM pointer quirks.
- Async UI: prefer `findBy*` for “appears” and `waitFor` for “eventually true”; avoid arbitrary `setTimeout`s.
- Scope assertions with `within(container)` (e.g., cards, dialogs) to prevent false positives.
- Avoid brittle selectors: don’t use `getAllByRole(...)[i]`; prefer accessible names/labels and scoped queries (`within(row)`).
- If a control is hard to query, fix the component: add an accessible name (`aria-label` for icon buttons and `SelectTrigger`) so tests can select by role+name.
- Loading states: prefer `role="status"` + accessible name over class-based assertions (e.g., avoid `getElementsByClassName('animate-pulse')`).

## React Router patterns
- Redirects (`<Navigate />`): render with `MemoryRouter` + `Routes` and assert the destination route content.
- Use stable route content for assertions (e.g., `<Route path="/auth" element={<div>Auth Page</div>} />`) rather than inspecting router internals.

## Mocking and errors
- Mock external dependencies at module boundaries (`vi.mock('@/services/...')`, `vi.mock('sonner')`) and assert calls via `vi.mocked(...)`.
- Prefer realistic service return shapes; use project helpers when available.
- When exercising error paths that log to the console, silence and restore with:
  - `const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});`
  - `consoleError.mockRestore();`

## Firebase emulator integration
- Run integration tests under `firebase emulators:exec` so the test process gets `FIRESTORE_EMULATOR_HOST` / `FIREBASE_AUTH_EMULATOR_HOST`.
- Prefer `vitest run --no-file-parallelism` for emulator integration runs (Firebase SDK is singleton-heavy; parallel test files can interfere with each other).
- Seed Firestore data with admin privileges (e.g., `RulesTestEnvironment.withSecurityRulesDisabled(...)`) so security rules don’t block setup.
- Authenticate the Firebase client before reads/writes when rules require it (e.g., `signInAnonymously(auth)` for rules that only require `request.auth != null`).
- Clear emulator state between tests (e.g., `RulesTestEnvironment.clearFirestore()`).
- Keep emulator-facing tests explicit and separate from pure unit tests (this repo uses `test/**/*.ui.spec.tsx` for jsdom tests).
- Avoid querying the `users` collection from the client in tests unless rules allow it (our rules generally allow `read` on `/users/{uid}` but not `list`); seed `/users/{uid}` directly with `withSecurityRulesDisabled`.

## Shared test suites (`*.tests.ts`)
- Shared “runXYZTests(setupFn)” helpers should be order-independent: never assume “the first button/card is the one we want”.
- Scope interactions to the right container: find the card/section first, then `within(card).getByRole(...)`.
- In async pages, wait for the specific section + content you need (e.g., `await screen.findByText('Available Forms')` and `await within(section).findByText(formTitle)`), not just “any occurrence of the title”.
- Not every test belongs in both unit and integration: keep “simulateError” / forced failure tests unit-only (integration should validate rules + wiring, not internal error injection).

## What to avoid
- Don’t assert on CSS classes or layout unless that’s the feature under test.
- Don’t over-mock React internals; mock network/services instead.
- Don’t couple to Radix portal structure; assert on roles like `dialog`/`alertdialog`.
