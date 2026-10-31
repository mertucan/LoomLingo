// Publishes an over-the-air update: raises the release label in app.json
// (1.1.0 -> 1.1.1), then runs `eas update` on the "preview" channel.
// Usage: npm run update -- "What changed"
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const message = process.argv.slice(2).join(" ").trim() || "Güncelleme";

// `eas update --environment` sets EXPO_NO_DOTENV, so .env would be ignored and the
// update would ship without the Gemini key. Its values are passed in directly instead,
// and --clear-cache stops Metro from reusing a bundle built without them.
const envPath = new URL("../.env", import.meta.url);
const dotenv = existsSync(envPath) ? Object.fromEntries(readFileSync(envPath, "utf8").split(/\r?\n/)
  .map(line => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, "")])) : {};
if (!dotenv.EXPO_PUBLIC_GEMINI_API_KEY || dotenv.EXPO_PUBLIC_GEMINI_API_KEY.startsWith("PASTE_")) {
  console.error("EXPO_PUBLIC_GEMINI_API_KEY is missing from .env; nothing was published.");
  process.exit(1);
}

const path = new URL("../app.json", import.meta.url);
const original = readFileSync(path, "utf8");
const config = JSON.parse(original);
const [major, minor, patch] = String(config.expo.extra.release).split(".").map(Number);
const release = `${major}.${minor}.${(patch || 0) + 1}`;
config.expo.extra.release = release;
writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
console.log(`Publishing v${release} (runtime ${config.expo.version}): ${message}`);
try {
  execSync(`npx eas-cli@latest update --channel preview --environment preview --clear-cache --non-interactive --message ${JSON.stringify(`v${release}: ${message}`)}`,
    { stdio: "inherit", env: { ...process.env, ...dotenv } });
  console.log(`\nv${release} published. Phones get a "Loom Lingo v${release} hazır" notification within about an hour, or see it at the next start.`);
} catch {
  writeFileSync(path, original); // keep the old label so the next try uses the same number
  console.error("\nPublishing failed; app.json was left unchanged.");
  process.exit(1);
}
