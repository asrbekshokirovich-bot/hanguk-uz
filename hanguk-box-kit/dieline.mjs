// Generates print-ready DIELINES (SVG, real millimetre units) for the Hanguk Box.
// Two pieces of a rigid lid+tray box:  dieline-lid.svg  and  dieline-tray.svg
// Conventions (legend drawn on the sheet):
//   CUT   = solid  red  (#E2001A)  — knife / die-cut
//   FOLD  = dashed blue (#0072BB)  — crease / score
//   BLEED = dotted grey            — extend artwork 3 mm past every cut edge
// Brand: Royal #1A3A6C · Lime #D4E94C · Ink #0A1A34
import { readFileSync, writeFileSync } from "node:fs";

const navy64  = readFileSync("public/brand-mark.png").toString("base64");
const white64 = readFileSync("public/brand-glyph-white.png").toString("base64");
const ROYAL="#1A3A6C", ROYAL90="#132A4D", LIME="#D4E94C", LIMED="#B4CC19";
const CUT="#E2001A", FOLD="#0072BB";
const BLEED=3, M=42; // bleed mm, outer margin mm for marks/annotations

// ---- tiny SVG helpers (all coords in mm) ----
const cut  = (x1,y1,x2,y2)=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${CUT}" stroke-width="0.5"/>`;
const fold = (x1,y1,x2,y2)=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${FOLD}" stroke-width="0.4" stroke-dasharray="3 2"/>`;
const rect = (x,y,w,h,fill,extra="")=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;
const esc  = s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const txt  = (x,y,s,o={})=>`<text x="${x}" y="${y}" font-family="Inter,Arial,sans-serif" font-size="${o.size||5}" fill="${o.fill||ROYAL}" font-weight="${o.w||600}" text-anchor="${o.anchor||"start"}" letter-spacing="${o.ls||0}" ${o.rot?`transform="rotate(${o.rot} ${x} ${y})"`:""}>${esc(s)}</text>`;
const useLogo = (x,y,w,h,which="navy")=>`<use href="#${which}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;

// dimension line with arrows + label (horizontal or vertical)
function dim(x1,y1,x2,y2,label){
  const mx=(x1+x2)/2, my=(y1+y2)/2, horiz=Math.abs(y2-y1)<0.01;
  return `<g stroke="${ROYAL}" stroke-width="0.3" fill="${ROYAL}">
    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>
    <circle cx="${x1}" cy="${y1}" r="0.7"/><circle cx="${x2}" cy="${y2}" r="0.7"/>
  </g>${txt(mx,horiz?my-1.5:my,label,{anchor:"middle",size:4.4,fill:ROYAL,rot:horiz?0:-90})}`;
}

// a printed (navy) outer panel with lime rim
function navyPanel(x,y,w,h,opts={}){
  let g = rect(x,y,w,h,ROYAL);
  // lime rim inside top edge
  g += rect(x,y,w,2,LIME);
  if(opts.frame) g += `<rect x="${x+3}" y="${y+3}" width="${w-6}" height="${h-6}" fill="none" stroke="${LIME}" stroke-width="0.6" rx="2"/>`;
  return g;
}

function gluePanel(x,y,w,h,label="GLUE"){
  let g = rect(x,y,w,h,"#EDEAE0");
  g += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#hatch)"/>`;
  const c=Math.min(w,h);
  g += txt(x+w/2, y+h/2+1.5, label, {anchor:"middle",size:Math.min(4,c*0.35),fill:"#7A745F",w:700,ls:1});
  return g;
}

