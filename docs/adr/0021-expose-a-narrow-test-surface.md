# Expose a Narrow Test Surface

The browser game will expose a small `window.skiFreeTest` surface for deterministic checks: seed control, state snapshots, and forcing milestone conditions. This keeps Playwright tests stable without turning the production game into a broad debug console.
