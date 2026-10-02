import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

test("the CLI runs when invoked through a symlink, as npm bins are installed", () => {
  const dir = mkdtempSync(join(tmpdir(), "qr-bin-"));
  try {
    const link = join(dir, "qr-code");
    symlinkSync(resolve("src/cli.ts"), link);
    const stdout = execFileSync(process.execPath, [link, "--help"], { encoding: "utf8" });
    assert.match(stdout, /usage:/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
