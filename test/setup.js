// Attempt to load jest-dom matchers; skip silently if the peer
// @testing-library/dom is not installed in this environment.
try {
  await import("@testing-library/jest-dom");
} catch {
  // @testing-library/dom peer not installed — DOM-specific matchers
  // (toBeInTheDocument, etc.) will not be available, but pure-logic
  // tests that don't use them will still run correctly.
}

import { beforeAll, afterEach, afterAll } from "vitest";
import { server } from "../src/mocks/server.js";

// MSW intercepts network requests at the request layer (fetch/XHR), so tests
// no longer depend on ad-hoc `vi.spyOn(global, 'fetch')` mocks per-file for
// backend API / Horizon / Soroban RPC calls. Individual tests can still
// override a handler for one case via `server.use(...)`.
beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
