// Monta a pasta public/ que a Vercel publica.
// - copia a página e a VSL
// - pega todas as imagens de depoimentos/, reduz para carregar rápido e gera depoimentos/lista.json
// Rodado automaticamente pela Vercel a cada commit (ver vercel.json).
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "public");
const SRC = path.join(ROOT, "depoimentos");
const SITE_FILES = ["index.html", "vsl.mp4", "vsl-poster.jpg"];

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, "depoimentos"), { recursive: true });
  for (const f of SITE_FILES) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));

  let sharp = null;
  try { sharp = require("sharp"); } catch (e) { console.log("sharp indisponível: usando as imagens originais"); }

  const files = fs.existsSync(SRC)
    ? fs.readdirSync(SRC).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }))
    : [];

  const imagens = [];
  for (const [i, f] of files.entries()) {
    const input = path.join(SRC, f);
    if (sharp) {
      try {
        const name = `${i + 1}.webp`;
        const info = await sharp(input).rotate().resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(OUT, "depoimentos", name));
        imagens.push({ arquivo: `depoimentos/${name}`, largura: info.width, altura: info.height });
        continue;
      } catch (e) { console.log(`não consegui otimizar ${f}: ${e.message}`); }
    }
    const name = `${i + 1}${path.extname(f).toLowerCase()}`;
    fs.copyFileSync(input, path.join(OUT, "depoimentos", name));
    imagens.push({ arquivo: `depoimentos/${name}` });
  }

  fs.writeFileSync(path.join(OUT, "depoimentos", "lista.json"), JSON.stringify({ imagens }, null, 2) + "\n");
  console.log(`site pronto em public/ com ${imagens.length} depoimento(s)`);
})().catch((e) => { console.error(e); process.exit(1); });
