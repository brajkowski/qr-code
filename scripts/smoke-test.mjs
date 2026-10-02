// Pack smoke test: installs a built tarball into a throwaway project and exercises
// both the library entry point and the `qr-code` bin (installed as a symlink).
// Usage: node scripts/smoke-test.mjs <path-to-tarball>
//        node scripts/smoke-test.mjs --pack   (runs `npm pack` in a temp dir first)
// Plain ESM, no dependencies, so it runs on every supported Node line without `yarn install`.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

let tarballArg = process.argv[2];
if (!tarballArg) {
  console.error("usage: node scripts/smoke-test.mjs <tarball | --pack>");
  process.exit(2);
}
if (tarballArg === "--pack") {
  const packDir = mkdtempSync(join(tmpdir(), "qr-pack-"));
  execFileSync("npm", ["pack", "--pack-destination", packDir], { stdio: "inherit" });
  tarballArg = join(packDir, readdirSync(packDir).find((f) => f.endsWith(".tgz")));
}
const tarball = resolve(tarballArg);
const PKG = "@brajkowski/qr-code";

// 1. The tarball contains exactly the intended files.
const listed = execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" })
  .split("\n")
  .filter((l) => l && !l.endsWith("/"))
  .map((l) => l.replace(/^package\//, ""));
const required = ["package.json", "README.md", "LICENSE", "NOTICE.md", "dist/index.js", "dist/cli.js", "dist/index.d.ts"];
for (const f of required) assert.ok(listed.includes(f), `tarball is missing ${f}`);
const allowed = (f) => required.includes(f) || (/^dist\/[a-z]+\.d\.ts$/.test(f) && f !== "dist/cli.d.ts");
const unexpected = listed.filter((f) => !allowed(f));
assert.deepEqual(unexpected, [], `tarball contains unexpected files: ${unexpected.join(", ")}`);
console.log(`ok  tarball file list (${listed.length} files)`);

const dir = mkdtempSync(join(tmpdir(), "qr-smoke-"));
try {
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "smoke", private: true, type: "module" }));
  execFileSync("npm", ["install", tarball, "--no-audit", "--no-fund", "--ignore-scripts=false"], {
    cwd: dir,
    stdio: "inherit",
  });

  // 2. No runtime deps and no install-time scripts leak into the published manifest.
  const manifest = JSON.parse(readFileSync(join(dir, "node_modules", ...PKG.split("/"), "package.json"), "utf8"));
  for (const key of ["dependencies", "peerDependencies", "optionalDependencies"]) {
    assert.ok(!manifest[key] || Object.keys(manifest[key]).length === 0, `${key} must be empty`);
  }
  for (const hook of ["preinstall", "install", "postinstall", "prepare"]) {
    assert.equal(manifest.scripts?.[hook], undefined, `published package.json must not define ${hook}`);
  }
  console.log("ok  manifest has no dependencies or install-time scripts");

  // 3. Library usage, mirroring the README snippet.
  writeFileSync(
    join(dir, "check.mjs"),
    `
import { generate, renderPng, renderSvg } from ${JSON.stringify(PKG)};
const qr = generate("https://example.com", "M");
const png = renderPng(qr.modules, { size: 512, quietZone: 4 });
const sig = [...png.data.subarray(0, 8)].join(",");
if (sig !== "137,80,78,71,13,10,26,10") throw new Error("bad PNG signature: " + sig);
const svg = renderSvg(qr.modules, { size: 512, quietZone: 4 });
if (!svg.startsWith("<?xml")) throw new Error("SVG does not start with <?xml");
console.log("library ok", qr.version, png.pixels);
`,
  );
  const lib = execFileSync(process.execPath, ["check.mjs"], { cwd: dir, encoding: "utf8" });
  assert.match(lib, /library ok/);
  console.log("ok  library entry point");

  // 4. The bin, via the symlink npm creates in node_modules/.bin.
  const out = join(dir, "out");
  const stdout = execFileSync(join(dir, "node_modules", ".bin", "qr-code"), ["https://example.com", "--json", "--output", out], {
    cwd: dir,
    encoding: "utf8",
  });
  const summary = JSON.parse(stdout);
  assert.ok(summary && typeof summary === "object", "CLI --json output is an object");
  assert.ok(existsSync(`${out}.png`), "PNG was written");
  assert.ok(existsSync(`${out}.svg`), "SVG was written");
  console.log("ok  qr-code bin");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
