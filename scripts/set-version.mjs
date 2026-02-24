#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = resolve(fileURLToPath(new URL("..", import.meta.url)));
const ROOT_PACKAGE_JSON = resolve(ROOT_DIR, "package.json");
const CORE_PACKAGE_JSON = resolve(ROOT_DIR, "packages/core/package.json");
const CLI_PACKAGE_JSON = resolve(ROOT_DIR, "packages/cli/package.json");
const CORE_NAME = "@angel-vlqz/reportflow-core";

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/;
const BUMP_KINDS = new Set(["patch", "minor", "major"]);

function isSemver(value) {
  return SEMVER_RE.test(value);
}

function bumpVersion(version, kind) {
  const match = version.match(SEMVER_RE);
  if (!match) {
    throw new Error(`Version actual invalida: ${version}`);
  }

  let major = Number(match[1]);
  let minor = Number(match[2]);
  let patch = Number(match[3]);

  if (kind === "patch") {
    patch += 1;
  } else if (kind === "minor") {
    minor += 1;
    patch = 0;
  } else if (kind === "major") {
    major += 1;
    minor = 0;
    patch = 0;
  }

  return `${major}.${minor}.${patch}`;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function usage() {
  console.log("Uso:");
  console.log("  pnpm version:set -- 0.1.2");
  console.log("  pnpm version:set --version=0.1.2");
  console.log("  pnpm version:patch | pnpm version:minor | pnpm version:major");
}

async function main() {
  const rootPkg = await readJson(ROOT_PACKAGE_JSON);
  const input = process.argv[2] ?? process.env.npm_config_version;

  if (!input) {
    usage();
    process.exit(1);
  }

  const nextVersion = BUMP_KINDS.has(input) ? bumpVersion(rootPkg.version, input) : input;

  if (!isSemver(nextVersion)) {
    console.error(`Version invalida: ${nextVersion}`);
    usage();
    process.exit(1);
  }

  const corePkg = await readJson(CORE_PACKAGE_JSON);
  const cliPkg = await readJson(CLI_PACKAGE_JSON);

  rootPkg.version = nextVersion;
  corePkg.version = nextVersion;
  cliPkg.version = nextVersion;

  if (cliPkg.dependencies?.[CORE_NAME]) {
    cliPkg.dependencies[CORE_NAME] = `^${nextVersion}`;
  }

  await Promise.all([
    writeJson(ROOT_PACKAGE_JSON, rootPkg),
    writeJson(CORE_PACKAGE_JSON, corePkg),
    writeJson(CLI_PACKAGE_JSON, cliPkg)
  ]);

  console.log(`Version actualizada a ${nextVersion}`);
  console.log("Siguiente paso: pnpm install");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
