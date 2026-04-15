import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createCanvas } from "@napi-rs/canvas";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const assetsDir = path.resolve(__dirname, "../src/assets");
const repoRoot = path.resolve(__dirname, "../..");

class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    return { canvas, context };
  }

  reset(target, width, height) {
    target.canvas.width = width;
    target.canvas.height = height;
  }

  destroy(target) {
    target.canvas.width = 0;
    target.canvas.height = 0;
  }
}

function knockOutNearWhite(target, threshold = 246) {
  const imageData = target.context.getImageData(0, 0, target.canvas.width, target.canvas.height);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const alpha = data[index + 3];

    if (alpha === 0) continue;

    if (red >= threshold && green >= threshold && blue >= threshold) {
      data[index + 3] = 0;
    }
  }

  target.context.putImageData(imageData, 0, 0);
}

function makeNearWhiteTransparent(filePath, threshold = 246) {
  const command = `
Add-Type -AssemblyName System.Drawing
$path = '${filePath.replace(/'/g, "''")}'
$tmp = [System.IO.Path]::ChangeExtension($path, '.tmp.png')
$img = [System.Drawing.Bitmap]::FromFile($path)
for ($y = 0; $y -lt $img.Height; $y++) {
  for ($x = 0; $x -lt $img.Width; $x++) {
    $p = $img.GetPixel($x, $y)
    if ($p.A -gt 0 -and $p.R -ge ${threshold} -and $p.G -ge ${threshold} -and $p.B -ge ${threshold}) {
      $img.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, $p.R, $p.G, $p.B))
    }
  }
}
$img.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
$img.Dispose()
Move-Item -LiteralPath $tmp -Destination $path -Force
`;

  execFileSync("powershell.exe", ["-NoProfile", "-Command", command], { stdio: "inherit" });
}

async function renderFirstPageToPng(inputName, outputName, targetWidth, background = null) {
  const inputPath = path.join(repoRoot, inputName);
  const outputPath = path.join(assetsDir, outputName);
  const data = new Uint8Array(await fs.readFile(inputPath));
  const loadingTask = pdfjsLib.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);
  const initialViewport = page.getViewport({ scale: 1 });
  const scale = targetWidth / initialViewport.width;
  const viewport = page.getViewport({ scale });
  const canvasFactory = new NodeCanvasFactory();
  const target = canvasFactory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));

  if (background) {
    target.context.fillStyle = background;
    target.context.fillRect(0, 0, target.canvas.width, target.canvas.height);
  }

  await page.render({
    canvasContext: target.context,
    viewport,
    canvasFactory,
  }).promise;

  if (!background) {
    knockOutNearWhite(target);
  }

  const png = await target.canvas.encode("png");
  await fs.writeFile(outputPath, png);

  if (!background) {
    makeNearWhiteTransparent(outputPath);
  }

  await pdf.destroy();
  console.log(`Rendered ${inputName} -> ${outputName}`);
}

await renderFirstPageToPng("cfDNAlogo.pdf", "cfDNAlogo.png", 960, null);
await renderFirstPageToPng("background.pdf", "background.png", 2200, "#ffffff");
