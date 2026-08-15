#!/usr/bin/env node
// Minimal dependency-free static file server.
//
//   node scripts/serve-static.mjs <dir> [port]
//
// Used by `npm run design` to open the Lead module design package over http://
// — the Design Code preview boots through fetch/script loading, which browsers
// refuse to do from a file:// page.

import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat, readdir } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";

const root = resolve(process.argv[2] ?? ".");
const port = Number(process.argv[3]) || 8099;
const host = process.env.STATIC_HOST || "127.0.0.1";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8", ...headers });
  res.end(body);
}

// Directory listing, so a folder of several .dc.html previews is browsable.
async function listing(res, dirPath, urlPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const links = entries
    .filter((e) => !e.name.startsWith("."))
    .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
    .map((e) => {
      const name = e.name + (e.isDirectory() ? "/" : "");
      return `<li><a href="${encodeURIComponent(e.name)}${e.isDirectory() ? "/" : ""}">${name}</a></li>`;
    })
    .join("\n");
  send(
    res,
    200,
    `<!doctype html><meta charset="utf-8"><title>${urlPath}</title>` +
      `<body style="font-family:system-ui;padding:24px;line-height:1.8">` +
      `<h2 style="font-weight:600">${urlPath}</h2><ul>${links}</ul></body>`,
    { "content-type": "text/html; charset=utf-8" }
  );
}

const server = createServer(async (req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    return send(res, 400, "Bad request");
  }

  // Contain every request inside `root` — reject traversal outside it.
  const target = normalize(join(root, urlPath));
  if (target !== root && !target.startsWith(root + sep)) return send(res, 403, "Forbidden");

  try {
    const info = await stat(target);
    if (info.isDirectory()) {
      const index = join(target, "index.html");
      const hasIndex = await stat(index).then(() => true, () => false);
      if (!hasIndex) return listing(res, target, urlPath);
      return stream(res, index);
    }
    return stream(res, target, info);
  } catch {
    return send(res, 404, "Not found");
  }
});

function stream(res, file, info) {
  res.writeHead(200, {
    "content-type": TYPES[extname(file).toLowerCase()] || "application/octet-stream",
    "cache-control": "no-cache",
    ...(info ? { "content-length": info.size } : {}),
  });
  createReadStream(file).pipe(res);
}

server.listen(port, host, () => {
  console.log(`  Static server: http://${host === "0.0.0.0" ? "localhost" : host}:${port}/`);
  console.log(`  Papka:         ${root}`);
});
