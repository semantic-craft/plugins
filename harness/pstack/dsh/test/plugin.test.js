import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  apply,
  defaultAgentsDir,
  defaultSkillsDir,
  inject,
  loadSkills,
  name,
  parseSkillDocument,
} from "../src/plugin.js";

/** This test file lives in `<package>/test/`, in the template or the generated tree. */
const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR = resolve(HERE, "..");

/**
 * The real pstack skills, whichever copy this test runs against:
 * `../skills` is the generated `harness/pstack/dsh/` tree, and
 * `../../../pstack/skills` is the repository source this template is written in.
 */
const SKILLS_DIR = [
  join(HERE, "..", "skills"),
  join(HERE, "..", "..", "..", "pstack", "skills"),
].find((candidate) => existsSync(join(candidate, "setup-pstack", "SKILL.md")));
if (SKILLS_DIR === undefined) {
  throw new Error(`no pstack skills found next to ${HERE} (looked for ../skills and ../../../pstack/skills)`);
}

/** The generated tree carries the bundle manifest; the template source does not. */
const GENERATED = (() => {
  const manifest = join(SKILLS_DIR, "..", "package.json");
  if (!existsSync(manifest)) return undefined;
  try {
    const pkg = JSON.parse(readFileSync(manifest, "utf8"));
    return pkg.name === "dsh-pstack-plugin" ? pkg : undefined;
  } catch {
    return undefined;
  }
})();

/** The adapter line the generator inserts after the H1 of wrapped skills. */
const ADAPTER_LINK = /\[the DSH adapter\]\(\.\.\/\.\.\/docs\/harness\/dsh\.md\)/;

/** Skill folders in the resolved skills root. */
function skillFolders() {
  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(SKILLS_DIR, entry.name, "SKILL.md")))
    .map((entry) => entry.name)
    .sort();
}

/** Minimal stand-in for the Cordis context the plugin is mounted with. */
function stubContext() {
  const registered = [];
  const warnings = [];
  const debug = [];
  return {
    registered,
    warnings,
    debug,
    skills: {
      register(skill) {
        registered.push(skill);
        return () => {};
      },
    },
    logger: {
      warn: (message) => warnings.push(message),
      debug: (message) => debug.push(message),
    },
  };
}

test("plugin declares its name and the skill registry it contributes to", () => {
  assert.equal(name, "dsh-pstack");
  assert.deepEqual(inject, ["skills"]);
  assert.ok(isAbsolute(defaultSkillsDir));
  assert.equal(defaultSkillsDir, join(PACKAGE_DIR, "skills"));
  assert.equal(defaultAgentsDir, join(PACKAGE_DIR, "agents"));
});

test("package.json declares the bundle patch and an engines.dsh range", () => {
  const manifest = join(PACKAGE_DIR, "package.json");
  if (!existsSync(manifest)) return; // not a package checkout
  const pkg = JSON.parse(readFileSync(manifest, "utf8"));
  assert.equal(pkg.name, "dsh-pstack-plugin");
  assert.equal(pkg.type, "module");
  assert.equal(pkg.dsh.bundle.patch, "./cordis.patch.yml");
  assert.equal(pkg.engines.dsh, ">=0.2.1-rc.2 <0.3.0");
  assert.ok(existsSync(join(PACKAGE_DIR, "cordis.patch.yml")));
  assert.ok(
    pkg.version === "__VERSION__" || /^\d+\.\d+\.\d+(?:[-+].+)?$/.test(pkg.version),
    `version must be substituted by the generator, got ${JSON.stringify(pkg.version)}`,
  );
});

test("loadSkills loads all 54 pstack skills, named after their folders", () => {
  const folders = skillFolders();
  assert.equal(folders.length, 54);
  const skills = loadSkills(SKILLS_DIR);
  assert.equal(skills.length, 54);
  assert.deepEqual(
    skills.map((skill) => skill.name),
    folders,
    "each skill name must match its folder and the catalog must be sorted",
  );
  for (const skill of skills) {
    assert.ok(skill.description.length > 10, `${skill.name} needs a real description`);
    assert.ok(skill.content.length > 20, `${skill.name} body looks truncated`);
    assert.ok(!skill.content.startsWith("---"), `${skill.name} body must not repeat frontmatter`);
    assert.ok(isAbsolute(skill.path), `${skill.name} path must be absolute`);
    assert.equal(skill.path, join(SKILLS_DIR, skill.name, "SKILL.md"));
  }
});

test("53 skills are user-invocable only; setup-pstack is also model-invocable", () => {
  const skills = loadSkills(SKILLS_DIR);
  const userOnly = skills.filter(
    (skill) => skill.invocation.userInvocable && !skill.invocation.modelInvocable,
  );
  const both = skills.filter(
    (skill) => skill.invocation.userInvocable && skill.invocation.modelInvocable,
  );
  assert.equal(userOnly.length, 53);
  assert.deepEqual(
    both.map((skill) => skill.name),
    ["setup-pstack"],
  );
  assert.equal(
    skills.filter((skill) => !skill.invocation.userInvocable).length,
    0,
    "every pstack skill is user-invocable",
  );
});

