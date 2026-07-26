// Attempt to load jest-dom matchers; skip silently if the peer
// @testing-library/dom is not installed in this environment.
try {
  await import("@testing-library/jest-dom");
} catch {
  // @testing-library/dom peer not installed — DOM-specific matchers
  // (toBeInTheDocument, etc.) will not be available, but pure-logic
  // tests that don't use them will still run correctly.
}
