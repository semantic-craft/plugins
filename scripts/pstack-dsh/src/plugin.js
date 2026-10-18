/**
 * dsh-pstack — the DeepSeek Harness bundle for pstack.
 *
 * pstack ships 54 skills (one `skills/<name>/SKILL.md` per skill) and two
 * subagent briefs (`agents/poteto-agent.md`, `agents/comment-sicko.md`). The
 * harness has no skills marketplace and no `subagent_type` field, so this
 * bundle does two things:
 *
 *   - It reads every `skills/<name>/SKILL.md` at mount time and registers each
 *     one as an embedded runtime skill on `ctx.skills`, the registry-owned
 *     in-memory registration documented by `@deepseek-ai/dsh-skill`. The
 *     model-facing `skill` tool and the `/name` command surface do the rest.
 *   - It leaves `agents/` alone. Those files are subagent briefs that a skill
 *     pastes into a `subagent` prompt; they are not skills, and registering
 *     them would advertise two extra entries in the `/` menu.
 *
 * Everything here is dependency-free Node ESM: the file works in place in the
 * repository templates and inside the generated `harness/pstack/dsh/` tree.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Cordis plugin name; the bundle patch inserts a row under the same id. */
export const name = "dsh-pstack";

/** The skill registry this plugin contributes to. */
export const inject = ["skills"];

/** Package root: the directory holding `package.json`, `skills/`, and `agents/`. */
const PACKAGE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Default skill root: `skills/` next to this package. */
export const defaultSkillsDir = join(PACKAGE_DIR, "skills");

/** Default agent-brief root: `agents/` next to this package. Not registered as skills. */
export const defaultAgentsDir = join(PACKAGE_DIR, "agents");

/** The harness skill-name contract: lowercase, digits, single hyphens. */
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Frontmatter keys that only Cursor understands. They are parsed but never
 * forwarded to `ctx.skills.register`: DSH has no equivalent field for them.
 */
export const CURSOR_ONLY_KEYS = Object.freeze([
  "icon",
  "color",
  "paths",
  "license",
  "is_background",
]);

/**
 * Parse one frontmatter scalar: double- or single-quoted YAML strings are
 * unquoted (including backslash escapes in double quotes); plain strings are
 * returned trimmed.
 * @param raw - the scalar text after `key:`.
 * @returns the unquoted value.
 */
function parseScalar(raw) {
  const value = raw.trim();
  if (value.length > 1 && value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.length > 1 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  return value;
}

/**
 * Split a `---` fenced frontmatter block off a `SKILL.md`.
 *
 * The parser covers the YAML shape pstack writes: top-level `key: value`
 * pairs, quoted scalars, and `>`/`|` block scalars. It does not parse nested
 * maps or sequences; a key whose value is a flow array (such as Cursor's
 * `paths`) is kept as literal text, because nothing downstream reads it.
 *
 * @param raw - file contents.
 * @returns {{data: Record<string, string>, body: string}}
 * @throws {Error} when the frontmatter fence is missing or unterminated.
 */
export function parseSkillDocument(raw) {
  const normalized = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) throw new Error("missing YAML frontmatter");
  const end = normalized.indexOf("\n---", 3);
  if (end === -1) throw new Error("unterminated YAML frontmatter");
  const lines = normalized.slice(4, end).split("\n");
  const data = {};
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    if (key === "") continue;
    const rawValue = line.slice(separator + 1).trim();
    const block = /^([>|])([+-]?)$/.exec(rawValue);
    if (block !== null) {
      // A `>` folded or `|` literal block scalar: consume the indented lines
      // that follow, however many there are.
      const style = block[1];
      const chomp = block[2];
      const collected = [];
      let next = index + 1;
      for (; next < lines.length; next += 1) {
        const continuation = lines[next];
        if (continuation.trim() === "") {
          collected.push("");
          continue;
        }
        if (!/^\s/.test(continuation)) break;
        collected.push(continuation.replace(/^\s+/, ""));
      }
      index = next - 1;
      while (collected.length > 0 && collected[collected.length - 1] === "") collected.pop();
      let value;
      if (style === ">") {
        // Folded: single newlines become spaces, blank lines become newlines.
        value = "";
        for (const part of collected) {
          if (part === "") value += "\n";
          else if (value === "" || value.endsWith("\n")) value += part;
          else value += ` ${part}`;
        }
      } else {
        value = collected.join("\n");
      }
      data[key] = chomp === "-" ? value : `${value}\n`;
      continue;
    }
    data[key] = parseScalar(rawValue);
  }
  const body = normalized.slice(end + 4).replace(/^\n+/, "");
  return { data, body };
}

