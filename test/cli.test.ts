import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { run, tokenizeShellArgs } from "../src/cli.ts";

function inDir<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "qr-cli-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("--help exits 0 and writes usage to stdout", () => {
  const r = run(["--help"], {}, "/tmp");
  assert.equal(r.code, 0);
  assert.match(r.stdout, /usage:/);
});

test("no arguments is a usage error", () => {
  const r = run([], {}, "/tmp");
  assert.equal(r.code, 2);
  assert.match(r.stderr, /no text to encode/);
});

test("unknown flag is a usage error", () => {
  assert.equal(run(["hi", "--bogus"], {}, "/tmp").code, 2);
});

test("--url and --text behave like --data", () => {
  const viaData = run(["--data", "hello"], {}, "/tmp");
  const viaUrl = run(["--url", "hello"], {}, "/tmp");
  const viaText = run(["--text", "hello"], {}, "/tmp");
  assert.equal(viaUrl.code, 0);
  assert.equal(viaText.code, 0);
  assert.deepEqual(viaUrl, viaData);
  assert.deepEqual(viaText, viaData);
});

test("--url or --text combined with a positional argument is rejected, same as --data", () => {
  const viaData = run(["--data", "hello", "world"], {}, "/tmp");
  const viaUrl = run(["--url", "hello", "world"], {}, "/tmp");
  const viaText = run(["--text", "hello", "world"], {}, "/tmp");
  assert.equal(viaData.code, 2);
  assert.match(viaData.stderr, /pass the text once/);
  assert.deepEqual(viaUrl, viaData);
  assert.deepEqual(viaText, viaData);
});

test("--format hints that the flag is --type", () => {
  const r = run(["hi", "--format", "svg"], {}, "/tmp");
  assert.equal(r.code, 2);
  assert.match(r.stderr, /unknown option "--format" — did you mean --type\?/);
});

test("multiple positional arguments are rejected with a hint to quote", () => {
  const r = run(["hello", "world"], {}, "/tmp");
  assert.equal(r.code, 2);
  assert.match(r.stderr, /quote/);
});

test("invalid --size and --ecc are usage errors", () => {
  assert.equal(run(["hi", "--size", "0"], {}, "/tmp").code, 2);
  assert.equal(run(["hi", "--size", "12.5"], {}, "/tmp").code, 2);
  assert.equal(run(["hi", "--ecc", "Z"], {}, "/tmp").code, 2);
});

test("default: writes both a PNG and an SVG to <basename>.*", () => {
  inDir((dir) => {
    const r = run(["https://example.com"], {}, dir);
    assert.equal(r.code, 0);
    const files = JSON.parse(run(["https://example.com", "--json"], {}, dir).stdout).files;
    assert.deepEqual(
      files.map((f: { type: string }) => f.type).sort(),
      ["png", "svg"],
    );
    assert.ok(readFileSync(join(dir, "qrcode.png")).length > 0);
    assert.ok(readFileSync(join(dir, "qrcode.svg"), "utf8").startsWith("<?xml"));
  });
});

test("--type svg writes only an SVG", () => {
  inDir((dir) => {
    const r = run(["hi", "--type", "svg", "--json"], {}, dir);
    const files = JSON.parse(r.stdout).files;
    assert.equal(files.length, 1);
    assert.equal(files[0].type, "svg");
  });
});

test("--output with no --type is a stem for both formats", () => {
  inDir((dir) => {
    const r = run(["hi", "--output", join(dir, "sub", "code"), "--json"], {}, dir);
    assert.equal(r.code, 0);
    const paths = JSON.parse(r.stdout).files.map((f: { path: string }) => f.path).sort();
    assert.deepEqual(paths, [join(dir, "sub", "code.png"), join(dir, "sub", "code.svg")]);
  });
});

test("--output ending in .png infers --type png", () => {
  inDir((dir) => {
    const r = run(["hi", "--output", join(dir, "only.png"), "--json"], {}, dir);
    const files = JSON.parse(r.stdout).files;
    assert.equal(files.length, 1);
    assert.equal(files[0].path, join(dir, "only.png"));
  });
});

test("--output naming an existing directory writes the default basename inside it", () => {
  inDir((dir) => {
    const target = join(dir, "tickets");
    mkdirSync(target);
    const r = run(["hi", "--output", target, "--json"], {}, dir);
    assert.equal(r.code, 0);
    const paths = JSON.parse(r.stdout).files.map((f: { path: string }) => f.path).sort();
    assert.deepEqual(paths, [join(target, "qrcode.png"), join(target, "qrcode.svg")]);
  });
});

test("--output with a trailing slash is treated as a directory even if it does not exist yet", () => {
  inDir((dir) => {
    const r = run(["hi", "--type", "svg", "--output", join(dir, "new-dir") + "/", "--json"], {}, dir);
    assert.equal(r.code, 0);
    const files = JSON.parse(r.stdout).files;
    assert.equal(files[0].path, join(dir, "new-dir", "qrcode.svg"));
  });
});

test("--output extension conflicting with --type is an error", () => {
  inDir((dir) => {
    const r = run(["hi", "--type", "svg", "--output", join(dir, "x.png")], {}, dir);
    assert.equal(r.code, 2);
  });
});

