// Gera o áudio (digitação, brilho, ticks) e grava o final de criativo em 9:16 e 4:5.
// Uso (dentro da pasta video):  node outro/build.js          -> MP4 em ../criativos/
//                                node outro/build.js --stills 1,3,5  -> PNGs em outro/stills
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const ffmpeg = require("ffmpeg-static");
const puppeteer = require("puppeteer-core");
const T = require("./timeline.js");

const SR = 48000, FPS = 30;
const OUT = path.resolve(__dirname, "..", "..", "criativos");
const CHROME = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find((p) => fs.existsSync(p));

/* ---------- áudio ---------- */
let seed = 77; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const noise = () => rnd() * 2 - 1;
const buf = (s) => new Float32Array(Math.ceil(s * SR));
const coef = (fc) => 1 - Math.exp((-2 * Math.PI * fc) / SR);
function lp(x, fc) { const a = coef(fc); let y = 0; return x.map((v) => (y += a * (v - y))); }
function hp(x, fc) { const l = lp(x, fc); return x.map((v, i) => v - l[i]); }
function addAt(d, s, t, g = 1) { const o = Math.round(t * SR); for (let i = 0; i < s.length; i++) { const j = o + i; if (j >= 0 && j < d.length) d[j] += s[i] * g; } }
function sine(f, dur, dec, amp = 1) { const o = buf(dur); let ph = 0; for (let i = 0; i < o.length; i++) { ph += (2 * Math.PI * f) / SR; o[i] = Math.sin(ph) * Math.exp(-i / SR / dec) * amp * Math.min(1, i / (0.002 * SR)); } return o; }
function bell(f, dur = 1.4, dec = 0.5, amp = 1) { const o = buf(dur); for (const [m, a, d] of [[1, 1, 1], [2, .35, .6], [3.01, .16, .4], [4.2, .07, .3]]) { let ph = 0; for (let i = 0; i < o.length; i++) { ph += (2 * Math.PI * f * m) / SR; o[i] += Math.sin(ph) * a * Math.exp(-i / SR / (dec * d)) * amp * Math.min(1, i / (0.002 * SR)); } } return o; }
// tecla: "clack" de plástico + batida grave + soltura da tecla
function key(space) {
  const o = buf(0.16), n = buf(0.03);
  for (let i = 0; i < n.length; i++) n[i] = noise() * Math.exp(-i / SR / (space ? 0.006 : 0.0035));
  addAt(o, lp(hp(n, space ? 700 : 1400), space ? 3500 : 6500), 0, space ? 0.8 : 1);
  addAt(o, sine(space ? 95 : 140 + rnd() * 40, 0.05, 0.012, space ? 0.55 : 0.35), 0);
  const up = buf(0.02); for (let i = 0; i < up.length; i++) up[i] = noise() * Math.exp(-i / SR / 0.002);
  addAt(o, hp(up, 2500), 0.045 + rnd() * 0.035, 0.28);
  return o;
}
function whoosh(dur, amp = 1) { const o = buf(dur); let y = 0; for (let i = 0; i < o.length; i++) { const p = i / o.length; y += coef(300 + 4000 * Math.sin(Math.PI * p) ** 2) * (noise() - y); o[i] = y * Math.sin(Math.PI * p) ** 2 * amp * 1.6; } return o; }
function scribble(dur) { const o = buf(dur); let g = 0, tg = 0; for (let i = 0; i < o.length; i++) { if (i % 900 === 0) tg = rnd() < .7 ? .5 + rnd() * .5 : .1; g += (tg - g) * .004; const p = i / o.length; o[i] = noise() * g * Math.min(1, p * 10) * Math.min(1, (1 - p) * 6); } return lp(hp(o, 1200), 5000); }
function boom(amp) { const o = buf(0.9); let ph = 0; for (let i = 0; i < o.length; i++) { const t = i / SR; ph += (2 * Math.PI * (40 + 55 * Math.exp(-t / .07))) / SR; o[i] = Math.tanh(Math.sin(ph) * 1.4) * Math.exp(-t / .32) * amp; } return o; }
const N = (m) => 440 * Math.pow(2, (m - 69) / 12);