/**
 * Load every `<skillsDir>/<skill>/SKILL.md` as a skill definition.
 *
 * Throws on a malformed catalog: a missing or unterminated frontmatter fence,
 * a missing name or description, a name that is not kebab-case or does not
 * match its folder, an empty body, or a body that still carries frontmatter.
 * A missing skills root is not malformed; it simply yields no skills.
 *
 * @param {string} [skillsDir] - root holding one directory per skill.
 * @returns {Array<{
 *   name: string,
 *   description: string,
 *   whenToUse?: string,
 *   content: string,
 *   path: string,
 *   invocation: {modelInvocable: boolean, userInvocable: boolean},
 * }>}
 */
export function loadSkills(skillsDir = defaultSkillsDir) {
  const root = resolve(skillsDir);
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  const skills = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const path = join(root, entry.name, "SKILL.md");
    try {
      if (!statSync(path).isFile()) continue;
    } catch {
      continue;
    }
    const { data, body } = parseSkillDocument(readFileSync(path, "utf8"));
    if (data.name === undefined) throw new Error(`${path}: frontmatter requires a name`);
    if (data.description === undefined) throw new Error(`${path}: frontmatter requires a description`);
    if (!SKILL_NAME.test(data.name)) throw new Error(`${path}: invalid skill name "${data.name}"`);
    if (data.name !== entry.name) {
      throw new Error(`${path}: skill name "${data.name}" does not match its folder "${entry.name}"`);
    }
    if (body.trim() === "") throw new Error(`${path}: skill body is empty`);
    skills.push({
      name: data.name,
      description: data.description,
      ...(data.whenToUse === undefined ? {} : { whenToUse: data.whenToUse }),
      content: body.trim(),
      path,
      invocation: {
        modelInvocable: data["disable-model-invocation"] !== "true",
        userInvocable: data["user-invocable"] !== "false",
      },
    });
  }
  return skills.sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * Mount the bundle: register each bundled skill on the skill registry.
 *
 * `agents/` is deliberately not read. A DSH subagent is called with a prompt,
 * so `agents/<name>.md` is a brief the calling skill pastes in; there is no
 * subagent registry to contribute to.
 *
 * @param {import("@deepseek-ai/cordis").Context} ctx - plugin context.
 * @param {{skillsDir?: string}} [config] - optional `skillsDir` override.
 */
export function apply(ctx, config = {}) {
  const skillsDir = config.skillsDir ?? defaultSkillsDir;
  const skills = loadSkills(skillsDir);
  if (skills.length === 0) {
    ctx.logger?.warn?.(`${name}: no skills found under ${skillsDir}`);
    return;
  }
  for (const skill of skills) {
    ctx.skills.register({
      name: skill.name,
      description: skill.description,
      // Required by SkillRegistration: the registry copies it onto the
      // candidate verbatim, so an embedded skill must label its own source.
      source: "runtime",
      // Omitting invocation would default both surfaces on; pstack's
      // `disable-model-invocation: true` skills are user-invoked on purpose.
      invocation: skill.invocation,
      content: skill.content,
      path: skill.path,
      resourceBase: { kind: "directory", path: dirname(skill.path) },
      ...(skill.whenToUse === undefined ? {} : { whenToUse: skill.whenToUse }),
    });
    ctx.logger?.debug?.(`${name}: registered skill "${skill.name}" from ${skill.path}`);
  }
}
