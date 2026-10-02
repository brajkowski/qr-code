/**
 * Command-line entry point for the QR generator, published as the `qr-code` bin.
 *
 * `--stdin-args` lets a caller pass untrusted text without any shell parsing:
 * arbitrary text can contain shell metacharacters (a URL with `?`/`&` is a glob
 * and a background job to a shell) or, if embedded inside shell quoting or
 * heredoc syntax, a byte sequence that terminates that quoting early and
 * injects commands. Instead the caller writes the text verbatim to a file (or
 * pipe) and redirects it to our stdin; `--stdin-args` reads that literal text
 * and tokenizes it ourselves, so it never passes through shell word-splitting,
 * globbing, or quote/heredoc parsing at all.
 */

import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_ECC_LEVEL,
  DEFAULT_OUTPUT_BASENAME,
  DEFAULT_PNG_SIZE,
  DEFAULT_SVG_SIZE,
  QUIET_ZONE_MODULES,
  type EccLevel,
} from "./config.ts";
import { generate, QrCapacityError } from "./index.ts";
import { renderPng } from "./png.ts";
import { renderSvg } from "./svg.ts";

type FileType = "png" | "svg";

export interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

class UsageError extends Error {}

const HELP = `qr-code — generate a QR code (PNG and/or SVG) from a URL or text string

usage:
  qr-code <url-or-text> [options]

options:
  --data <string>     Text to encode (alternative to the positional argument).
                      --url and --text are accepted as aliases.
  --type <png|svg>    Output format. Repeatable. Omit to write BOTH a PNG and an SVG.
  --size <px>         Output size in pixels.
                      PNG: a target — rounded down so every module is whole pixels;
                           the actual size is reported.
                      SVG: the rendered box exactly (the image still scales losslessly).
  --ecc <L|M|Q|H>     Error-correction level (default: ${DEFAULT_ECC_LEVEL}). Higher = more
                      damage tolerance, larger symbol.
  --output <path>     Where to write. With no --type this is a stem: "<path>.png" and
                      "<path>.svg" are both written. With one --type it is the filename;
                      a .png/.svg extension also implies --type when it is omitted. A
                      path ending in "/" or naming an existing directory writes the
                      default basename inside it instead of a stem.
                      Defaults to ./${DEFAULT_OUTPUT_BASENAME} in the current directory.
  --json             Print only a JSON summary of what was written.
  -h, --help         Show this help.

environment overrides (CLI flags win over these, which win over built-in defaults):
  QR_PNG_SIZE  QR_SVG_SIZE  QR_ECC  QR_QUIET_ZONE  QR_OUTPUT_BASENAME
`;

interface ParsedArgs {
  data?: string;
  positional: string[];
  types: FileType[];
  size?: number;
  ecc?: EccLevel;
  output?: string;
  json: boolean;
  help: boolean;
}

/**
 * Splits a raw command-line string into argv-style tokens, honoring single
 * quotes (literal), double quotes (backslash escapes `\"` and `\\`), and
 * backslash-escaping outside quotes. Adjacent quoted/unquoted segments with
 * no space between them join into a single token, matching POSIX shell word
 * splitting closely enough for our own flag syntax.
 */
export function tokenizeShellArgs(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let hasToken = false;
  let i = 0;

  const isSpace = (ch: string): boolean => ch === " " || ch === "\t" || ch === "\n" || ch === "\r";

  while (i < input.length) {
    const ch = input[i];

    if (isSpace(ch)) {
      if (hasToken) {
        tokens.push(current);
        current = "";
        hasToken = false;
      }
      i++;
      continue;
    }

    hasToken = true;

    if (ch === "'") {
      const end = input.indexOf("'", i + 1);
      const content = end === -1 ? input.slice(i + 1) : input.slice(i + 1, end);
      current += content;
      i = end === -1 ? input.length : end + 1;
      continue;
    }

    if (ch === '"') {
      i++;
      while (i < input.length && input[i] !== '"') {
        if (input[i] === "\\" && (input[i + 1] === '"' || input[i + 1] === "\\")) {
          current += input[i + 1];
          i += 2;
        } else {
          current += input[i];
          i++;
        }
      }
      i++;
      continue;
    }

    if (ch === "\\" && i + 1 < input.length) {
      current += input[i + 1];
      i += 2;
      continue;
    }

    current += ch;
    i++;
  }

  if (hasToken) tokens.push(current);
  return tokens;
}

/** Flags that take a value, and so accept the `--flag=value` form as well as `--flag value`. */
const VALUE_FLAGS = new Set(["--data", "--url", "--text", "--output", "--size", "--ecc", "--type"]);

/**
 * Unknown options that are common wrong guesses at this CLI's real flags,
 * mapped to a one-line hint for the error message. `--url`/`--text` are not
 * here because they're accepted aliases for `--data` (see `parseArgs`).
 */
