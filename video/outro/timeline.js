// Linha do tempo do vídeo de final (usada pela animação e pelo áudio, para o som bater com cada letra).
(function (root) {
  const L1 = "Fique 7 dias sem apostar", L2 = "e ganhe", L3 = "R$ 50";
  let s = 11; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const chars = []; let t = 0.95;
  for (const ch of L1) { chars.push({ line: 1, ch, t }); t += ch === " " ? 0.09 : 0.048 + r() * 0.04; }
  t += 0.3;
  for (const ch of L2) { chars.push({ line: 2, ch, t }); t += ch === " " ? 0.09 : 0.055 + r() * 0.035; }
  t += 0.34;
  for (const ch of L3) { chars.push({ line: 3, ch, t }); t += 0.11 + r() * 0.035; }
  const pop = chars[chars.length - 1].t + 0.1;
  const dots = Array.from({ length: 7 }, (_, i) => pop + 0.55 + i * 0.09);
  const T = { L1, L2, L3, chars, logo: 0.1, write: 0.45, pop, dots, sub: pop + 1.35, dur: +(pop + 2.7).toFixed(2) };
  if (typeof module !== "undefined" && module.exports) module.exports = T; else root.OUTRO = T;
})(this);
