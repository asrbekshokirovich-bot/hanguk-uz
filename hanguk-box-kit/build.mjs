// Embeds the brand logos (base64) into the reveal HTML so the file is fully
// self-contained: double-clickable locally AND deployable as a static file.
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";

const navy  = readFileSync("public/brand-mark.png").toString("base64");
const white = readFileSync("public/brand-glyph-white.png").toString("base64");

const navyURI  = `data:image/png;base64,${navy}`;
const whiteURI = `data:image/png;base64,${white}`;

let html = readFileSync("hanguk-box-kit/box-reveal.template.html", "utf8");
html = html.replaceAll("__NAVY_LOGO__", navyURI).replaceAll("__WHITE_GLYPH__", whiteURI);

writeFileSync("hanguk-box-kit/box-reveal.html", html);
// also publish to /public so it's served at  <site>/box-reveal.html
copyFileSync("hanguk-box-kit/box-reveal.html", "public/box-reveal.html");

console.log("built box-reveal.html  (", Math.round(html.length/1024), "KB )");
