// Gera os criativos estáticos (PNG) a partir de criativos.html, na pasta criativos/ da raiz do projeto.
// Uso (dentro da pasta video):  node criativos/make.js
const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

const CHROME = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find((p) => fs.existsSync(p));
const OUT = path.resolve(__dirname, "..", "..", "criativos");

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--hide-scrollbars", "--force-color-profile=srgb"] });
  const p = await b.newPage();
  await p.setViewport({ width: 2400, height: 2200, deviceScaleFactor: 1 });
  await p.goto("file:///" + path.join(__dirname, "criativos.html").replace(/\\/g, "/"), { waitUntil: "networkidle0" });
  await p.evaluate(() => document.fonts.ready);
  for (const name of await p.$$eval("[data-out]", (els) => els.map((e) => e.dataset.out))) {
    await (await p.$(`[data-out="${name}"]`)).screenshot({ path: path.join(OUT, name) });
    console.log("ok", name);
  }
  await b.close();
})();
