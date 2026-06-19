// Hanguk Box — hero key visual (vector poster, 1600x1000).
// A clean 2.5D product shot: open navy box, lid behind, open laptop with the
// Hanguk app on screen, two staff books fanned in front. Brand colours throughout.
import { readFileSync, writeFileSync } from "node:fs";
const navy64  = readFileSync("public/brand-mark.png").toString("base64");
const white64 = readFileSync("public/brand-glyph-white.png").toString("base64");
const ROYAL="#1A3A6C",ROYAL90="#132A4D",ROYAL80="#0F213D",LIME="#D4E94C",LIMED="#B4CC19",INK="#0A1A34",CREAM="#F6F1E4";

const W=1600,H=1000;
const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const T=(x,y,s,o={})=>`<text x="${x}" y="${y}" font-family="Inter,Arial,sans-serif" font-size="${o.size||24}" fill="${o.fill||ROYAL}" font-weight="${o.w||700}" text-anchor="${o.anchor||"start"}" letter-spacing="${o.ls||0}">${esc(s)}</text>`;
const useW=(x,y,w)=>`<use href="#white" x="${x}" y="${y}" width="${w}" height="${w}"/>`;
const useN=(x,y,w)=>`<use href="#navy" x="${x}" y="${y}" width="${w}" height="${w}"/>`;

// a book: rotated rounded card with cover art
function book(cx,cy,rot,scale,lime,title1,title2,vol){
  const w=190,h=270;
  const bg = lime?`url(#bkLime)`:`url(#bkNavy)`;
  const tc = lime?ROYAL:"#FFFFFF", ac=lime?ROYAL:LIME, sub=lime?ROYAL80:"#BFD0E6";
  return `<g transform="translate(${cx},${cy}) rotate(${rot}) scale(${scale})">
    <rect x="${-w/2-6}" y="${-h/2+10}" width="${w}" height="${h}" rx="10" fill="#00000022"/>
    <rect x="${-w/2}" y="${-h/2}" width="${w}" height="${h}" rx="10" fill="${bg}"/>
    <rect x="${-w/2}" y="${-h/2}" width="14" height="${h}" rx="6" fill="${lime?LIMED:ROYAL80}"/>
    ${useW(-w/2+24,-h/2+22,42)}
    ${lime?useN(-w/2+24,-h/2+22,42):''}
    <text x="${w/2-22}" y="${-h/2+44}" font-family="Inter" font-size="15" font-weight="800" fill="${sub}" text-anchor="end" letter-spacing="2">HANGUK</text>
    <text x="${-w/2+30}" y="${h/2-78}" font-family="Inter" font-size="34" font-weight="800" fill="${tc}">${esc(title1)}</text>
    <text x="${-w/2+30}" y="${h/2-44}" font-family="Inter" font-size="34" font-weight="800" fill="${ac}">${esc(title2)}</text>
    <rect x="${-w/2+30}" y="${h/2-32}" width="70" height="6" rx="3" fill="${ac}"/>
    <text x="${-w/2+30}" y="${h/2-14}" font-family="Inter" font-size="13" font-weight="700" fill="${sub}" letter-spacing="2">STAFF · ${esc(vol)}</text>
  </g>`;
}

