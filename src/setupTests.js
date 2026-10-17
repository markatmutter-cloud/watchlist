// Jest setup — loaded automatically by react-scripts test before any
// test file runs. Wires up @testing-library/jest-dom's custom matchers
// (toBeInTheDocument, toHaveStyle, etc.) so individual tests don't have
// to import them.
import "@testing-library/jest-dom";

// jsdom has no layout, so window.scrollTo logs "Not implemented" on every page mount that
// resets scroll (PageShell). It is a no-op in tests; stub it so real errors stay visible.
if (typeof window !== "undefined") window.scrollTo = () => {}; // node-environment suites have no window
