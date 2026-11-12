// Gera narração (voz neural), trilha, efeitos sonoros e a linha do tempo do anúncio.
// Saídas: ad/timeline.js (usado pela animação) e ad/audio/{mix,narracao,trilha,efeitos}.wav
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const ffmpeg = require("ffmpeg-static");
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");
const { VOICE, RATE, SCENES } = require("./scenes.js");

const SR = 48000;
const DIR = __dirname;
const AUD = path.join(DIR, "audio");
fs.mkdirSync(path.join(AUD, "vo"), { recursive: true });

/* ---------------- utilidades de áudio ---------------- */
const buf = (s) => new Float32Array(Math.max(1, Math.ceil(s * SR)));
function addAt(dst, src, t, g = 1) {
  const o = Math.round(t * SR);
  for (let i = 0; i < src.length; i++) { const j = o + i; if (j >= 0 && j < dst.length) dst[j] += src[i] * g; }
}
let seed = 12345;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const noise = () => rnd() * 2 - 1;
const coef = (fc) => 1 - Math.exp((-2 * Math.PI * fc) / SR);
function lp(x, fc) { const a = coef(fc); let y = 0; const o = new Float32Array(x.length); for (let i = 0; i < x.length; i++) { y += a * (x[i] - y); o[i] = y; } return o; }
function hp(x, fc) { const l = lp(x, fc); const o = new Float32Array(x.length); for (let i = 0; i < x.length; i++) o[i] = x[i] - l[i]; return o; }
const bp = (x, lo, hi) => lp(hp(x, lo), hi);
const att = (i, a = 0.004) => Math.min(1, i / (a * SR));
const N = (note) => 440 * Math.pow(2, (note - 69) / 12); // MIDI -> Hz

/* ---------------- efeitos sonoros ---------------- */
function sine(f, dur, dec, amp = 1) { const o = buf(dur); let ph = 0; for (let i = 0; i < o.length; i++) { ph += (2 * Math.PI * f) / SR; o[i] = Math.sin(ph) * Math.exp(-i / SR / dec) * amp * att(i); } return o; }
function bell(f, dur = 1.4, dec = 0.5, amp = 1) {
  const o = buf(dur); const parts = [[1, 1, 1], [2.0, 0.35, 0.6], [3.01, 0.18, 0.4], [4.2, 0.08, 0.3]];
  for (const [m, a, d] of parts) { let ph = 0; for (let i = 0; i < o.length; i++) { ph += (2 * Math.PI * f * m) / SR; o[i] += Math.sin(ph) * a * Math.exp(-i / SR / (dec * d)) * att(i, 0.002) * amp; } }
  return o;
}
function tap() { const o = buf(0.05); for (let i = 0; i < o.length; i++) o[i] = noise() * Math.exp(-i / SR / 0.004); const h = hp(o, 2500); const s = sine(2100, 0.05, 0.008, 0.5); for (let i = 0; i < h.length; i++) h[i] = h[i] * 0.6 + s[i]; return h; }
function pop(f) { const o = buf(0.25); let ph = 0; for (let i = 0; i < o.length; i++) { const t = i / SR; const fr = f * (1 + Math.exp(-t / 0.018)); ph += (2 * Math.PI * fr) / SR; o[i] = Math.sin(ph) * Math.exp(-t / 0.09) * att(i, 0.001); } addAt(o, tap(), 0, 0.5); return o; }
function flip() { const o = buf(0.09); for (let i = 0; i < o.length; i++) { const t = i / SR; o[i] = noise() * Math.min(1, t / 0.008) * Math.exp(-t / 0.03); } return bp(o, 1500, 6000); }
function whoosh(dur = 0.45, amp = 1) {
  const o = buf(dur); let y = 0;
  for (let i = 0; i < o.length; i++) { const p = i / o.length; const fc = 300 + 4200 * Math.sin(Math.PI * p) ** 2; y += coef(fc) * (noise() - y); o[i] = y * Math.sin(Math.PI * p) ** 2 * amp * 1.6; }
  return o;
}
function impact(amp = 1) {
  const o = buf(0.9); let ph = 0;
  for (let i = 0; i < o.length; i++) { const t = i / SR; const f = 38 + 50 * Math.exp(-t / 0.08); ph += (2 * Math.PI * f) / SR; o[i] = Math.sin(ph) * Math.exp(-t / 0.35) * att(i, 0.002); }
  const n = buf(0.1); for (let i = 0; i < n.length; i++) n[i] = noise() * Math.exp(-i / SR / 0.02); addAt(o, lp(n, 1200), 0, 0.6);
  for (let i = 0; i < o.length; i++) o[i] = Math.tanh(o[i] * 1.4) * amp; return o;
}
function scribble(dur = 0.5) {
  const o = buf(dur); let g = 0, tgt = 0;
  for (let i = 0; i < o.length; i++) { if (i % 900 === 0) tgt = rnd() < 0.7 ? 0.5 + rnd() * 0.5 : 0.1; g += (tgt - g) * 0.004; const p = i / o.length; o[i] = noise() * g * Math.min(1, p * 10) * Math.min(1, (1 - p) * 6); }
  return bp(o, 1200, 5000);
}
function chime(notes, gap = 0.07, amp = 0.6, dec = 0.5) { const o = buf(gap * notes.length + 1.6); notes.forEach((n, k) => addAt(o, bell(N(n), 1.5, dec, amp), k * gap)); return o; }
function sparkle(dur = 0.9, n = 18) { const o = buf(dur + 0.3); for (let k = 0; k < n; k++) addAt(o, sine(3000 + rnd() * 3500, 0.12, 0.03, 0.18), rnd() * dur); return o; }
function tick(f = 3200, amp = 0.25) { return sine(f, 0.03, 0.008, amp); }
function padTone(f) { const o = buf(0.5); let ph = 0; for (let i = 0; i < o.length; i++) { const t = i / SR; ph += (2 * Math.PI * f) / SR; const tri = (2 / Math.PI) * Math.asin(Math.sin(ph)); o[i] = (Math.sin(ph) * 0.7 + tri * 0.3) * Math.exp(-t / 0.22) * att(i, 0.004); } return o; }
function bloop() { const o = buf(0.22); let ph = 0; for (let i = 0; i < o.length; i++) { const t = i / SR; const f = 350 + 650 * Math.min(1, t / 0.1); ph += (2 * Math.PI * f) / SR; o[i] = Math.sin(ph) * Math.exp(-t / 0.08) * att(i); } return o; }
function riser(dur) { const o = buf(dur); let y = 0; for (let i = 0; i < o.length; i++) { const p = i / o.length; y += coef(200 * Math.pow(40, p)) * (noise() - y); o[i] = y * p * p * 1.8; } return o; }