const svg=`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <radialGradient id="bg" cx="50%" cy="22%" r="90%">
    <stop offset="0%" stop-color="#FFFFFF"/><stop offset="48%" stop-color="${CREAM}"/><stop offset="100%" stop-color="#E7E0CD"/>
  </radialGradient>
  <linearGradient id="boxFront" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#21477F"/><stop offset="1" stop-color="${ROYAL80}"/></linearGradient>
  <linearGradient id="boxTop" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2A538C"/><stop offset="1" stop-color="${ROYAL}"/></linearGradient>
  <linearGradient id="boxSide" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ROYAL90}"/><stop offset="1" stop-color="${ROYAL80}"/></linearGradient>
  <linearGradient id="cavity" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ECE6D6"/><stop offset="1" stop-color="#D7CFB8"/></linearGradient>
  <linearGradient id="lid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#23497F"/><stop offset="1" stop-color="${ROYAL80}"/></linearGradient>
  <linearGradient id="screen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#10294f"/><stop offset="1" stop-color="#0b1c39"/></linearGradient>
  <linearGradient id="bkNavy" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#21477F"/><stop offset="1" stop-color="${ROYAL80}"/></linearGradient>
  <linearGradient id="bkLime" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${LIME}"/><stop offset="1" stop-color="${LIMED}"/></linearGradient>
  <symbol id="navy" viewBox="0 0 1024 1024"><image width="1024" height="1024" xlink:href="data:image/png;base64,${navy64}"/></symbol>
  <symbol id="white" viewBox="0 0 1024 1024"><image width="1024" height="1024" xlink:href="data:image/png;base64,${white64}"/></symbol>
</defs>

<rect width="${W}" height="${H}" fill="url(#bg)"/>

<!-- header -->
${T(110,90,"HANGUK CONSULTING",{size:20,ls:6,fill:ROYAL,w:800})}
${T(110,150,"Hanguk",{size:78,w:800,fill:ROYAL})}
${T(420,150,"Box",{size:78,w:800,fill:LIMED})}
${T(110,190,"한 jamoasi yozgan kitoblar + noutbuk — bitta premium qutida.",{size:24,fill:"#46566F",w:600})}

<!-- ground shadow -->
<ellipse cx="820" cy="830" rx="540" ry="80" fill="#0A1A3422"/>

<!-- ===== LID standing behind ===== -->
<g transform="translate(1150,300) rotate(-14)">
  <rect x="0" y="0" width="430" height="300" rx="14" fill="url(#lid)"/>
  <rect x="0" y="0" width="430" height="10" fill="${LIME}"/>
  ${useW(175,70,80)}
  <text x="215" y="205" font-family="Inter" font-size="40" font-weight="800" fill="#FFFFFF" text-anchor="middle">Hanguk <tspan fill="${LIME}">Box</tspan></text>
  <text x="215" y="235" font-family="Inter" font-size="15" font-weight="700" fill="#BFD0E6" text-anchor="middle" letter-spacing="4">LEARN · BUILD · BELONG</text>
</g>

<!-- ===== BOX (open tray, 2.5D) ===== -->
<!-- left side face -->
<polygon points="430,560 640,470 640,790 430,860" fill="url(#boxSide)"/>
<!-- front face -->
<polygon points="640,470 1180,470 1180,790 640,790" fill="url(#boxFront)"/>
<rect x="640" y="470" width="540" height="12" fill="${LIME}"/>
<!-- front branding -->
${useW(700,560,90)}
<text x="820" y="635" font-family="Inter" font-size="52" font-weight="800" fill="#FFFFFF">Hanguk <tspan fill="${LIME}">Box</tspan></text>
<text x="700" y="690" font-family="Inter" font-size="18" font-weight="700" fill="#9DB4D2" letter-spacing="6">한 · CONSULTING · han.uz</text>
<!-- top rim (open) -->
<polygon points="640,470 1180,470 970,380 430,380" fill="url(#boxTop)"/>
<!-- inner cavity -->
<polygon points="668,462 1150,462 962,388 470,388" fill="url(#cavity)"/>
<polygon points="640,470 668,462 470,388 430,380" fill="#C8C0A8"/>
<polygon points="1180,470 1150,462 962,388 970,380" fill="#BFB69E"/>

<!-- ===== OPEN LAPTOP rising from the box ===== -->
<g transform="translate(700,300)">
  <!-- screen -->
  <polygon points="40,40 360,40 410,250 90,250" fill="#cdd4de"/>
  <polygon points="52,52 348,52 396,238 100,238" fill="url(#screen)"/>
  <!-- app UI -->
  <g>
    <polygon points="52,52 348,52 356,86 60,86" fill="${ROYAL}"/>
    <use href="#white" x="70" y="56" width="26" height="26"/>
    <text x="104" y="76" font-family="Inter" font-size="18" font-weight="800" fill="#fff">HANGUK</text>
    <circle cx="338" cy="69" r="6" fill="${LIME}"/>
    <rect x="74" y="104" width="180" height="16" rx="5" fill="#ffffff22"/>
    <rect x="80" y="134" width="130" height="14" rx="5" fill="#ffffff1a"/>
    <rect x="84" y="160" width="210" height="14" rx="5" fill="#ffffff1a"/>
    <rect x="92" y="196" width="120" height="30" rx="7" fill="${LIME}"/>
    <text x="152" y="217" font-family="Inter" font-size="15" font-weight="800" fill="${INK}" text-anchor="middle">Boshlash →</text>
  </g>
  <!-- keyboard base -->
  <polygon points="90,250 410,250 470,300 30,300" fill="#c7ced8"/>
  <polygon points="120,262 380,262 410,288 90,288" fill="#aab3c0"/>
  <polygon points="220,292 280,292 290,300 210,300" fill="#9aa3b2"/>
</g>

<!-- ===== BOOKS fanned in front ===== -->
${book(560,800,-16,0.92,false,"Koreyada","O'qish","VOL.1")}
${book(900,830,12,0.96,true,"TOPIK","Master","VOL.2")}

<!-- CTA -->
<g transform="translate(1140,840)">
  <rect x="0" y="0" width="360" height="78" rx="39" fill="${ROYAL}"/>
  <text x="36" y="49" font-family="Inter" font-size="26" font-weight="800" fill="#fff">Buyurtma: <tspan fill="${LIME}">han.uz</tspan></text>
</g>
</svg>`;
writeFileSync("hanguk-box-kit/keyvisual.svg",svg);
console.log("keyvisual.svg written");