test("precedence: --size beats QR_PNG_SIZE beats the default", () => {
  inDir((dir) => {
    const flag = JSON.parse(run(["hi", "--type", "png", "--size", "410", "--json"], { QR_PNG_SIZE: "800" }, dir).stdout);
    assert.ok(flag.files[0].width <= 410 && flag.files[0].width > 410 - flag.modules);

    const env = JSON.parse(run(["hi", "--type", "png", "--json"], { QR_PNG_SIZE: "300" }, dir).stdout);
    assert.ok(env.files[0].width <= 300);
  });
});

test("QR_ECC changes the symbol; --ecc overrides it", () => {
  inDir((dir) => {
    const envEcc = JSON.parse(run(["hi", "--type", "svg", "--json"], { QR_ECC: "H" }, dir).stdout);
    assert.equal(envEcc.ecc, "H");
    const flagEcc = JSON.parse(run(["hi", "--type", "svg", "--ecc", "L", "--json"], { QR_ECC: "H" }, dir).stdout);
    assert.equal(flagEcc.ecc, "L");
  });
});

test("an oversized payload exits 1 with a capacity message", () => {
  inDir((dir) => {
    const r = run(["z".repeat(4000), "--ecc", "H"], {}, dir);
    assert.equal(r.code, 1);
    assert.match(r.stderr, /cannot hold it|shorten/);
  });
});

test("a bad QR_PNG_SIZE is warned about, not fatal", () => {
  inDir((dir) => {
    const r = run(["hi", "--type", "png"], { QR_PNG_SIZE: "huge" }, dir);
    assert.equal(r.code, 0);
    assert.match(r.stderr, /ignoring QR_PNG_SIZE/);
  });
});

test("a QR_QUIET_ZONE below the spec minimum is warned about, not fatal", () => {
  inDir((dir) => {
    const r = run(["hi", "--type", "svg"], { QR_QUIET_ZONE: "1" }, dir);
    assert.equal(r.code, 0);
    assert.match(r.stderr, /below the spec minimum/);
  });
});

test("--flag=value is accepted like --flag value", () => {
  inDir((dir) => {
    const r = run(["hi", "--type=svg", "--json"], {}, dir);
    assert.equal(r.code, 0);
    const files = JSON.parse(r.stdout).files;
    assert.equal(files.length, 1);
    assert.equal(files[0].type, "svg");
  });
});

test("--output=<path> is accepted", () => {
  inDir((dir) => {
    const r = run(["hi", "--type=svg", "--output=" + join(dir, "myqr.svg"), "--json"], {}, dir);
    assert.equal(r.code, 0);
    const files = JSON.parse(r.stdout).files;
    assert.equal(files[0].path, join(dir, "myqr.svg"));
  });
});

test("usage errors print a single line, not the full help text", () => {
  const r = run(["hi", "--bogus"], {}, "/tmp");
  assert.equal(r.code, 2);
  assert.equal(r.stderr.split("\n").filter(Boolean).length, 1);
  assert.doesNotMatch(r.stderr, /environment overrides/);
});

test("tokenizeShellArgs splits on whitespace", () => {
  assert.deepEqual(tokenizeShellArgs("hi --type svg"), ["hi", "--type", "svg"]);
  assert.deepEqual(tokenizeShellArgs("  hi   --type\tsvg\n"), ["hi", "--type", "svg"]);
});

test("tokenizeShellArgs treats shell metacharacters as inert text", () => {
  assert.deepEqual(tokenizeShellArgs("https://example.com/p?a=1&b=2"), [
    "https://example.com/p?a=1&b=2",
  ]);
  assert.deepEqual(tokenizeShellArgs("a; rm -rf / && echo hi | cat $HOME `whoami`"), [
    "a;",
    "rm",
    "-rf",
    "/",
    "&&",
    "echo",
    "hi",
    "|",
    "cat",
    "$HOME",
    "`whoami`",
  ]);
});

test("tokenizeShellArgs honors quotes for multi-word text", () => {
  assert.deepEqual(tokenizeShellArgs(`"wifi network password" --type svg`), [
    "wifi network password",
    "--type",
    "svg",
  ]);
  assert.deepEqual(tokenizeShellArgs(`'a & b' --ecc H`), ["a & b", "--ecc", "H"]);
});

test("tokenizeShellArgs joins adjacent quoted/unquoted segments into one token", () => {
  assert.deepEqual(tokenizeShellArgs(`--data=foo" bar"'baz'`), ["--data=foo barbaz"]);
});

test("--json=1 is rejected — --json takes no value", () => {
  const r = run(["hi", "--json=1"], {}, "/tmp");
  assert.equal(r.code, 2);
});

test("--help names the command qr-code and has no plugin build references", () => {
  const { stdout } = run(["--help"], {}, "/tmp");
  assert.ok(stdout.startsWith("qr-code —"), "first line starts with the command name");
  assert.match(stdout, /usage:\n\s+qr-code </);
  assert.doesNotMatch(stdout, /yarn build/);
  assert.doesNotMatch(stdout, /src\/config\.ts/);
});