/* ---------------- narração ---------------- */
async function tts(text) {
  const h = crypto.createHash("md5").update(VOICE + RATE + text).digest("hex").slice(0, 10);
  const dir = path.join(AUD, "vo", h); const mp3 = path.join(dir, "audio.mp3");
  if (!fs.existsSync(mp3)) {
    fs.mkdirSync(dir, { recursive: true });
    const t = new MsEdgeTTS();
    await t.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    await t.toFile(dir, text, { rate: RATE });
    t.close && t.close();
  }
  const r = spawnSync(ffmpeg, ["-v", "error", "-i", mp3, "-af",
    "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,highpass=f=70,acompressor=threshold=-20dB:ratio=3:attack=5:release=120:makeup=2",
    "-ar", String(SR), "-ac", "1", "-f", "f32le", "-"], { maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(String(r.stderr));
  const b = r.stdout; return new Float32Array(b.buffer, b.byteOffset, b.length / 4).slice();
}

/* ---------------- legendas ---------------- */
function chunks(text) {
  const words = text.replace(/\.\.\./g, "…").split(/\s+/); const out = []; let cur = [];
  for (const w of words) { cur.push(w); if (cur.length >= 5 || (/[.,?!:…]$/.test(w) && cur.length >= 2)) { out.push(cur.join(" ")); cur = []; } }
  if (cur.length) { if (out.length && cur.length === 1) out[out.length - 1] += " " + cur[0]; else out.push(cur.join(" ")); }
  return out;
}

/* ---------------- trilha ---------------- */
function music(total, brandAt, gamesAt, gamesEnd, ctaAt) {
  const L = buf(total + 2); const BEAT = 60 / 96;
  // seção escura: pad em Lá menor + batida de coração
  const darkPad = [45, 48, 52, 57];
  for (const n of darkPad) {
    const f = N(n); let p1 = 0, p2 = 0;
    for (let i = 0; i < Math.min(L.length, (brandAt + 0.3) * SR); i++) {
      const t = i / SR; p1 += f / SR; p2 += (f * 1.004) / SR;
      const saw = ((p1 % 1) * 2 - 1 + (p2 % 1) * 2 - 1) * 0.5;
      const sw = Math.min(1, t / 1.2) * Math.min(1, Math.max(0, (brandAt + 0.3 - t) / 0.3));
      L[i] += saw * 0.05 * sw;
    }
  }
  const darkL = lp(L, 700); L.set(darkL);
  for (let t = 0.3; t < brandAt - 0.4; t += BEAT * 2) { addAt(L, impact(0.35), t); addAt(L, impact(0.2), t + 0.2); }
  addAt(L, riser(1.6), brandAt - 1.6, 0.35);

  // seção principal: Lá m – Fá – Dó – Sol
  const prog = [[57, 60, 64, 45], [53, 57, 60, 41], [60, 64, 67, 48], [55, 59, 62, 43]];
  const BAR = BEAT * 4; const end = total + 0.5;
  const pad = buf(total + 2), pluck = buf(total + 2), drums = buf(total + 2);
  for (let bar = 0; brandAt + bar * BAR < end; bar++) {
    const t0 = brandAt + bar * BAR; const ch = prog[bar % 4];
    // pad
    for (const n of ch.slice(0, 3)) {
      const f = N(n); let p1 = rnd(), p2 = rnd();
      const len = Math.min(BAR + 0.2, end - t0) * SR, o0 = Math.round(t0 * SR);
      for (let i = 0; i < len; i++) { const j = o0 + i; if (j >= pad.length) break; p1 += f / SR; p2 += (f * 1.006) / SR; const e = Math.min(1, i / (0.08 * SR)) * Math.min(1, (len - i) / (0.15 * SR)); pad[j] += ((p1 % 1) - 0.5 + (p2 % 1) - 0.5) * 0.045 * e; }
    }
    // baixo
    for (const bt of [0, 1.5, 2, 3.5]) { const t = t0 + bt * BEAT; if (t < end) addAt(drums, sine(N(ch[3]), 0.5, bt % 2 ? 0.12 : 0.25, 0.32), t); }
    // arpejo
    const arp = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[1] + 12, ch[2] + 12, ch[0] + 24, ch[2] + 12, ch[1] + 12];
    arp.forEach((n, k) => { const t = t0 + k * BEAT / 2; if (t < end) addAt(pluck, padTone(N(n)), t, 0.16); });
    // bateria
    for (let b = 0; b < 4; b++) {
      const t = t0 + b * BEAT; if (t >= end - 0.05) break;
      if (b === 0 || b === 2) addAt(drums, kick(), t, 0.75);
      const ht = t + BEAT / 2; const hh = buf(0.05); for (let i = 0; i < hh.length; i++) hh[i] = noise() * Math.exp(-i / SR / 0.012); addAt(drums, hp(hh, 7000), ht, 0.22);
      if ((b === 1 || b === 3) && t >= gamesAt && t < gamesEnd) addAt(drums, clap(), t, 0.4);
    }
  }
  const padF = lp(pad, 1600);
  addAt(L, padF, 0); addAt(L, lp(pluck, 3500), 0); addAt(L, drums, 0);
  addAt(L, impact(0.6), brandAt);
  // final: corta a bateria e deixa o acorde soar
  const fadeAt = total - 0.9; for (let i = Math.round(fadeAt * SR); i < L.length; i++) L[i] *= Math.max(0, 1 - (i / SR - fadeAt) / 0.9);
  return L;
}
function kick() { const o = buf(0.35); let ph = 0; for (let i = 0; i < o.length; i++) { const t = i / SR; const f = 45 + 90 * Math.exp(-t / 0.035); ph += (2 * Math.PI * f) / SR; o[i] = Math.tanh(Math.sin(ph) * 1.6) * Math.exp(-t / 0.16); } return o; }
function clap() { const o = buf(0.2); for (const d of [0, 0.011, 0.022]) { const s = Math.round(d * SR); for (let i = s; i < o.length; i++) o[i] += noise() * Math.exp(-(i - s) / SR / (d === 0.022 ? 0.06 : 0.008)); } return bp(o, 900, 3500); }

function reverb(x, wet = 0.2) {
  const sc = SR / 44100; const combs = [1557, 1617, 1491, 1422, 1277, 1356].map((d) => Math.round(d * sc)); const aps = [556, 441, 341].map((d) => Math.round(d * sc));
  const out = new Float32Array(x.length);
  for (const d of combs) { const b = new Float32Array(d); let idx = 0, f = 0; for (let i = 0; i < x.length; i++) { const y = b[idx]; f = y * 0.7 + f * 0.3; b[idx] = x[i] + f * 0.8; out[i] += y / combs.length; idx = (idx + 1) % d; } }
  for (const d of aps) { const b = new Float32Array(d); let idx = 0; for (let i = 0; i < out.length; i++) { const bv = b[idx]; const y = -out[i] + bv; b[idx] = out[i] + bv * 0.5; out[i] = y; idx = (idx + 1) % d; } }
  const r = new Float32Array(x.length); for (let i = 0; i < x.length; i++) r[i] = x[i] + out[i] * wet; return r;
}

function writeWav(file, x, gain = 1) {
  const n = x.length; const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(x[i] * gain * 32767))), 44 + i * 2);
  fs.writeFileSync(file, b);
}
const peak = (x) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

