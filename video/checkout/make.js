// Gera as imagens do checkout.
// 1) captura telas do app a partir da animação do anúncio (sem legendas)
// 2) renderiza cada arte de checkout.html em PNG na pasta imagens-checkout/
const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

const CHROME = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find((p) => fs.existsSync(p));
const SHOTS = path.join(__dirname, "shots");
const OUT = path.resolve(__dirname, "..", "..", "imagens-checkout");
const fileUrl = (p) => "file:///" + p.replace(/\\/g, "/");

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--hide-scrollbars", "--force-color-profile=srgb", "--allow-file-access-from-files"] });

  // telas do app (momentos da linha do tempo do anúncio)
  const ad = await browser.newPage();
  await ad.setViewport({ width: 540, height: 960, deviceScaleFactor: 2 });
  await ad.goto(fileUrl(path.resolve(__dirname, "..", "ad", "ad.html")) + "?render=1", { waitUntil: "networkidle0" });
  await ad.evaluate(() => window.__ready);
  const at = await ad.evaluate(() => { const S = Object.fromEntries(window.__TL.scenes.map((s) => [s.id, s.start])); return { home: S.home + 2.6, games: S.games + 4.45, reward: S.reward + 3.6, vault: S.vault + 2.6, seq: S.games + 7.3 }; });
  const stage = await ad.$("#stage");
  for (const [name, t] of Object.entries(at)) {
    await ad.evaluate((x) => { window.__render(x); document.getElementById("touch").style.visibility = "hidden"; document.getElementById("ripple").style.visibility = "hidden"; }, t);
    await stage.screenshot({ path: path.join(SHOTS, name + ".png") });
  }
  await ad.close();

  // artes
  const page = await browser.newPage();
  await page.setViewport({ width: 2000, height: 1400, deviceScaleFactor: 1 });
  await page.goto(fileUrl(path.join(__dirname, "checkout.html")), { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  const arts = await page.$$eval("[data-out]", (els) => els.map((e) => e.dataset.out));
  for (const name of arts) {
    const el = await page.$(`[data-out="${name}"]`);
    await page.evaluate((transp) => { document.body.style.background = transp ? "transparent" : ""; }, name.includes("selo"));
    await el.screenshot({ path: path.join(OUT, name), omitBackground: name.includes("selo") });
    console.log("ok", name);
  }
  await browser.close();
})();
