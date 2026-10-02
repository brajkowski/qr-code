// Local semantic-release plugin used by the release rehearsal (release.yml).
// Runs in `verifyRelease`, after release notes are generated, and writes the
// computed next version and notes to disk and to $GITHUB_OUTPUT so later steps
// can pack and verify the exact artifact that would ship. It never publishes.
const { appendFileSync, mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

async function verifyRelease(_pluginConfig, context) {
  const { nextRelease, logger } = context;
  const outDir = process.env.REHEARSAL_DIR || "rehearsal";
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "next-version.txt"), `${nextRelease.version}\n`);
  writeFileSync(join(outDir, "release-notes.md"), `${nextRelease.notes ?? ""}\n`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `version=${nextRelease.version}\ntag=${nextRelease.gitTag}\n`);
  }
  logger.log("Rehearsal: next version %s written to %s", nextRelease.version, outDir);
}

module.exports = { verifyRelease };