/* ---------------- montagem ---------------- */
(async () => {
  // 1) narração e durações
  let t = 0; const scenes = []; const voClips = []; const captions = [];
  for (const s of SCENES) {
    let need = s.min;
    for (const v of s.vo) {
      const pcm = await tts(v.text); const len = pcm.length / SR;
      voClips.push({ at: t + v.t, pcm });
      need = Math.max(need, v.t + len + 0.45);
      const cs = v.cap ? v.cap.split("|") : chunks(v.text); const w = cs.map((c) => c.length + (/[.,?!:…]$/.test(c) ? 6 : 0)); const W = w.reduce((a, b) => a + b, 0);
      let c0 = t + v.t; cs.forEach((c, k) => { const d = (len * w[k]) / W; captions.push({ t0: c0, t1: c0 + d, text: c }); c0 += d; });
      process.stdout.write(`voz ok: ${v.text.slice(0, 40)}… (${len.toFixed(2)}s)\n`);
    }
    scenes.push({ id: s.id, start: +t.toFixed(3), dur: +need.toFixed(3), ev: s.ev });
    t += need;
  }
  const total = +t.toFixed(3);
  for (let k = 0; k < captions.length - 1; k++) captions[k].t1 = Math.min(Math.max(captions[k].t1, captions[k].t0 + 0.35), captions[k + 1].t0);
  const S = Object.fromEntries(scenes.map((s) => [s.id, s]));
  const at = (id, key, k = 0) => S[id].start + S[id].ev[key][k];

  // 2) efeitos
  const fx = buf(total + 2);
  scenes.forEach((s, k) => { if (k > 0) addAt(fx, whoosh(0.4, 0.5), s.start - 0.2); });
  S.lock.ev.notif.forEach((_, k) => { addAt(fx, bell(N(88), 1, 0.3, 0.45), at("lock", "notif", k)); addAt(fx, bell(N(95), 1, 0.3, 0.4), at("lock", "notif", k) + 0.1); });
  S.mech.ev.line.forEach((_, k) => addAt(fx, impact(k === 2 ? 0.9 : 0.55), at("mech", "line", k)));
  addAt(fx, scribble(0.55), at("mech", "hand"), 0.5);
  addAt(fx, scribble(0.45), at("brand", "write"), 0.55); addAt(fx, chime([79, 84], 0.08, 0.35), at("brand", "write") + 0.35);
  addAt(fx, bell(N(88), 1, 0.3, 0.45), at("home", "notif")); addAt(fx, bell(N(95), 1, 0.3, 0.4), at("home", "notif") + 0.1);
  addAt(fx, whoosh(0.4, 0.9), at("home", "swipe")); addAt(fx, tap(), at("home", "tap")); addAt(fx, bloop(), at("home", "tap") + 0.03, 0.5);
  S.games.ev.seg.forEach((_, k) => k && addAt(fx, whoosh(0.35, 0.7), at("games", "seg", k) - 0.15));
  S.games.ev.hit.forEach((_, k) => addAt(fx, pop(520 * Math.pow(1.122, k)), at("games", "hit", k), 0.6));
  S.games.ev.flip.forEach((_, k) => { addAt(fx, tap(), at("games", "flip", k), 0.6); addAt(fx, flip(), at("games", "flip", k), 0.5); if (k % 2) addAt(fx, chime([76 + k, 83 + k], 0.06, 0.4, 0.3), at("games", "flip", k) + 0.12); });
  const padNotes = [72, 76, 79, 84], seq = [0, 2, 1, 3];
  S.games.ev.show.forEach((_, k) => addAt(fx, padTone(N(padNotes[seq[k]])), at("games", "show", k), 0.45));
  S.games.ev.press.forEach((_, k) => { addAt(fx, tap(), at("games", "press", k), 0.5); addAt(fx, padTone(N(padNotes[seq[k]])), at("games", "press", k), 0.45); });
  addAt(fx, chime([76, 79, 83, 88], 0.06, 0.5), at("games", "win"));
  addAt(fx, tap(), at("reward", "tap")); addAt(fx, whoosh(0.35, 0.6), at("reward", "tap") + 0.05);
  addAt(fx, chime([72, 76, 79, 84, 88], 0.07, 0.55), at("reward", "open")); addAt(fx, sparkle(1.0, 22), at("reward", "open") + 0.1);
  addAt(fx, bloop(), at("vault", "pill"), 0.6);
  for (let x = at("vault", "count", 0); x < at("vault", "count", 1); x += 0.07) addAt(fx, tick(2600 + rnd() * 400, 0.12), x);
  addAt(fx, bell(N(91), 1.2, 0.4, 0.35), at("vault", "count", 1)); addAt(fx, scribble(0.5), at("vault", "keep"), 0.4);
  for (let k = 0; k < 12; k++) addAt(fx, tick(1800 * Math.pow(1.06, k), 0.2), at("progress", "fill", 0) + (k * (S.progress.ev.fill[1] - S.progress.ev.fill[0])) / 11);
  addAt(fx, chime([84, 88, 91], 0.0, 0.3, 0.7), at("progress", "medal")); addAt(fx, sparkle(0.6, 10), at("progress", "medal"));
  addAt(fx, impact(0.5), at("bonus", "coin")); addAt(fx, chime([72, 76, 79, 84, 88], 0.07, 0.5), at("bonus", "coin") + 0.05); addAt(fx, sparkle(0.9, 18), at("bonus", "coin") + 0.1);
  addAt(fx, impact(0.75), at("bonus", "tag")); addAt(fx, tap(), at("bonus", "tag"), 0.8);
  addAt(fx, whoosh(0.45, 0.7), at("cta", "card") - 0.1); addAt(fx, impact(0.4), at("cta", "tag"));
  addAt(fx, tap(), at("cta", "tap")); addAt(fx, chime([72, 79, 84], 0.06, 0.45), at("cta", "tap") + 0.05);

  // 3) voz, trilha e mixagem
  const vo = buf(total + 2); voClips.forEach((c) => addAt(vo, c.pcm, c.at)); const vg = 0.92 / (peak(vo) || 1); for (let i = 0; i < vo.length; i++) vo[i] *= vg;
  const mus = reverb(music(total, S.brand.start, S.games.start, S.reward.start, S.cta.start), 0.22);
  const fxr = reverb(fx, 0.15);
  // abaixa a trilha quando a voz fala
  let env = 0; const duck = new Float32Array(vo.length);
  for (let i = 0; i < vo.length; i++) { const a = Math.abs(vo[i]); env = a > env ? env + (a - env) * 0.01 : env + (a - env) * 0.00009; duck[i] = 1 - 0.5 * Math.min(1, env / 0.06); }
  const musG = 0.5 / (peak(mus) || 1), fxG = 0.55 / (peak(fxr) || 1);
  const mix = buf(total + 0.4);
  for (let i = 0; i < mix.length; i++) mix[i] = Math.tanh((vo[i] * 1.0 + mus[i] * musG * duck[i] + fxr[i] * fxG) * 0.95);
  writeWav(path.join(AUD, "mix.wav"), mix);
  writeWav(path.join(AUD, "narracao.wav"), vo.subarray(0, mix.length));
  writeWav(path.join(AUD, "trilha.wav"), mus.subarray(0, mix.length), musG);
  writeWav(path.join(AUD, "efeitos.wav"), fxr.subarray(0, mix.length), fxG);

  fs.writeFileSync(path.join(DIR, "timeline.js"), "window.__TL = " + JSON.stringify({ total, scenes, captions }, null, 1) + ";\n");
  console.log(`linha do tempo: ${total}s, ${scenes.length} cenas, ${captions.length} legendas`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
