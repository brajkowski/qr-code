// tsc leaves `./x.ts` specifiers in emitted declarations (rewriteRelativeImportExtensions
// only applies to JS output). Consumers need `./x.js`, so rewrite them in dist/*.d.ts.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2] ?? "dist";
for (const name of readdirSync(dir)) {
  if (!name.endsWith(".d.ts")) continue;
  const file = join(dir, name);
  const before = readFileSync(file, "utf8");
  const after = before.replace(/(from\s+["']\.{1,2}\/[^"']*?)\.ts(["'])/g, "$1.js$2");
  if (after !== before) writeFileSync(file, after);
}