test("apply registers all 54 skills as runtime skills with a directory resource base", () => {
  const ctx = stubContext();
  apply(ctx, { skillsDir: SKILLS_DIR });
  assert.equal(ctx.registered.length, 54);
  assert.deepEqual(ctx.warnings, []);
  assert.equal(ctx.debug.length, 54);
  for (const skill of ctx.registered) {
    assert.equal(skill.source, "runtime", `${skill.name} needs an explicit runtime source`);
    assert.ok(isAbsolute(skill.path), `${skill.name} path must be absolute`);
    assert.equal(skill.path, join(SKILLS_DIR, skill.name, "SKILL.md"));
    assert.equal(skill.resourceBase.kind, "directory");
    assert.equal(skill.resourceBase.path, dirname(skill.path));
    assert.ok(typeof skill.content === "string" && skill.content.length > 20);
    assert.ok(typeof skill.description === "string" && skill.description.length > 10);
    assert.deepEqual(
      { ...skill.invocation },
      { ...loadSkills(SKILLS_DIR).find((loaded) => loaded.name === skill.name).invocation },
    );
    // Cursor-only frontmatter is parsed but never forwarded to the registry.
    for (const key of ["icon", "color", "paths", "license", "is_background"]) {
      assert.ok(!(key in skill), `${skill.name} must not forward Cursor-only key "${key}"`);
    }
  }
});

test("the generated tree carries the DSH adapter line in wrapped skills", () => {
  const ctx = stubContext();
  apply(ctx, { skillsDir: SKILLS_DIR });
  const wrapped = ctx.registered.filter((skill) => ADAPTER_LINK.test(skill.content));
  if (GENERATED === undefined) {
    // Template location: the generator adds the line when it builds the tree.
    assert.equal(wrapped.length, 0, "the pstack source has no harness adapter line");
    return;
  }
  assert.ok(wrapped.length > 0, "expected the generator to insert the DSH adapter line");
  const setup = ctx.registered.find((skill) => skill.name === "setup-pstack");
  assert.ok(setup !== undefined);
  assert.match(setup.content, ADAPTER_LINK, "setup-pstack is a wrapped skill in the generated tree");
});

test("the default skills dir mounts the package's own skills where the tree exists", () => {
  const ctx = stubContext();
  if (GENERATED === undefined) {
    // Template location: the package has no skills/ directory until generated.
    assert.equal(existsSync(defaultSkillsDir), false);
    apply(ctx);
    assert.deepEqual(ctx.registered, []);
    assert.equal(ctx.warnings.length, 1);
    assert.match(ctx.warnings[0], /no skills found/);
    return;
  }
  apply(ctx);
  assert.equal(ctx.registered.length, 54);
  assert.deepEqual(ctx.warnings, []);
});

test("a missing skills root warns instead of throwing, and registers nothing", () => {
  const ctx = stubContext();
  apply(ctx, { skillsDir: "/nonexistent/dsh-pstack/skills" });
  assert.deepEqual(ctx.registered, []);
  assert.equal(ctx.warnings.length, 1);
  assert.match(ctx.warnings[0], /no skills found/);
});

test("loadSkills tolerates an absent root", () => {
  assert.deepEqual(loadSkills("/nonexistent/dsh-pstack/skills"), []);
});

test("parseSkillDocument splits fenced frontmatter from the body", () => {
  const { data, body } = parseSkillDocument(
    "---\nname: demo\ndescription: A demo skill\n---\n\n# Demo\n",
  );
  assert.equal(data.name, "demo");
  assert.equal(data.description, "A demo skill");
  assert.equal(body, "# Demo\n");
});

test("parseSkillDocument unquotes quoted values, including escaped quotes", () => {
  const { data } = parseSkillDocument(
    '---\nname: demo\ndescription: "Use for \\"demo\\" work"\nother: \'It\'\'s fine\'\n---\n# Demo\n',
  );
  assert.equal(data.description, 'Use for "demo" work');
  assert.equal(data.other, "It's fine");
});

test("parseSkillDocument folds block scalars", () => {
  const { data } = parseSkillDocument(
    "---\nname: demo\ndescription: >-\n  one line\n  two lines\n  three\n---\n# Demo\n",
  );
  assert.equal(data.description, "one line two lines three");
});

test("parseSkillDocument rejects a document without frontmatter", () => {
  assert.throws(() => parseSkillDocument("# No frontmatter\n"), /frontmatter/);
});

test("parseSkillDocument rejects unterminated frontmatter", () => {
  assert.throws(() => parseSkillDocument("---\nname: demo\n"), /unterminated/);
});
