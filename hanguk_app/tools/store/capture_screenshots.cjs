#!/usr/bin/env node
/**
 * Capture App Store / Play screenshots from a real Flutter build.
 *
 * Apple rejected this app twice under guideline 2.3.3 for screenshots that
 * "do not show the actual app in use". Everything here therefore drives the
 * real app and photographs what it actually renders. There is no compositing,
 * no bezel, no caption layer — see store/listings/screenshots/README.md.
 *
 * Usage:
 *   node tools/store/capture_screenshots.cjs --build web-build-dir [options]
 *
 * Options:
 *   --build   <dir>     Flutter web build output (default build/web)
 *   --out     <dir>     Where PNGs land (default store/listings/screenshots/captured)
 *   --locale  <code>    App locale to force: en | ko | uz (default en)
 *   --code    <code>    Demo Magic Code. Without it only guest shots are taken.
 *   --port    <n>       Port for the static server (default 8099)
 *   --device  <name>    iphone-6.9 (default) | iphone-6.5
 *   --keep-open         Leave the browser running for manual inspection.
 *
 * The Magic Code is a credential: pass it on the command line, never commit
 * it. See store/APP_REVIEW_2026-08-05.md § 2.
 */

const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ── Device sizes ───────────────────────────────────────────────────────────
// Apple wants exact pixel dimensions. Chromium gives us CSS pixels, so we
// pick the logical size the real device uses and let deviceScaleFactor do
// the multiplication — 440 x 956 at dpr 3 is exactly 1320 x 2868.
const DEVICES = {
  'iphone-6.9': { width: 440, height: 956, scale: 3, px: '1320x2868' },
  'iphone-6.5': { width: 414, height: 896, scale: 3, px: '1242x2688' },
};

function parseArgs(argv) {
  const out = {
    build: 'build/web',
    out: 'store/listings/screenshots/captured',
    locale: 'en',
    code: null,
    port: 8099,
    device: 'iphone-6.9',
    keepOpen: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--keep-open') out.keepOpen = true;
    else if (a === '--build') out.build = argv[++i];
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--locale') out.locale = argv[++i];
    else if (a === '--code') out.code = argv[++i];
    else if (a === '--port') out.port = Number(argv[++i]);
    else if (a === '--device') out.device = argv[++i];
    else throw new Error(`unknown argument: ${a}`);
  }
  if (!DEVICES[out.device]) {
    throw new Error(`unknown device ${out.device}; known: ${Object.keys(DEVICES).join(', ')}`);
  }
  return out;
}

// ── Static server ──────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.bin': 'application/octet-stream',
  '.symbols': 'application/octet-stream',
};

function serve(root, port) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join(root, url === '/' ? 'index.html' : url);
    // Flutter's router uses history paths; anything that isn't a real file
    // has to fall back to index.html or a deep link 404s.
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(root, 'index.html');
    }
    // CanvasKit and the skwasm renderer need cross-origin isolation.
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

// ── Flutter readiness ──────────────────────────────────────────────────────
/**
 * Flutter web paints into a canvas, so there is no DOM to assert on. Wait for
 * the glass pane the engine installs, then for two consecutive identical
 * frames — that is the cheapest reliable "it has stopped animating" signal,
 * and it keeps us from photographing a half-built list.
 */
async function waitForFlutter(page, { timeout = 90000 } = {}) {
  // 'attached' rather than 'visible': the engine's host element carries no
  // intrinsic box in some renderers, so a visibility check can time out on a
  // page that is painting perfectly well.
  await page.waitForSelector('flt-glass-pane, flutter-view, flt-scene-host', {
    state: 'attached',
    timeout,
  });
  await page.waitForTimeout(3000);
  await enableSemantics(page);
}

async function waitUntilStill(page, { tries = 12, gap = 700 } = {}) {
  let previous = null;
  let stable = 0;
  for (let i = 0; i < tries; i++) {
    const shot = await page.screenshot();
    const current = shot.toString('base64');
    if (current === previous) {
      if (++stable >= 2) return true;
    } else {
      stable = 0;
    }
    previous = current;
    await page.waitForTimeout(gap);
  }
  return false;
}

async function shoot(page, outDir, index, name) {
  const file = path.join(outDir, `${String(index).padStart(2, '0')}-${name}.png`);
  await waitUntilStill(page);
  await page.screenshot({ path: file });
  console.log(`  captured ${path.basename(file)}`);
  return file;
}

/**
 * Flutter web builds no accessibility tree until it thinks a screen reader is
 * present, so `getByLabel` finds nothing on a fresh page. The engine ships a
 * hidden placeholder element for exactly this: activating it turns semantics
 * on, after which every Semantics label in the app becomes an aria-label we
 * can target. Without this the script can only click blind coordinates.
 */
async function enableSemantics(page) {
  await page.evaluate(() => {
    const ph = document.querySelector('flt-semantics-placeholder');
    if (ph) ph.click();
  });
  await page.waitForTimeout(1200);
}

