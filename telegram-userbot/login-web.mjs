// Browser-based one-time login for Railway (no terminal needed).
//
// LOGIN_MODE=1 serves this page. Open the service's public URL with
// ?k=<LOGIN_PASSWORD>, log in (phone -> code -> 2FA), copy the session string
// into TG_SESSION, then set LOGIN_MODE=0 and redeploy.
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

let state = "need_phone"; // need_phone | need_code | need_password | done | error
let errorMsg = "";
let sessionString = "";
let d = { phone: defer(), code: defer(), password: defer() };
let client = null;

// (Re)start a fresh login attempt. Driven by the same GramJS callbacks the CLI
// uses, but each one is resolved by a web form submission.
function startLogin() {
  state = "need_phone";
  errorMsg = "";
  sessionString = "";
  d = { phone: defer(), code: defer(), password: defer() };
  if (client) { try { client.disconnect(); } catch (_e) { /* ignore */ } }
  client = new TelegramClient(new StringSession(""), apiId, apiHash, { connectionRetries: 5 });
  client
    .start({
      phoneNumber: async () => { state = "need_phone"; return await d.phone.promise; },
      phoneCode: async () => { state = "need_code"; return await d.code.promise; },
      password: async () => { state = "need_password"; return await d.password.promise; },
      onError: (e) => { errorMsg = e?.message || String(e); },
    })
    .then(() => { sessionString = client.session.save(); state = "done"; try { client.disconnect(); } catch (_e) { /* ignore */ } })
    .catch((e) => { errorMsg = e?.message || String(e); state = "error"; });
}

function authed(url) {
  if (!loginPassword) return true;
  return url.searchParams.get("k") === loginPassword;
}

function kq() {
  return loginPassword ? `?k=${encodeURIComponent(loginPassword)}` : "";
}

function page(body) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hanguk - Telegram login</title>
<style>body{font-family:system-ui,Arial,sans-serif;max-width:520px;margin:40px auto;padding:0 16px;color:#111}
input{font-size:16px;padding:10px;width:100%;box-sizing:border-box;margin:8px 0;border:1px solid #ccc;border-radius:8px}
button{font-size:16px;padding:12px 16px;border:0;border-radius:8px;background:#2563eb;color:#fff;width:100%}
.card{border:1px solid #eee;border-radius:12px;padding:20px;box-shadow:0 1px 6px rgba(0,0,0,.05)}
code{word-break:break-all;background:#f5f5f5;padding:12px;display:block;border-radius:8px}
.muted{color:#666;font-size:14px}.err{color:#b91c1c}a{color:#2563eb}</style></head>
<body><div class="card"><h2>Hanguk - Telegram login</h2>${body}</div></body></html>`;
}

function form(field, label, type = "text") {
  return `<form method="post" action="/submit${kq()}">
    <input type="hidden" name="field" value="${field}">
    <label>${label}</label>
    <input name="value" type="${type}" autofocus autocomplete="off" required>
    <button type="submit">Continue</button>
  </form>`;
}

function startOver() {
  const sep = loginPassword ? "&" : "?";
  return `<p class="muted" style="margin-top:16px"><a href="/${kq()}${sep}reset=1">&#8635; Start over</a></p>`;
}

function render() {
  if (state === "error") {
    return page(`<p class="err">Error: ${errorMsg || "login failed"}</p>
      <p class="muted">The code may have expired or been mistyped. Click "Start over" and enter the phone again to get a fresh code.</p>${startOver()}`);
  }
  switch (state) {
    case "need_phone":
      return page(`<p>Enter the phone number of the Telegram account to connect.</p>${form("phone", "Phone (e.g. +998901234567)", "tel")}`);
    case "need_code":
      return page(`<p>Telegram sent a login code <b>inside your Telegram app</b> &mdash; open the chat named <b>"Telegram"</b> and find the code. Enter it below <b>quickly</b>, before it expires.</p>${form("code", "Login code")}${startOver()}`);
    case "need_password":
      return page(`<p>This account has 2-step verification. Enter its password.</p>${form("password", "2FA password", "password")}${startOver()}`);
    case "done":
      return page(`<p>&#9989; Logged in. Copy this and set it as <b>TG_SESSION</b> in Railway, then set <b>LOGIN_MODE=0</b> and redeploy.</p><code>${sessionString}</code>`);
    default:
      return page(`<p class="muted">Working&hellip; reload in a moment.</p>${startOver()}`);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Password required on every request (forms post to /submit?k=...).
  if (!authed(url)) {
    res.writeHead(401, { "Content-Type": "text/html; charset=utf-8" });
    res.end(page(`<p>Add <code style="display:inline">?k=YOUR_LOGIN_PASSWORD</code> to the URL to continue.</p>`));
    return;
  }

  // Start over: re-initialise a fresh login attempt.
  if (req.method === "GET" && url.searchParams.get("reset") === "1") {
    startLogin();
    res.writeHead(303, { Location: `/${kq()}` });
    res.end();
    return;
  }

  if (req.method === "POST" && url.pathname === "/submit") {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = new URLSearchParams(raw);
    const field = body.get("field");
    const value = (body.get("value") || "").trim();
    // Resolve the awaited step, then arm a fresh deferred so a retry (e.g. the
    // provider re-asks for the code) waits for new input instead of replaying.
    if (field === "phone") { d.phone.resolve(value); d.phone = defer(); }
    else if (field === "code") { d.code.resolve(value); d.code = defer(); }
    else if (field === "password") { d.password.resolve(value); d.password = defer(); }
    res.writeHead(303, { Location: `/${kq()}` });
    res.end();
    return;
  }

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(render());
});

startLogin();
server.listen(port, () => console.log(`Login page listening on :${port} (open your Railway URL with ?k=<LOGIN_PASSWORD>)`));