const UNKNOWN_OPTION_HINTS: Record<string, string> = {
  "--format": "did you mean --type?",
  "--input": "did you mean --data, or the positional argument?",
  "--content": "did you mean --data, or the positional argument?",
};

/** Splits `--flag=value` into `["--flag", "value"]` for flags that take a value. */
function splitLongFlags(argv: string[]): string[] {
  const result: string[] = [];
  for (const arg of argv) {
    const eq = arg.indexOf("=");
    const flag = eq === -1 ? arg : arg.slice(0, eq);
    if (eq !== -1 && VALUE_FLAGS.has(flag)) {
      result.push(flag, arg.slice(eq + 1));
    } else {
      result.push(arg);
    }
  }
  return result;
}

function parseArgs(rawArgv: string[]): ParsedArgs {
  const argv = splitLongFlags(rawArgv);
  const parsed: ParsedArgs = { positional: [], types: [], json: false, help: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = (): string => {
      const v = argv[++i];
      if (v === undefined) throw new UsageError(`${arg} needs a value`);
      return v;
    };

    switch (arg) {
      case "-h":
      case "--help":
        parsed.help = true;
        break;
      case "--json":
        parsed.json = true;
        break;
      case "--data":
      case "--url":
      case "--text":
        parsed.data = next();
        break;
      case "--output":
        parsed.output = next();
        break;
      case "--size": {
        const raw = next();
        const size = Number(raw);
        if (!Number.isInteger(size) || size <= 0) {
          throw new UsageError(`--size must be a positive integer, got "${raw}"`);
        }
        parsed.size = size;
        break;
      }
      case "--ecc": {
        const level = next().toUpperCase();
        if (level !== "L" && level !== "M" && level !== "Q" && level !== "H") {
          throw new UsageError(`--ecc must be one of L, M, Q, H, got "${level}"`);
        }
        parsed.ecc = level;
        break;
      }
      case "--type": {
        const type = next().toLowerCase();
        if (type !== "png" && type !== "svg") {
          throw new UsageError(`--type must be "png" or "svg", got "${type}"`);
        }
        if (!parsed.types.includes(type)) parsed.types.push(type);
        break;
      }
      default:
        if (arg.startsWith("-")) {
          const hint = UNKNOWN_OPTION_HINTS[arg];
          throw new UsageError(hint ? `unknown option "${arg}" — ${hint}` : `unknown option "${arg}"`);
        }
        parsed.positional.push(arg);
    }
  }

  return parsed;
}

function envInt(env: NodeJS.ProcessEnv, key: string, warnings: string[]): number | undefined {
  const raw = env[key];
  if (raw === undefined || raw === "") return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    warnings.push(`ignoring ${key}="${raw}" (not a positive integer)`);
    return undefined;
  }
  return value;
}

function envEcc(env: NodeJS.ProcessEnv, warnings: string[]): EccLevel | undefined {
  const raw = env.QR_ECC;
  if (raw === undefined || raw === "") return undefined;
  const level = raw.toUpperCase();
  if (level !== "L" && level !== "M" && level !== "Q" && level !== "H") {
    warnings.push(`ignoring QR_ECC="${raw}" (not one of L, M, Q, H)`);
    return undefined;
  }
  return level;
}

function stripKnownExtension(path: string): { stem: string; type?: FileType } {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return { stem: path.slice(0, -4), type: "png" };
  if (lower.endsWith(".svg")) return { stem: path.slice(0, -4), type: "svg" };
  return { stem: path };
}

interface Target {
  type: FileType;
  path: string;
}

/** True if `output` is clearly meant as a directory: a trailing slash, or an existing directory on disk. */
function isDirectoryTarget(output: string, cwd: string): boolean {
  if (output.endsWith("/") || output.endsWith("\\")) return true;
  const abs = isAbsolute(output) ? output : resolve(cwd, output);
  try {
    return statSync(abs).isDirectory();
  } catch {
    return false;
  }
}

function resolveTargets(parsed: ParsedArgs, env: NodeJS.ProcessEnv, cwd: string): Target[] {
  const explicitTypes = parsed.types.length > 0;
  const basename = env.QR_OUTPUT_BASENAME || DEFAULT_OUTPUT_BASENAME;
  const abs = (p: string): string => (isAbsolute(p) ? p : resolve(cwd, p));

  if (parsed.output !== undefined && isDirectoryTarget(parsed.output, cwd)) {
    parsed = { ...parsed, output: join(parsed.output, basename) };
  }

  if (parsed.output !== undefined) {
    const { stem, type: extType } = stripKnownExtension(parsed.output);
    if (extType !== undefined) {
      if (explicitTypes && (parsed.types.length > 1 || parsed.types[0] !== extType)) {
        throw new UsageError(
          `--output "${parsed.output}" ends in .${extType} but --type says ` +
            `${parsed.types.join(", ")}`,
        );
      }
      return [{ type: extType, path: abs(parsed.output) }];
    }
    const types = explicitTypes ? parsed.types : (["png", "svg"] as FileType[]);
    return types.map((type) => ({ type, path: abs(`${stem}.${type}`) }));
  }

  const types = explicitTypes ? parsed.types : (["png", "svg"] as FileType[]);
  return types.map((type) => ({ type, path: abs(resolve(cwd, `${basename}.${type}`)) }));
}

