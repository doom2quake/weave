import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(projectRoot, relativePath), "utf8");

test("static shell contains the goal, examples, canvas, summary, activity, artifacts, and confirmation surfaces", async () => {
  const html = await read("index.html");
  for (const marker of [
    "data-goal-form",
    "data-build-sample",
    "data-judge-prompt",
    "data-board-stage",
    "data-card-layer",
    "data-link-layer",
    "data-group-layer",
    "data-timeline-layer",
    "data-summary-content",
    "data-activity-feed",
    "data-artifact-list",
    "data-clear-dialog",
  ]) assert.match(html, new RegExp(marker), `missing ${marker}`);
  assert.equal((html.match(/data-example=/g) ?? []).length, 3);
  assert.equal((html.match(/data-layout=/g) ?? []).length, 3);
});

test("runtime loader selects checked-in file compatibility or hosted ES modules", async () => {
  const html = await read("index.html");
  const fileRuntime = await read("src/file-runtime.js");

  assert.match(html, /location\.protocol === "file:"/);
  assert.match(html, /runtime\.src = "\.\/src\/file-runtime\.js"/);
  assert.match(html, /runtime\.type = "module"/);
  assert.match(html, /runtime\.src = "\.\/src\/main\.js"/);
  assert.doesNotMatch(fileRuntime, /^\s*(?:import|export)\s/m);
  assert.match(fileRuntime, /class WebMCPSubstrate/);
  assert.match(fileRuntime, /class WeaveUI/);
});

test("page has no remote runtime dependency or network API", async () => {
  const sources = (await Promise.all([
    "index.html",
    "styles.css",
    "src/main.js",
    "src/app/board.js",
    "src/app/tools.js",
    "src/sim/sample-plan.js",
    "src/ui/controller.js",
  ].map(read))).join("\n");

  assert.doesNotMatch(sources, /(?:src|href)=['"]https?:\/\//i);
  assert.doesNotMatch(sources, /url\(['"]?https?:\/\//i);
  assert.doesNotMatch(sources, /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/);
});

test("judge-facing copy avoids em dashes and authorship tells", async () => {
  const copy = (await Promise.all([
    "index.html",
    "README.md",
    "DEMO.md",
    "docs/LIMITATIONS.md",
  ].map(read))).join("\n");
  for (const pattern of [/—/, /\bautonom(?:ous|y)\b/i, /\bAI engine\b/i, /\bLLM\b/i, /\bdelve\b/i, /\bseamless\b/i, /\bleverage\b/i]) {
    assert.doesNotMatch(copy, pattern);
  }
  assert.match(copy, /doom2quake collective/i);
});

test("the wrapper uses the current imperative registration lifecycle", async () => {
  const substrate = await read("src/webmcp/substrate.js");
  assert.match(substrate, /registerTool\(descriptor, \{ signal: controller\.signal \}\)/);
  assert.match(substrate, /annotations:/);
  assert.match(substrate, /readOnlyHint/);
});

test("static host manifests publish the same directory without a build command", async () => {
  const netlify = await read("netlify.toml");
  const vercel = JSON.parse(await read("vercel.json"));
  const packageJson = JSON.parse(await read("package.json"));

  assert.match(netlify, /publish = "\."/);
  assert.equal(vercel.cleanUrls, false);
  assert.equal(packageJson.scripts.test, "node --test");
  assert.ok(!Object.hasOwn(packageJson, "dependencies"));
  assert.ok(!Object.hasOwn(packageJson.scripts, "build"));
});
