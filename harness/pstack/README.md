# pstack harness trees

This folder is generated from `pstack/skills`, `pstack/agents`, `pstack/docs/guide`, each harness adapter under `pstack/docs/harness/`, `pstack/README.md`, `pstack/LICENSE`, `pstack/plugin.json`, and the DeepSeek Harness package sources in `scripts/pstack-dsh/`. Do not edit it by hand.

Cursor uses `pstack/` directly. Claude Code installs `claude-code/`, and DeepSeek Harness installs `dsh/` as a bundle. Each tree leaves out the rest of `pstack/`, such as `pstack/automations` and `pstack/assets`. A relative link to a pstack file that a tree leaves out points at that file on GitHub `main` instead.

After editing those sources, run `node scripts/generate-pstack-harness-trees.mjs` from the repository root and commit the result.
