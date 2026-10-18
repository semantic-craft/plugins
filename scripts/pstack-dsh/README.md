# pstack for DeepSeek Harness

pstack is Lauren Tan's ([@poteto](https://x.com/poteto)) set of rigorous agent
workflows: 54 skills for writing less, but higher quality code. This package is
the DeepSeek Harness (DSH) port. It loads those skills as registered runtime
skills, so they are available as `/name` commands and — for the one skill that
opts in — to the model's `skill` tool.

This folder is **generated**. It is assembled from `pstack/skills`,
`pstack/agents`, `pstack/docs/guide`, `pstack/docs/harness/dsh.md`,
`pstack/LICENSE`, and the package sources in `scripts/pstack-dsh/` at the
repository root. Do not edit it by hand: after changing any of those sources,
run `node scripts/generate-pstack-harness-trees.mjs` from the repository root
and commit the result. CI fails while the generated tree is out of date.

- Version: substituted from `pstack/plugin.json` when generated.
- Adapter: read [the DSH adapter](./docs/harness/dsh.md) once per session. It
  maps every Cursor name in pstack skills (`Task`, `AskQuestion`, `todolist`,
  subagent fields, `pstack-models.mdc`, transcripts, skill roots) to its
  DeepSeek Harness counterpart.

## Requirements

- DeepSeek Harness `>=0.2.1-rc.2 <0.3.0` (`engines.dsh` in `package.json`
  rejects older and newer runtimes at install time).
- Node.js 20 or newer.
- No runtime dependencies.

## Install

The bundle is a normal npm package with a `dsh.bundle.patch` entry, so any
`dsh plugin` form works. Pick one:

**From the repository, pinned to a commit** (recommended; the `path:` suffix
selects the package inside the repository):

```bash
dsh plugin --profile pstack add \
  'git+https://github.com/semantic-craft/plugins.git#<commit>&path:/harness/pstack/dsh'
```

**From a local clone** (the tree must already be generated and checked out):

```bash
dsh plugin --profile pstack add "link:/path/to/plugins/harness/pstack/dsh"
```

Or run the bundled helper, which links the checkout it lives in:

```bash
scripts/install.sh                  # profile pstack-dsh
PROFILE=desktop scripts/install.sh  # another profile
scripts/install.sh --uninstall      # remove it again
```

`dsh plugin` forwards to pnpm in the profile and records the bundle in
`dsh.profile.bundles`. Verify the layer without starting a session:

```bash
dsh --profile pstack --dump-config   # shows the "# == dsh-pstack-plugin" layer
```

## Use

Start a session, then type the skill name as a command:

```text
/setup-pstack     # pick models and reasoning budgets if you want to
/poteto-mode      # the main entry point: rigour for a real task
/poteto-help      # which skill fits this task?
```

Skills are invoked as `/name`. There is **no `pstack:` prefix** in DeepSeek
Harness (Claude Code adds one because plugins are namespaced there).

**53 of the 54 skills are user-invocable only by design.** They set
`disable-model-invocation: true`, because pstack wants a person to choose them
rather than having a model route into them mid-task. In DSH that means they
appear in the user-facing command catalog but not in the model's `skill` tool
catalog. The exception is `/setup-pstack`, which is both user- and
model-invocable so the agent can detect available models and report them.

pstack's two subagent briefs, `agents/poteto-agent.md` and
`agents/comment-sicko.md`, are **not** skills and are not registered. DeepSeek
Harness has no `subagent_type` field: a skill that needs one of these briefs
loads the Markdown and pastes it into the task prompt for `subagent` /
`subagent_fork`. See [the DSH adapter](./docs/harness/dsh.md) for the mapping.

**No model pinning.** DeepSeek Harness has no `~/.claude/rules/` equivalent, so
`/setup-pstack` does not write a model-rules file and does not pin pstack's
default models. It reports the models the session can reach (via `list_subagent_models`,
only when the deployment mounts model selection) and leaves selection to the
harness. Skills that name a model in its Cursor form default to the session's
own model unless the deployment turns on per-subagent model selection.

## Layout

```text
package.json          DSH bundle manifest (dsh.bundle.patch -> cordis.patch.yml)
cordis.patch.yml      inserts one row: this package's own entry module
src/plugin.js         Cordis plugin: loads skills/ and registers them on ctx.skills
src/index.js          compatibility re-export of ./plugin.js
skills/               54 SKILL.md skills, copied from pstack/skills
agents/               poteto-agent.md and comment-sicko.md subagent briefs
docs/guide/           the pstack guide
docs/harness/dsh.md   the DSH adapter every wrapped skill reads once per session
scripts/install.sh    local link install / uninstall into a dsh profile
test/plugin.test.js   node --test coverage of loading, registration, frontmatter
```

## Test

```bash
node --test test/plugin.test.js
```

Tests run both in this generated tree and in the template source at
`scripts/pstack-dsh/`, where they resolve the real `pstack/skills` instead.

Run the file, not a bare `node --test` from the package root: pstack ships
Bun-only `*.test.ts` files under `skills/poteto-mode/scripts/`, and Node's
default test-file glob picks those up (they import `bun:test`). They are not
part of this bundle's suite.

## Credits and license

pstack is by Lauren Tan ([@poteto](https://x.com/poteto)), from
[`cursor/plugins`](https://github.com/cursor/plugins), MIT licensed. The skills,
agents, guide, and adapter text come from that project; this package adds only
the DeepSeek Harness bundle packaging (`package.json`, `cordis.patch.yml`,
`src/`, tests, and the install script). See [LICENSE](./LICENSE).

pstack is distributed in the hope that it will be useful, but without warranty;
see the license for details.