export function run(argv: string[], env: NodeJS.ProcessEnv = process.env, cwd = process.cwd()): CliResult {
  let parsed: ParsedArgs;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    return { code: 2, stdout: "", stderr: `error: ${(err as Error).message} (run with --help for usage)\n` };
  }

  if (parsed.help) return { code: 0, stdout: HELP, stderr: "" };

  const warnings: string[] = [];

  const data = parsed.data ?? parsed.positional.join(" ");
  if (parsed.data !== undefined && parsed.positional.length > 0) {
    return { code: 2, stdout: "", stderr: `error: pass the text once — either --data (or --url/--text) or a positional argument, not both\n` };
  }
  if (parsed.positional.length > 1) {
    return {
      code: 2,
      stdout: "",
      stderr: `error: received ${parsed.positional.length} arguments; quote the text so it is a single argument\n`,
    };
  }
  if (data === "") {
    return { code: 2, stdout: "", stderr: `error: no text to encode (run with --help for usage)\n` };
  }

  const ecc = parsed.ecc ?? envEcc(env, warnings) ?? DEFAULT_ECC_LEVEL;
  let quietZone = envInt(env, "QR_QUIET_ZONE", warnings) ?? QUIET_ZONE_MODULES;
  if (quietZone < 4) {
    warnings.push(`QR_QUIET_ZONE=${quietZone} is below the spec minimum of 4 modules and may not scan reliably`);
  }
  const pngSize = parsed.size ?? envInt(env, "QR_PNG_SIZE", warnings) ?? DEFAULT_PNG_SIZE;
  const svgSize = parsed.size ?? envInt(env, "QR_SVG_SIZE", warnings) ?? DEFAULT_SVG_SIZE;

  let targets: Target[];
  try {
    targets = resolveTargets(parsed, env, cwd);
  } catch (err) {
    return { code: 2, stdout: "", stderr: `error: ${(err as Error).message}\n` };
  }

  let symbol;
  try {
    symbol = generate(data, ecc);
  } catch (err) {
    if (err instanceof QrCapacityError) {
      return { code: 1, stdout: "", stderr: `error: ${err.message}\n` };
    }
    throw err;
  }

  const written: Array<{ path: string; type: FileType; width: number; height: number }> = [];
  for (const target of targets) {
    const dir = dirname(target.path);
    if (!existsSync(dir)) {
      try {
        mkdirSync(dir, { recursive: true });
      } catch {
        return { code: 1, stdout: "", stderr: `error: cannot create directory ${dir}\n` };
      }
    }
    try {
      if (target.type === "png") {
        const raster = renderPng(symbol.modules, { size: pngSize, quietZone });
        writeFileSync(target.path, raster.data);
        written.push({ path: target.path, type: "png", width: raster.pixels, height: raster.pixels });
      } else {
        const svg = renderSvg(symbol.modules, { size: svgSize, quietZone });
        writeFileSync(target.path, svg, "utf8");
        written.push({ path: target.path, type: "svg", width: svgSize, height: svgSize });
      }
    } catch (err) {
      return { code: 1, stdout: "", stderr: `error: cannot write ${target.path}: ${(err as Error).message}\n` };
    }
  }

  const warningText = warnings.map((w) => `warning: ${w}\n`).join("");

  if (parsed.json) {
    const summary = {
      data,
      version: symbol.version,
      modules: symbol.size,
      ecc: symbol.ecc,
      mask: symbol.mask,
      files: written,
    };
    return { code: 0, stdout: JSON.stringify(summary) + "\n", stderr: warningText };
  }

  const lines = written.map((f) => `wrote ${f.path} (${f.width}×${f.height})`);
  lines.push(`QR version ${symbol.version} (${symbol.size}×${symbol.size} modules), ECC ${symbol.ecc}`);
  return { code: 0, stdout: lines.join("\n") + "\n", stderr: warningText };
}

/* node:coverage disable */
/**
 * npm and yarn install bins as symlinks, so `process.argv[1]` is the link, not
 * the real file. Resolve it before comparing against this module's own path.
 */
function isInvokedDirectly(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return fileURLToPath(import.meta.url) === realpathSync(entry);
  } catch {
    return false;
  }
}
const invokedDirectly = isInvokedDirectly();
if (invokedDirectly) {
  const cliArgv = process.argv.slice(2);
  const argv =
    cliArgv.length === 1 && cliArgv[0] === "--stdin-args"
      ? tokenizeShellArgs(readFileSync(0, "utf8"))
      : cliArgv;
  const result = run(argv);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.code);
}
/* node:coverage enable */
