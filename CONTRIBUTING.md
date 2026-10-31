# Contributing

1. Create a feature branch from `main`.
2. Keep core functionality independent of experimental integrations.
3. Add tests for pure parsing/conversion logic.
4. Run typecheck, lint, formatting checks, tests, and production build.
5. Describe manual Obsidian test steps in the pull request.

Do not add private Obsidian DOM selectors to core modules. Experimental integrations belong under `src/experimental/`.