// ---- build one piece ----
function buildPiece({file, title, L, W, H, g, lidTop}){
  // layout origin of TOP panel
  const X0 = M + g + H;       // left: margin + corner-tab + left wall
  const Y0 = M + H;           // top:  margin + back wall
  const sheetW = X0 + L + H + g + M;
  const sheetH = Y0 + W + H + M;

  const A = []; // artwork/fill layer
  const C = []; // cut layer
  const F = []; // fold layer

  // ----- FILL / ARTWORK -----
  // top panel
  A.push(navyPanel(X0,Y0,L,W,{frame:true}));
  // walls
  A.push(navyPanel(X0,Y0-H,L,H));              // back
  A.push(navyPanel(X0,Y0+W,L,H));              // front
  A.push(navyPanel(X0-H,Y0,H,W));              // left  (rim drawn along top; fine)
  A.push(navyPanel(X0+L,Y0,H,W));              // right
  // corner glue tabs extend from back/front walls horizontally
  // back tabs
  A.push(gluePanel(X0-g,Y0-H,g,H,"GLUE"));
  A.push(gluePanel(X0+L,Y0-H,g,H,"GLUE"));
  // front tabs
  A.push(gluePanel(X0-g,Y0+W,g,H,"GLUE"));
  A.push(gluePanel(X0+L,Y0+W,g,H,"GLUE"));

  // ----- ARTWORK CONTENT on the lid top -----
  if(lidTop){
    const cx = X0+L/2;
    A.push(useLogo(cx-26, Y0+W*0.20, 52, 52, "white"));
    A.push(`<text x="${cx}" y="${Y0+W*0.20+74}" font-family="Inter,Arial,sans-serif" font-size="22" font-weight="800" text-anchor="middle"><tspan fill="#FFFFFF">Hanguk </tspan><tspan fill="${LIME}">Box</tspan></text>`);
    A.push(`<rect x="${cx-26}" y="${Y0+W*0.20+84}" width="52" height="2.6" fill="${LIME}"/>`);
    A.push(txt(cx, Y0+W*0.20+99, "LEARN · BUILD · BELONG", {anchor:"middle",size:6.5,fill:"#BFD0E6",w:700,ls:3}));
    A.push(txt(cx, Y0+W-14, "한 Consulting  ·  han.uz", {anchor:"middle",size:6,fill:"#9DB4D2",w:600,ls:1.5}));
  } else {
    // tray: subtle inner brand on the (open) top panel = box floor when assembled
    const cx=X0+L/2, cy=Y0+W/2;
    A.push(useLogo(cx-18, cy-26, 36, 36, "white"));
    A.push(txt(cx, cy+22, "한 BOX", {anchor:"middle",size:9,fill:"#7FA0C8",w:800,ls:4}));
  }
  // front wall wordmark
  {
    const cx=X0+L/2;
    A.push(useLogo(X0+22, Y0+W+H/2-9, 16, 16, "white"));
    A.push(txt(cx+10, Y0+W+H/2+3, "HANGUK BOX", {anchor:"middle",size:9,fill:"#FFFFFF",w:800,ls:4}));
  }
  // side walls small glyph
  A.push(useLogo(X0-H/2-7, Y0+W/2-7, 14, 14, "white"));
  A.push(useLogo(X0+L+H/2-7, Y0+W/2-7, 14, 14, "white"));

  // ----- FOLD lines (creases) -----
  F.push(fold(X0,Y0,X0+L,Y0));         // top↔back
  F.push(fold(X0,Y0+W,X0+L,Y0+W));     // top↔front
  F.push(fold(X0,Y0,X0,Y0+W));         // top↔left
  F.push(fold(X0+L,Y0,X0+L,Y0+W));     // top↔right
  F.push(fold(X0,Y0-H,X0,Y0));         // back↔back-left-tab
  F.push(fold(X0+L,Y0-H,X0+L,Y0));     // back↔back-right-tab
  F.push(fold(X0,Y0+W,X0,Y0+W+H));     // front↔front-left-tab
  F.push(fold(X0+L,Y0+W,X0+L,Y0+W+H)); // front↔front-right-tab

  // ----- CUT lines (outer knife edges) -----
  // back wall + tabs top edge
  C.push(cut(X0-g,Y0-H,X0+L+g,Y0-H));
  // front wall + tabs bottom edge
  C.push(cut(X0-g,Y0+W+H,X0+L+g,Y0+W+H));
  // back-left tab left + bottom (relief)
  C.push(cut(X0-g,Y0-H,X0-g,Y0)); C.push(cut(X0-g,Y0,X0-H,Y0));
  // back-right tab right + bottom
  C.push(cut(X0+L+g,Y0-H,X0+L+g,Y0)); C.push(cut(X0+L+g,Y0,X0+L+H,Y0));
  // front-left tab left + top
  C.push(cut(X0-g,Y0+W+H,X0-g,Y0+W)); C.push(cut(X0-g,Y0+W,X0-H,Y0+W));
  // front-right tab right + top
  C.push(cut(X0+L+g,Y0+W+H,X0+L+g,Y0+W)); C.push(cut(X0+L+g,Y0+W,X0+L+H,Y0+W));
  // left wall outer (left,top,bottom)
  C.push(cut(X0-H,Y0,X0-H,Y0+W));
  C.push(cut(X0-H,Y0,X0,Y0)); C.push(cut(X0-H,Y0+W,X0,Y0+W));
  // right wall outer
  C.push(cut(X0+L+H,Y0,X0+L+H,Y0+W));
  C.push(cut(X0+L,Y0,X0+L+H,Y0)); C.push(cut(X0+L,Y0+W,X0+L+H,Y0+W));

  // ----- bleed rectangle around printed area (visual guide) -----
  const bleed = `<rect x="${X0-H-g-BLEED}" y="${Y0-H-BLEED}" width="${L+2*H+2*g+2*BLEED}" height="${W+2*H+2*BLEED}" fill="none" stroke="#9A9A9A" stroke-width="0.3" stroke-dasharray="1 1.5"/>`;

  // ----- dimensions -----
  const dims = [
    dim(X0, Y0-H-16, X0+L, Y0-H-16, `${L} mm`),               // top-panel width
    dim(X0-H-g-16, Y0, X0-H-g-16, Y0+W, `${W} mm`),           // top-panel height
    dim(X0+L+H+12, Y0-H, X0+L+H+12, Y0, `wall ${H} mm`),      // wall height
  ].join("");
  const wallDims = "";

  // ----- corner crop marks -----
  const crop=(cx,cy)=>`<g stroke="#333" stroke-width="0.3">
    <line x1="${cx-8}" y1="${cy}" x2="${cx-3}" y2="${cy}"/><line x1="${cx+3}" y1="${cy}" x2="${cx+8}" y2="${cy}"/>
    <line x1="${cx}" y1="${cy-8}" x2="${cx}" y2="${cy-3}"/><line x1="${cx}" y1="${cy+3}" x2="${cx}" y2="${cy+8}"/></g>`;
  const bx=X0-H-g, by=Y0-H, bw=L+2*H+2*g, bh=W+2*H;
  const marks = crop(bx,by)+crop(bx+bw,by)+crop(bx,by+bh)+crop(bx+bw,by+bh);

  // ----- title block + legend -----
  const tbY = sheetH-M+12;
  const titleBlock = `
    <g>
      ${rect(M, tbY, sheetW-2*M, 22, "#FFFFFF", `stroke="${ROYAL}" stroke-width="0.4"`)}
      ${useLogo(M+3, tbY+3, 16, 16, "navy")}
      ${txt(M+24, tbY+9, "HANGUK BOX", {size:7,w:800,ls:1})}
      ${txt(M+24, tbY+16, title, {size:4.5,w:600,fill:"#555"})}
      ${txt(sheetW/2-10, tbY+9, `Outer (assembled): ${L+0}×${W+0}×${H} mm  ·  Material: 2 mm greyboard, wrapped 157 gsm art paper`, {size:4,fill:"#444"})}
      ${txt(sheetW/2-10, tbY+16, `Print: CMYK + Pantone 534 C (Royal) & 374 C (Lime)  ·  Finish: soft-touch matte lam + spot-UV logo  ·  Bleed 3 mm`, {size:4,fill:"#444"})}
      <g transform="translate(${sheetW-M-86},${tbY+4})">
        <line x1="0" y1="2" x2="10" y2="2" stroke="${CUT}" stroke-width="0.6"/>${txt(13,3.5,"CUT",{size:4,fill:"#333"})}
        <line x1="0" y1="9" x2="10" y2="9" stroke="${FOLD}" stroke-width="0.6" stroke-dasharray="3 2"/>${txt(13,10.5,"FOLD / CREASE",{size:4,fill:"#333"})}
        <rect x="34" y="6.5" width="10" height="4" fill="url(#hatch)"/>${txt(47,10.5,"GLUE (no print)",{size:4,fill:"#333"})}
        <line x1="0" y1="15" x2="10" y2="15" stroke="#9A9A9A" stroke-width="0.5" stroke-dasharray="1 1.5"/>${txt(13,16.5,"BLEED 3mm",{size:4,fill:"#333"})}
      </g>
    </g>`;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${sheetW}mm" height="${sheetH}mm" viewBox="0 0 ${sheetW} ${sheetH}">
  <defs>
    <symbol id="navy" viewBox="0 0 1024 1024"><image width="1024" height="1024" xlink:href="data:image/png;base64,${navy64}"/></symbol>
    <symbol id="white" viewBox="0 0 1024 1024"><image width="1024" height="1024" xlink:href="data:image/png;base64,${white64}"/></symbol>
    <pattern id="hatch" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="3" stroke="#C9C3B2" stroke-width="0.6"/>
    </pattern>
  </defs>
  <rect width="${sheetW}" height="${sheetH}" fill="#FFFFFF"/>
  ${txt(M, M-16, "HANGUK CONSULTING — PACKAGING DIELINE", {size:6,w:800,ls:1})}
  ${txt(M, M-9, title+"  ·  scale 1:1 (millimetres)  ·  hand to printer as PDF/AI", {size:4.5,fill:"#666",w:600})}
  <g>${A.join("\n  ")}</g>
  ${bleed}
  <g>${F.join("\n  ")}</g>
  <g>${C.join("\n  ")}</g>
  ${marks}
  ${dims}${wallDims}
  ${titleBlock}
</svg>`;
  writeFileSync(`hanguk-box-kit/${file}`, svg);
  console.log(`  ${file}  sheet ${Math.round(sheetW)}×${Math.round(sheetH)} mm`);
}

console.log("building dielines:");
buildPiece({ file:"dieline-lid.svg",  title:"LID (cover)  — wraps over the tray", L:390, W:295, H:50, g:35, lidTop:true });
buildPiece({ file:"dieline-tray.svg", title:"TRAY (base)  — holds laptop + books", L:380, W:285, H:80, g:35, lidTop:false });
console.log("done.");