function audio() {
  const dur = T.dur + 0.3, fx = buf(dur), bed = buf(dur);
  // fundo: acorde suave
  for (const m of [48, 55, 60, 64, 67]) { let a = rnd(), b = rnd(); const f = N(m); for (let i = 0; i < bed.length; i++) { const t = i / SR; a += f / SR; b += (f * 1.005) / SR; const e = Math.min(1, t / 0.8) * Math.min(1, (dur - t) / 0.5); bed[i] += ((a % 1) - .5 + (b % 1) - .5) * .03 * e; } }
  const bedF = lp(bed, 900);
  addAt(fx, whoosh(0.5, .55), 0); addAt(fx, boom(.45), T.logo + .05);
  addAt(fx, scribble(.42), T.write, .45);
  T.chars.forEach((c) => addAt(fx, key(c.ch === " "), c.t, c.line === 3 ? 1.1 : 0.85 + rnd() * .2));
  addAt(fx, boom(.6), T.pop); [72, 76, 79, 84, 88].forEach((m, k) => addAt(fx, bell(N(m), 1.6, .55, .38), T.pop + k * .06));
  for (let k = 0; k < 16; k++) addAt(fx, sine(3000 + rnd() * 3500, .12, .03, .14), T.pop + rnd() * .8);
  T.dots.forEach((t, i) => addAt(fx, i === 6 ? bell(N(91), 1.2, .45, .35) : sine(1600 * Math.pow(1.08, i), .05, .012, .3), t));
  addAt(fx, whoosh(.4, .3), T.sub - .1);
  const mix = buf(dur); for (let i = 0; i < mix.length; i++) mix[i] = Math.tanh((fx[i] + bedF[i]) * 0.9);
  const peak = mix.reduce((m, v) => Math.max(m, Math.abs(v)), 0); const g = 0.95 / peak;
  const b = Buffer.alloc(44 + mix.length * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + mix.length * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(mix.length * 2, 40);
  for (let i = 0; i < mix.length; i++) b.writeInt16LE(Math.round(mix[i] * g * 32767), 44 + i * 2);
  const f = path.join(__dirname, "audio.wav"); fs.writeFileSync(f, b); return f;
}

/* ---------- vídeo ---------- */
async function open(browser, h) {
  const p = await browser.newPage(); await p.setViewport({ width: 540, height: h, deviceScaleFactor: 2 });
  p.on("pageerror", (e) => console.error("erro:", e.message));
  await p.goto("file:///" + path.join(__dirname, "outro.html").replace(/\\/g, "/") + "?render=1&h=" + h, { waitUntil: "networkidle0" });
  await p.evaluate(() => window.__ready); return p;
}
async function render(browser, h, wav, name) {
  const p = await open(browser, h), stage = await p.$("#stage"), n = Math.round(T.dur * FPS);
  const ff = spawn(ffmpeg, ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-", "-i", wav,
    "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest", "-movflags", "+faststart", path.join(OUT, name)], { stdio: ["pipe", "inherit", "inherit"] });
  for (let i = 0; i < n; i++) { await p.evaluate((t) => window.__render(t), i / FPS); const b = await stage.screenshot({ type: "png" }); if (!ff.stdin.write(b)) await new Promise((r) => ff.stdin.once("drain", r)); }
  ff.stdin.end(); await new Promise((r) => ff.on("close", r)); await p.close(); console.log("pronto:", name);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--hide-scrollbars", "--force-color-profile=srgb"] });
  const si = process.argv.indexOf("--stills");
  if (si > -1) {
    const dir = path.join(__dirname, "stills"); fs.mkdirSync(dir, { recursive: true });
    for (const h of [960, 675]) { const p = await open(browser, h), st = await p.$("#stage"); for (const s of process.argv[si + 1].split(",").map(Number)) { await p.evaluate((t) => window.__render(t), s); await st.screenshot({ path: path.join(dir, `h${h}-t${String(s).replace(".", "_")}.png`) }); } await p.close(); }
  } else {
    const wav = audio();
    await render(browser, 960, wav, "final-7dias-stories-1080x1920.mp4");
    await render(browser, 675, wav, "final-7dias-feed-1080x1350.mp4");
  }
  await browser.close();
  console.log("duração:", T.dur, "s");
})();
