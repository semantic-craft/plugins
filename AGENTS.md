# pstack DSH adapter

Start with [README.md](README.md) for the source, generated package, and validation entry points.

- Edit skills in `pstack/skills/` and DSH packaging in `scripts/pstack-dsh/`; regenerate `harness/pstack/` with `node scripts/generate-pstack-harness-trees.mjs`.
- The DSH package is `harness/pstack/dsh/`. Its README owns installation, profile selection, and runtime requirements.
- A sparse checkout may hide unrelated upstream plugins. Preserve the complete Git history and upstream sources.
- Before implementation or validation, read [lessons.md](lessons.md). Tests prove packaging and registration behavior; a live DSH session is separate acceptance.
- 验证：`check`（运行 `scripts/check`：README 的三条校验命令）。
