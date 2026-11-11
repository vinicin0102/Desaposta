// Grava o anúncio quadro a quadro (1080x1920, 30 fps) e junta com o áudio.
// Uso:  node ad/render.js              -> desaposta-anuncio.mp4 (com legendas) e desaposta-anuncio-sem-legenda.mp4
//       node ad/render.js --stills 2,10 -> PNGs desses segundos em ad/stills (com legendas)
const puppeteer = require("puppeteer-core");
const ffmpeg = require("ffmpeg-static");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const FPS = 30;
const CHROME = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find((p) => fs.existsSync(p));
const OUT = path.resolve(__dirname, "..");

async function open(browser, captions) {
  const page = await browser.newPage();
  await page.setViewport({ width: 540, height: 960, deviceScaleFactor: 2 });
  const url = "file:///" + path.resolve(__dirname, "ad.html").replace(/\\/g, "/") + "?render=1" + (captions ? "&captions=1" : "");
  page.on("pageerror", (e) => console.error("erro na página:", e.message));
  await page.goto(url, { waitUntil: "networkidle0" });
  await page.evaluate(() => window.__ready);
  return page;
}

async function video(browser, captions, name) {
  const page = await open(browser, captions);
  const stage = await page.$("#stage");
  const DUR = await page.evaluate(() => window.__DUR);
  const N = Math.round(DUR * FPS);
  const out = path.join(OUT, name);
  const ff = spawn(ffmpeg, ["-y", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-",
    "-i", path.join(__dirname, "audio", "mix.wav"),
    "-map", "0:v", "-map", "1:a",
    "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
    "-shortest", "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });
  for (let i = 0; i < N; i++) {
    await page.evaluate((t) => window.__render(t), i / FPS);
    const b = await stage.screenshot({ type: "png" });
    if (!ff.stdin.write(b)) await new Promise((r) => ff.stdin.once("drain", r));
    if (i % 150 === 0) console.log(`${name}: quadro ${i}/${N}`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  await page.close();
  console.log("pronto:", out);
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--hide-scrollbars", "--force-color-profile=srgb", "--allow-file-access-from-files"] });
  const si = process.argv.indexOf("--stills");
  if (si > -1) {
    const page = await open(browser, true); const stage = await page.$("#stage");
    const dir = path.join(__dirname, "stills"); fs.mkdirSync(dir, { recursive: true });
    for (const s of process.argv[si + 1].split(",").map(Number)) {
      await page.evaluate((t) => window.__render(t), s);
      await stage.screenshot({ path: path.join(dir, `t${String(s).replace(".", "_")}.png`) });
    }
  } else {
    await video(browser, true, "desaposta-anuncio.mp4");
    if (!process.argv.includes("--so-legendado")) await video(browser, false, "desaposta-anuncio-sem-legenda.mp4");
  }
  await browser.close();
})();