/** Tap by the visible label Flutter exposes through its semantics tree. */
async function tapLabel(page, label, { timeout = 15000 } = {}) {
  const target = page.getByLabel(label, { exact: false }).first();
  await target.waitFor({ state: 'visible', timeout });
  await target.click();
  await page.waitForTimeout(1200);
}

/**
 * Tap a point given as a fraction of the viewport.
 *
 * CanvasKit paints text into a canvas and this build exposes no semantics
 * placeholder, so there is no DOM node to query for most controls — a
 * proportional tap is the only handle we have. Fractions rather than pixels
 * so the same call works across device sizes. Verify the resulting frame by
 * eye: a tap that lands on empty space fails silently.
 */
async function tapPoint(page, xFrac, yFrac, { settle = 2000 } = {}) {
  const size = page.viewportSize();
  await page.mouse.click(Math.round(size.width * xFrac), Math.round(size.height * yFrac));
  await page.waitForTimeout(settle);
}

async function main() {
  const opts = parseArgs(process.argv);
  const device = DEVICES[opts.device];
  const buildDir = path.resolve(opts.build);
  const outDir = path.resolve(opts.out, opts.device, opts.locale);

  if (!fs.existsSync(path.join(buildDir, 'index.html'))) {
    throw new Error(
      `no Flutter web build at ${buildDir}. Run:\n` +
      `  flutter build web --release --dart-define=STORE_BUILD=true`,
    );
  }
  fs.mkdirSync(outDir, { recursive: true });

  const server = await serve(buildDir, opts.port);
  const base = `http://localhost:${opts.port}`;
  console.log(`serving ${buildDir} on ${base}`);
  console.log(`device ${opts.device} (${device.px}), locale ${opts.locale}`);

  const proxyServer =
    process.env.HTTPS_PROXY || process.env.https_proxy ||
    process.env.HTTP_PROXY || process.env.http_proxy || null;

  const browser = await chromium.launch({
    // Sandboxes that export HTTP(S)_PROXY need careful handling here. The app
    // still has to reach Supabase over the proxy or it never signs in and
    // never loads data — but Chromium also sends localhost through the proxy
    // unless told otherwise, and then every asset returns
    // ERR_CONNECTION_RESET. Keep the proxy, exempt the loopback.
    args: [
      '--enable-features=SharedArrayBuffer',
      '--use-fake-ui-for-media-stream',
      ...(proxyServer
        ? [
            `--proxy-server=${proxyServer}`,
            // Semicolons, not commas — this is Chromium's own list format.
            // '<-loopback>' is the token that stops it proxying localhost.
            '--proxy-bypass-list=<-loopback>;localhost;127.0.0.1;[::1]',
          ]
        : []),
    ],
  });
  const context = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    deviceScaleFactor: device.scale,
    isMobile: true,
    hasTouch: true,
    locale: opts.locale,
    permissions: ['microphone'],
    // A proxy that re-signs TLS presents its own CA, which Chromium will not
    // trust out of the box. Only local capture traffic goes through here.
    ignoreHTTPSErrors: true,
  });
  // Bridge every off-host request through Node.
  //
  // In a sandbox whose egress runs through a re-signing proxy, Chromium's own
  // requests to Supabase come back ERR_CONNECTION_RESET even when the same
  // URL succeeds from Node. Without data the app renders spinners and empty
  // states, and an empty state is exactly what gets a screenshot rejected. So
  // the browser talks to this handler, and this handler — which does honour
  // the proxy — does the real fetch.
  //
  // Registered before the more specific routes below: Playwright matches the
  // most recently added handler first, so those still win.
  process.env.NODE_USE_ENV_PROXY = '1';
  await context.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|\[::1\])/, async (route) => {
    const request = route.request();
    // The bridge makes everything same-origin from the page's point of view,
    // so answer preflights affirmatively rather than forwarding them.
    if (request.method() === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': '*',
          'access-control-allow-headers': '*',
        },
      });
    }
    try {
      const res = await fetch(request.url(), {
        method: request.method(),
        headers: request.headers(),
        body: ['GET', 'HEAD'].includes(request.method()) ? undefined : request.postDataBuffer(),
        redirect: 'follow',
      });
      const body = Buffer.from(await res.arrayBuffer());
      const headers = Object.fromEntries(res.headers);
      // fetch has already decoded the payload; leaving these in place would
      // make Chromium try to decode it a second time.
      delete headers['content-encoding'];
      delete headers['content-length'];
      headers['access-control-allow-origin'] = '*';
      return route.fulfill({ status: res.status, headers, body });
    } catch (err) {
      console.log(`  [bridge] ${request.url().slice(0, 80)}: ${err.message}`);
      return route.abort();
    }
  });

  // The engine pulls CanvasKit from gstatic.com by default. On a restricted
  // network that fetch fails and nothing ever paints — the page stays blank
  // and every screenshot would be of an empty canvas. `flutter build web`
  // already emits a byte-identical copy under build/web/canvaskit/, so serve
  // the request from there instead of reaching out.
  await context.route('**/flutter-canvaskit/**', (route) => {
    const rest = route.request().url().split('/flutter-canvaskit/')[1];
    // Drop the engine-revision segment; keep any sub-path such as chromium/.
    const local = path.join(buildDir, 'canvaskit', rest.split('/').slice(1).join('/'));
    if (!fs.existsSync(local)) return route.abort();
    const type = path.extname(local) === '.wasm'
      ? 'application/wasm'
      : 'text/javascript';
    return route.fulfill({ status: 200, contentType: type, body: fs.readFileSync(local) });
  });
  // Roboto is fetched from Google Fonts purely as a fallback face. It is
  // blocked here and the app bundles its own type, so refuse it quietly
  // rather than let the engine stall on the request.
  await context.route('**://fonts.gstatic.com/**', (route) => route.abort());

  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') console.log(`  [browser] ${m.text()}`);
  });

  const shots = [];
  let n = 0;

  try {
    // ── Guest shots: no credential needed ──────────────────────────────────
    // The guest shell is a real, reachable part of the app, so these count as
    // the app in use even though nobody has signed in.
    console.log('\nguest shell');
    // A cold load lands on Welcome, and the router bounces a direct /guest
    // deep link back there too. Welcome is a screen Apple explicitly does not
    // count as the app in use, so we tap through it and never photograph it.
    await page.goto(`${base}/#/`, { waitUntil: 'load' });
    await waitForFlutter(page);
    // 'Explore Universities' — the lower of the two buttons on Welcome.
    await tapPoint(page, 0.5, 0.913, { settle: 12000 });
    await waitForFlutter(page, { timeout: 30000 });
    shots.push(await shoot(page, outDir, ++n, 'guest-explore'));

    // Put two universities into the comparison before opening it. An empty
    // Compare screen is two dashed 'Add from Explore' boxes, and a reviewer
    // reads an empty state as functionality they could not access — the same
    // rejection by another name.
    await tapPoint(page, 0.866, 0.704);            // first row's + button
    // Selecting one inserts a 'Compare 1/2' row above the list, which pushes
    // every row down; the second + is lower than the first row spacing implies.
    await tapPoint(page, 0.866, 0.831);            // second row's + button

    // The guest shell navigates through a radial dial rather than a tab bar:
    // tap the orb, then the label pill of the section you want. The pills are
    // a wider target than the Hangul orbs beside them.
    const DIAL_ORB = [0.85, 0.915];
    const PILL = { map: 0.706, compare: 0.773 };

    await tapPoint(page, ...DIAL_ORB, { settle: 3500 });
    await tapPoint(page, 0.673, PILL.map, { settle: 18000 }); // map tiles are slow
    shots.push(await shoot(page, outDir, ++n, 'guest-map'));

    await tapPoint(page, ...DIAL_ORB, { settle: 3500 });
    await tapPoint(page, 0.673, PILL.compare, { settle: 9000 });
    shots.push(await shoot(page, outDir, ++n, 'guest-compare'));

    // ── Signed-in shots ────────────────────────────────────────────────────
    // These are the ones Apple's "majority must be core features" rule really
    // rests on. Without a code we stop here rather than pad the set.
    if (!opts.code) {
      console.log('\nno --code given; skipping the signed-in screens');
      console.log('the guest shots alone are NOT enough for guideline 2.3.3');
    } else {
      console.log('\nsigning in');
      await page.goto(`${base}/#/login`, { waitUntil: 'load' });
      await waitForFlutter(page);
      const field = page.locator('input').first();
      await field.waitFor({ state: 'visible', timeout: 20000 });
      await field.fill(opts.code);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(9000);
      await waitForFlutter(page);

      // The signed-in shell is one route ('/') with a dial; every other
      // screen is reached by tapping a dial item, not by navigating. Labels
      // are the English l10n strings — pass --locale with a matching set if
      // you localise this run.
      await page.goto(`${base}/#/`, { waitUntil: 'load' });
      await waitForFlutter(page);
      shots.push(await shoot(page, outDir, ++n, 'home'));

      const dial = [
        ['Map', 'map'],
        ['Docs', 'documents'],
        ['Applications', 'applications'],
        ['Study Plan Builder', 'study-plan'],
        ['Interview Preparation', 'interview'],
      ];
      for (const [label, name] of dial) {
        try {
          await tapLabel(page, label);
          shots.push(await shoot(page, outDir, ++n, name));
          // Return to the dial's home state so the next label is reachable.
          await page.goto(`${base}/#/`, { waitUntil: 'load' });
          await waitForFlutter(page);
        } catch (err) {
          console.log(`  skipped ${name}: ${err.message.split('\n')[0]}`);
        }
      }
    }

    console.log(`\n${shots.length} screenshot(s) in ${outDir}`);
    console.log('Review every one by eye before upload: no splash, no login,');
    console.log('no empty state, no real personal data.');

    if (opts.keepOpen) {
      console.log('\n--keep-open: press Ctrl-C to stop');
      await new Promise(() => {});
    }
  } finally {
    if (!opts.keepOpen) {
      await browser.close();
      server.close();
    }
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
