// Browser-based one-time login — so you never need a terminal.
//
// Turned on by LOGIN_MODE=1. The service exposes a tiny web page on its public
// Railway URL: enter your phone → the code Telegram texts you → 2FA password if
// asked. It then shows the SESSION string. Paste that into TG_SESSION, set
// LOGIN_MODE back to 0, and redeploy to run the bot for real.
//
// Protected by LOGIN_PASSWORD so only you can use it. Used once, then disabled.
import http from "node:http";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const loginPassword = process.env.LOGIN_PASSWORD || "";
const port = Number(process.env.PORT || 8080);

if (!apiId || !apiHash) {
  console.error("Set TELEGRAM_API_ID and TELEGRAM_API_HASH to use login mode.");
  process.exit(1);
}

function defer() {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
}

let state = "need_phone"; // need_phone | sending | need_code | need_password | done | error
let errorMsg = "";
let sessionString = "";
const d = { phone: defer(), code: defer(), password: defer() };

// Drive GramJS's interactive login via the same callbacks the CLI uses, but
// resolve each one from a web form submission instead of stdin.
function startLogin() {
  const client = new TelegramClient(new StringSession(""), apiId, apiHash, { connectionRetries: 5 });
  client
    .start({
      phoneNumber: async () => { state = "need_phone"; return await d.phone.promise; },
      phoneCode: async () => { state = "need_code"; return await d.code.promise; },
      password: async () => { state = "need_password"; return await d.password.promise; },
      onError: (e) => { errorMsg = e?.message || String(e); },
    })
    .then(() => { sessionString = client.session.save(); state = "done"; client.disconnect().catch(() => {}); })
    .catch((e) => { errorMsg = e?.message || String(e); state = "error"; });
}

function authed(url) {
  if (!loginPassword) return true;
  return url.searchParams.get("k") === loginPassword;
}

function page(body) {
  const k = loginPassword ? `?k=${encodeURIComponent(loginPassword)}` : "";
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hanguk Telegram login</title>
<style>body{font-family:system-ui;max-width:520px;margin:40px auto;padding:0 16px;color:#111}
input{font-size:16px;padding:10px;width:100%;box-sizing:border-box;margin:8px 0;border:1px solid #ccc;border-radius:8px}
button{font-size:16px;padding:12px 16px;border:0;border-radius:8px;background:#2563eb;color:#fff;width:100%}
.card{border:1px solid #eee;border-radius:12px;padding:20px;box-shadow:0 1px 6px rgba(0,0,0,.05)}
code{word-break:break-all;background:#f5f5f5;padding:12px;display:block;border-radius:8px}
.muted{color:#666;font-size:14px}.err{color:#b91c1c}</style></head>
<body><div class="card"><h2>Hanguk — Telegram login</h2>${body}
<p class="muted">Form action: <code style="display:inline;padding:2px 6px">/submit${k}</code></p></div></body></html>`;
}

function form(field, label, type = "text") {
  const k = loginPassword ? loginPassword : "";
  return `<form method="post" action="/submit">
    <input type="hidden" name="k" value="${k}">
    <input type="hidden" name="field" value="${field}">
    <label>${label}</label>
    <input name="value" type="${type}" autofocus autocomplete="off" required>
    <button type="submit">Continue</button>
  </form>`;
}

function render() {
  if (errorMsg && state !== "done") {
    return page(`<p class="err">Error: ${errorMsg}</p><p class="muted">Reload the page to try again, or restart the service.</p>`);
  }
  switch (state) {
    case "need_phone":
      return page(`<p>Enter the phone number of the Telegram account to connect.</p>${form("phone", "Phone (e.g. +998901234567)", "tel")}`);
    case "need_code":
      return page(`<p>Telegram just sent a login code to that account. Enter it below.</p>${form("code", "Login code")}`);
    case "need_password":
      return page(`<p>This account has 2-step verification. Enter its password.</p>${form("password", "2FA password", "password")}`);
    case "done":
      return page(`<p>✅ Logged in. Copy this and set it as <b>TG_SESSION</b> in Railway, then set <b>LOGIN_MODE=0</b> and redeploy.</p><code>${sessionString}</code>`);
    default:
      return page(`<p class="muted">Working… reload in a moment.</p>`);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (!authed(url)) {
    res.writeHead(401, { "Content-Type": "text/html" });
    res.end(page(`<p>Add <code style="display:inline">?k=YOUR_LOGIN_PASSWORD</code> to the URL to continue.</p>`));
    return;
  }
  if (req.method === "POST" && url.pathname === "/submit") {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = new URLSearchParams(raw);
    if (loginPassword && body.get("k") !== loginPassword) {
      res.writeHead(401); res.end("unauthorized"); return;
    }
    const field = body.get("field");
    const value = (body.get("value") || "").trim();
    if (field === "phone") d.phone.resolve(value);
    else if (field === "code") d.code.resolve(value);
    else if (field === "password") d.password.resolve(value);
    const k = loginPassword ? `?k=${encodeURIComponent(loginPassword)}` : "";
    res.writeHead(303, { Location: `/${k}` });
    res.end();
    return;
  }
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(render());
});

startLogin();
server.listen(port, () => console.log(`Login page listening on :${port} (open your Railway URL, add ?k=<LOGIN_PASSWORD>)`));
