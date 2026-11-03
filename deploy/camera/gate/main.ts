// camera-gate'ni ishga tushirish. O'rnatish va sozlash: deploy/camera/README.md
import { ConfigError, loadConfig } from "./config.ts";
import { createGate, defaultLog } from "./gate.ts";
import { importSecret } from "./token.ts";

let cfg;
try {
  cfg = loadConfig((name) => Deno.env.get(name));
} catch (e) {
  if (e instanceof ConfigError) {
    console.error("camera-gate: secrets/gate.env da xato:\n - " + e.problems.join("\n - "));
    Deno.exit(1);
  }
  throw e;
}

const key = await importSecret(cfg.secret);
const gate = createGate(cfg, key);
const config = cfg;

Deno.serve({
  hostname: config.hostname,
  port: config.port,
  onListen: (addr) =>
    defaultLog("listen", {
      addr: `${addr.hostname}:${addr.port}`,
      go2rtc: config.go2rtcUrl,
      cameras: config.cameras,
      origins: config.origins,
    }),
}, gate.handler);
