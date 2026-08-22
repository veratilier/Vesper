import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const sourceDir = path.dirname(fileURLToPath(import.meta.url));
const targetRoot = path.resolve(process.argv[2] || "");
if (!targetRoot || targetRoot === process.cwd())
  throw new Error("Usage: node install.mjs /absolute/path/to/cyberboss");

const appPath = path.join(targetRoot, "src/core/app.js");
const configPath = path.join(targetRoot, "src/core/config.js");
const checkinPath = path.join(targetRoot, "src/app/system-checkin-poller.js");
const adapterDir = path.join(targetRoot, "src/adapters/channel/vesper");
const appOriginal = await readFile(appPath, "utf8");
const configOriginal = await readFile(configPath, "utf8");
const checkinOriginal = await readFile(checkinPath, "utf8");
const appUpdated = appOriginal
  .replace(
    'const { createWeixinChannelAdapter } = require("../adapters/channel/weixin");',
    'const { createWeixinChannelAdapter } = require("../adapters/channel/weixin");\nconst { createVesperChannelAdapter } = require("../adapters/channel/vesper");',
  )
  .replace(
    "function createRuntimeAdapter(config) {",
    'function createChannelAdapter(config) {\n  return config.channel === "vesper" ? createVesperChannelAdapter(config) : createWeixinChannelAdapter(config);\n}\n\nfunction createRuntimeAdapter(config) {',
  )
  .replace(
    "this.channelAdapter = createWeixinChannelAdapter(config);",
    "this.channelAdapter = createChannelAdapter(config);",
  );
const configUpdated = configOriginal.replace(
  'channel: readTextEnv("CYBERBOSS_CHANNEL") || "weixin",',
  'channel: readTextEnv("CYBERBOSS_CHANNEL") || "weixin",\n    vesperBaseUrl: readTextEnv("CYBERBOSS_VESPER_BASE_URL") || "https://api.vesper.r-vera.com",\n    vesperBridgeToken: readTextEnv("CYBERBOSS_VESPER_TOKEN"),\n    vesperUserId: readTextEnv("CYBERBOSS_VESPER_USER_ID") || "vesper-user",\n    vesperPollIntervalMs: readIntEnv("CYBERBOSS_VESPER_POLL_INTERVAL_MS") || 1500,',
);
const checkinUpdated = checkinOriginal.replace(
  "const account = resolveSelectedAccount(config);",
  'const account = config.channel === "vesper" ? { accountId: "vesper" } : resolveSelectedAccount(config);',
);
if (
  appUpdated === appOriginal ||
  configUpdated === configOriginal ||
  checkinUpdated === checkinOriginal
)
  throw new Error(
    "CyberBoss source shape was not recognized; no files were changed.",
  );
await mkdir(adapterDir, { recursive: true });
await copyFile(
  path.join(sourceDir, "index.js"),
  path.join(adapterDir, "index.js"),
);
await writeFile(appPath, appUpdated);
await writeFile(configPath, configUpdated);
await writeFile(checkinPath, checkinUpdated);
console.log("Installed the Vesper channel adapter into CyberBoss.");
