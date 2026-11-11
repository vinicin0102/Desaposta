// Grava app-demo.html quadro a quadro em MP4 1080x1920 (30 fps).
// Uso:  node render.js                 -> gera desaposta-app-demo.mp4
//       node render.js --stills 3,7,12 -> salva PNGs desses segundos em ./stills
const puppeteer = require("puppeteer-core");
const ffmpeg = require("ffmpeg-static");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const FPS = 30;
const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find((p) => fs.existsSync(p));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--hide-scrollbars", "--force-color-profile=srgb", "--font-render-hinting=none"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 540, height: 960, deviceScaleFactor: 2 });
  const url = "file:///" + path.resolve(__dirname, "app-demo.html").replace(/\\/g, "/") + "?render=1";
  await page.goto(url, { waitUntil: "networkidle0" });
  await page.evaluate(() => window.__ready);
  const stage = await page.$("#stage");

  const si = process.argv.indexOf("--stills");
  if (si > -1) {
    const dir = path.resolve(__dirname, "stills");
    fs.mkdirSync(dir, { recursive: true });
    for (const s of process.argv[si + 1].split(",").map(Number)) {
      await page.evaluate((t) => window.__render(t), s);
      await stage.screenshot({ path: path.join(dir, `t${String(s).replace(".", "_")}.png`) });
    }
    await browser.close();
    console.log("stills ok");
    return;
  }

  const DUR = await page.evaluate(() => window.__DUR);
  const N = Math.round(DUR * FPS);
  const out = path.resolve(__dirname, "desaposta-app-demo.mp4");
  const ff = spawn(ffmpeg, [
    "-y", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-pix_fmt", "yuv420p",
    "-r", String(FPS), "-movflags", "+faststart", out,
  ], { stdio: ["pipe", "inherit", "inherit"] });

  for (let i = 0; i < N; i++) {
    await page.evaluate((t) => window.__render(t), i / FPS);
    const buf = await stage.screenshot({ type: "png" });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (i % 90 === 0) console.log(`quadro ${i}/${N}`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  await browser.close();
  console.log("pronto:", out);
})();
