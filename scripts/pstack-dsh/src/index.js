/**
 * Compatibility entry point.
 *
 * The Cordis plugin lives in `./plugin.js`; the package's `main` and `exports`
 * point there directly. This module stays as a stable import path for tests and
 * for anyone importing the bundle from a repository plugin.
 */
export * from "./plugin.js";
