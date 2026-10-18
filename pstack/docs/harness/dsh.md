# pstack in DeepSeek Harness

pstack skills use Cursor names. In DeepSeek Harness, read this file once per session, then map each Cursor name in a skill with the tables below. `<bundle>` means the installed package root, two directories above this file (this file is `<bundle>/docs/harness/dsh.md`), which holds `skills/`, `agents/`, `docs/`, `README.md`, `package.json`, and `cordis.patch.yml`. If a Cursor field has no row, drop it and say so. Never pass a field or value the tool schema rejects.

## Tools

| Cursor | DeepSeek Harness |
| --- | --- |
| `Task` | `subagent` starts a fresh child that does not see this conversation. `subagent_fork` starts a child that inherits this conversation's completed turns. `subagent_codex` starts a child on the Codex backend when the deployment mounts it. All three take a self-contained `prompt` and return a child id immediately; the result arrives later as a message, not in the tool result. |
| `AskQuestion` | `ask_user` when the session offers it (a short multiple-choice card; the answer arrives as the next user message), otherwise `ask_user_question`. A headless `dsh` run has no answerer, and a blocking call fails there, so ask in plain text and stop. |
| Open a todolist | `todo_write`. Every call rewrites the whole list, so send the complete list each time, not an increment. |
| Run another pstack skill (`/name` or "the **name** skill") | For a model-invocable skill, call the `skill` tool with its exact name. Only `setup-pstack` is model-invocable in pstack. Every other skill sets `disable-model-invocation: true`, and the `skill` tool refuses it as not available for model invocation, so read `<bundle>/skills/<name>/SKILL.md` and follow it. When you tell the user to run one, write `/<name>`: DeepSeek Harness invokes user-invocable skills by their bare slash name and has no `pstack:` prefix. |
| `Grep`, `Glob` | `grep` and `glob`. They run the bundled ripgrep themselves, so no `rg` on `PATH` and no shell hop. |
| Shell, `Bash` | `bash`. Each call is a fresh shell, so pass `workdir` instead of `cd`. A long command sets the shell's own `run_in_background: true`, then collects with `job_output` and stops with `job_kill`; that is the shell field, not the `Task` one. |
| `Read`, `Write`, `Edit` | `read`, `write`, `edit`. `write` replaces the whole file and `edit` replaces one literal string, so read before you overwrite. |
| `WebFetch`, `WebSearch` | `web_fetch` and `web_search` when the session mounts them. |

## Subagent fields

| Cursor | DeepSeek Harness |
| --- | --- |
| `subagent_type: generalPurpose` | Omit `subagent_type`. `subagent` already starts a fresh agent with no conversation context, so its `prompt` must carry the whole task. |
| `poteto-agent`, `comment-sicko` | DeepSeek Harness has no subagent types. Read `<bundle>/agents/<name>.md`, drop its frontmatter (including `is_background: true`), and paste the full body into the `prompt` after the task. Give the child `<bundle>` as an absolute path so it can read `skills/poteto-mode/SKILL.md` itself. |
| `readonly: true` | `subagent` has no readonly field. Write "do not edit files, return findings only" into the brief, then run `bash` with `git status --porcelain` afterwards and reject an unexpected diff. |
| `readonly: false` | An ordinary `subagent`. Agent mode is the default. |
| `environment: "cloud"` | DeepSeek Harness has no cloud environment. Use `create_worktree` when the deployment mounts it: it makes a new branch and checkout for the child and changes this session's directory to it. Otherwise run the child locally. State the choice in the brief. |
| `environment: "local"` | Omit. Children run locally by default. |
| `cloud_base_branch: <b>` | Tell the worker to check out `<b>` first. `create_worktree` starts `from` a local commit, branch, or tag. |
| `run_in_background: true` | Omit. Every subagent runs asynchronously: the call returns the child id at once, the child reports back when it settles, and you recall ids with `list_agents` and steer or follow up with `send_message`. |
| `resume` | `send_message` to the child id. Local children steer while running and resume from persistence when idle. External backends (Codex, Claude Code, ACP, DSH SDK) accept no follow-up, so give them a consolidated brief once. |
| `file_attachments` | List the absolute file paths in the `prompt`. There is no attachments field. |
| `model` | See Models. |

## Models

| Cursor | DeepSeek Harness |
| --- | --- |
| `claude-<family>-<version>-<effort>[-fast]`, such as `claude-opus-5-5-xhigh` | Omit the model. The default `subagent` schema has no `model` field, so the child runs on the session model. |
| A `grok-*` slug such as `grok-4.7-xhigh-fast`, or a `gpt-*` slug such as `gpt-4o` | Omit the model, run on the session model, and say so. |
| `auto` or `inherit-parent` | Omit the model. That is already what DeepSeek Harness does. |
| The `pstack-models.mdc` rule, `~/.cursor/rules/pstack-models.mdc` | No equivalent. DeepSeek Harness loads `AGENTS.md` project instructions, not a per-skill rules directory, and the default delegation tool exposes no per-role model field. Ignore the role line and run on the session model. |
| `list_models` (deployments name it `list_subagent_models`) | Run it to inspect which subagent routes the deployment advertises. It only lists routes. It does not pin a model for a child. |

Some deployments enable model selection, which adds optional `provider`, `model`, and `reasoning_effort` fields to `subagent`. Only then may you pin a route, and prefer one that `list_models` reports. `subagent_fork` always keeps its fixed route.

## setup-pstack

Follow the skill with these changes:

