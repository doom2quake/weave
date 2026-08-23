import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moduleOrder = [
  "src/app/board.js",
  "src/webmcp/event-bus.js",
  "src/webmcp/schema.js",
  "src/webmcp/polyfill.js",
  "src/webmcp/human-gate.js",
  "src/webmcp/provenance.js",
  "src/webmcp/substrate.js",
  "src/app/tools.js",
  "src/sim/sample-plan.js",
  "src/ui/controller.js",
  "src/main.js",
];

const output = [
  "/* Generated from the ES-module source for direct file:// use. Do not edit by hand. */",
  "(() => {",
  '  "use strict";',
  "  const __modules = Object.create(null);",
];

for (const modulePath of moduleOrder) {
  const absolutePath = path.join(projectRoot, modulePath);
  const original = await readFile(absolutePath, "utf8");
  const exported = [];
  let transformed = original.replace(
    /import\s*\{([\s\S]*?)\}\s*from\s*["']([^"']+)["'];/g,
    (_match, names, specifier) => {
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(modulePath), specifier));
      const bindings = names
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean)
        .map((name) => {
          const [imported, local] = name.split(/\s+as\s+/);
          return local ? `${imported}: ${local}` : imported;
        })
        .join(", ");
      return `const { ${bindings} } = __modules[${JSON.stringify(resolved)}];`;
    },
  );

  transformed = transformed.replace(
    /export\s+((?:async\s+)?(?:class|function|const|let|var))\s+([A-Za-z_$][\w$]*)/g,
    (_match, declaration, name) => {
      exported.push(name);
      return `${declaration} ${name}`;
    },
  );

  output.push(`  __modules[${JSON.stringify(modulePath)}] = (() => {`);
  output.push(indent(transformed.trimEnd(), 4));
  output.push(`    return Object.freeze({ ${[...new Set(exported)].join(", ")} });`);
  output.push("  })();");
}

output.push("})();", "");
await writeFile(path.join(projectRoot, "src/file-runtime.js"), output.join("\n"), "utf8");

function indent(value, spaces) {
  const prefix = " ".repeat(spaces);
  return value.split("\n").map((line) => line ? `${prefix}${line}` : "").join("\n");
}