- Detect. Run `list_models` (or `list_subagent_models`) and collect the exact subagent routes it reports. If it fails or prints nothing, ask the user to paste the routes they use, otherwise report the session model. Never write a route you have not confirmed.
- Map. For showing the table, keep each default slug such as `claude-opus-5-5-xhigh`, `grok-4.7-xhigh-fast`, or `inherit-parent` as a label. Do not treat it as a value the delegation tool accepts.
- Write. Do not write `~/.claude/rules/` or `.cursor/rules/`, and do not write `AGENTS.md`. DeepSeek Harness has no rule file that pins a model per role. Report the detected routes, name each role's configured value, and say plainly that role pinning is unavailable in DeepSeek Harness, so every skill and subagent runs on the session model. Then stop. Do not rewrite a rule on a re-run, because there is none.
- Stop. Skip the optional verification-skill step unless the user asks for it. If they do, read `<bundle>/skills/create-verification-skill/SKILL.md` and follow it.

## Paths

| Cursor | DeepSeek Harness |
| --- | --- |
| `.cursor/skills/`, `~/.cursor/skills/` | `.dsh/skills/` in the project (the nearest ancestor with `.git`), and `$DSH_HOME/skills/` for the user, which is `~/.dsh/skills/` by default. |
| `~/.cursor/plugins/`, `.cursor-plugin/plugin.json` | A DeepSeek Harness bundle: a package whose `package.json` declares `dsh.bundle.patch` pointing at a `cordis.patch.yml`, whose inserted row mounts an entry module that registers the copied skills on `ctx.skills`. The bundle installs under `$DSH_HOME/profiles/<profile>/node_modules/dsh-pstack-plugin/`, so that directory is `<bundle>`. |
| `.cursor/rules/*.mdc`, always-applied rules | `AGENTS.md`, or `CLAUDE.md`. DeepSeek Harness loads the project instruction chain from the project root down to the working directory, plus `$DSH_HOME/AGENTS.md`. It never reads `.mdc` files, and the model rule has no equivalent. See Models. |
| `https://github.com/cursor/plugins/blob/main/pstack/<path>` | `<bundle>/<path>` when that file exists. The bundle ships `skills/`, `agents/`, `docs/guide/`, `docs/harness/dsh.md`, `README.md`, and `LICENSE`. Read the local copy and never fetch it. Give the user the URL when they need a link. |
| Transcripts in `~/.cursor/projects/<slug>/agent-transcripts/` | `session_search` and `session_event_search` for prior sessions in this workspace, `session_trace` for lineage, and `read_own_chat` for this chat's earlier parts when the client exposes it. The session tools authorize per workspace already, so never read another workspace's chats. |

## Cursor-only features

DeepSeek Harness has no Cursor Automations, Bugbot, Cursor cloud agents, `/loop`, or custom modes. When a step needs one, put one line in your reply, `Skipped in DeepSeek Harness: <step>. <reason>.`, then go on to the next step. Do not stop, ask, or retry. When a later step needs what the skipped step made, such as a URL or a key, leave a placeholder and name it in the line.

| Cursor | DeepSeek Harness |
| --- | --- |
| Cursor Automations: routines, `update_state` routine calls, `api2.cursor.sh/automations` webhooks, routine wakes, and `SendToUser` secret requests | Skip with the line. |
| Bugbot | Bugbot comments on a GitHub PR are ordinary review threads, so triage them with the forge command that the step gives. Skip a step that starts, waits for, or configures Bugbot when the PR has no Bugbot check or comment. |
| Cursor cloud agents | `environment: "cloud"` maps to `create_worktree` or a local child, as in Subagent fields. Skip a step that needs the cloud agent itself, such as its dashboard status or its own machine. |
| `/loop` and custom modes | Skip with the line. A skill attaches to one message here, so invoke it again on the next turn instead of looping inside a mode. |
| A built-in PR tool | Use the forge command that the step gives, such as `gh pr create`. That is not a skip, so write no line. |

## DSH-only notes

**The user invokes a skill with `/name`.** There is no plugin prefix and no marketplace command. A pstack skill is user-invocable unless its frontmatter sets `user-invocable: false`, and `disable-model-invocation: true` only hides it from the model catalog and the `skill` tool. It stays in the user's `/` menu.

**Install as a bundle.** pstack installs as an ordinary DeepSeek Harness bundle:

```sh
# from the fork, pinned to a commit
dsh plugin --profile <profile> add 'git+https://github.com/semantic-craft/plugins.git#<commit>&path:/harness/pstack/dsh'

# or from a local clone
dsh plugin --profile <profile> add link:/absolute/path/to/semantic-plugins/harness/pstack/dsh

dsh --profile <profile> --dump-config   # shows the "# == dsh-pstack-plugin" layer
```

After the bundle mounts, the skills appear in the `/` menu and in the model's skill catalog. `dsh plugin --profile <profile> remove dsh-pstack-plugin` unmounts them, and a live profile recomposes without a restart.

**There are no subagent types.** `poteto-agent` and `comment-sicko` are briefs under `<bundle>/agents/`, not tools. A subagent has no `subagent_type`, no `readonly`, no `environment`, no background flag, and no per-child model in the default schema.

**A subagent cannot ask the user.** `ask_user` rejects a live child caller, so the child must return an unresolved decision in its final message and the parent asks.

**Nothing pins a model per role.** DeepSeek Harness has no `pstack-models.mdc` equivalent. Use the session model, or the deployment's opt-in subagent route fields when they are visible.

The mappings above come from the DeepSeek Harness docs: the skill registry and the local discovery roots (`reference/subsystems/skills.md`), the subagent service and its providers (`reference/subsystems/subagent.md`), the tool schemas (`reference/tool-catalog.md`), and bundle packaging (`develop/basic/publish.md`).
