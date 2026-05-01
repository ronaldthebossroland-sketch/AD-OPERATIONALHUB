import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ss = 4;

const crcTable = new Uint32Array(256).map((_, index) => {
  let crc = index;

  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }

  return crc >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const output = Buffer.alloc(12 + data.length);

  output.writeUInt32BE(data.length, 0);
  typeBuffer.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);

  return output;
}

function png(width, height, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  const raw = Buffer.alloc((width * 4 + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    pixels.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function mix(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function color(hex, alpha = 255) {
  const value = hex.replace("#", "");

  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
    alpha,
  ];
}

function blendPixel(buffer, width, x, y, rgba) {
  const index = (y * width + x) * 4;
  const sourceAlpha = rgba[3] / 255;
  const destinationAlpha = buffer[index + 3] / 255;
  const outputAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);

  if (outputAlpha === 0) {
    return;
  }

  buffer[index] = Math.round(
    (rgba[0] * sourceAlpha + buffer[index] * destinationAlpha * (1 - sourceAlpha)) /
      outputAlpha
  );
  buffer[index + 1] = Math.round(
    (rgba[1] * sourceAlpha + buffer[index + 1] * destinationAlpha * (1 - sourceAlpha)) /
      outputAlpha
  );
  buffer[index + 2] = Math.round(
    (rgba[2] * sourceAlpha + buffer[index + 2] * destinationAlpha * (1 - sourceAlpha)) /
      outputAlpha
  );
  buffer[index + 3] = Math.round(outputAlpha * 255);
}

function insideRoundedRect(x, y, left, top, right, bottom, radius) {
  const clampedX = Math.max(left + radius, Math.min(x, right - radius));
  const clampedY = Math.max(top + radius, Math.min(y, bottom - radius));
  const dx = x - clampedX;
  const dy = y - clampedY;

  return dx * dx + dy * dy <= radius * radius;
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  const x = ax + t * dx;
  const y = ay + t * dy;

  return Math.hypot(px - x, py - y);
}

function drawCircle(buffer, width, size, cx, cy, radius, rgba) {
  const scale = width / size;
  const minX = Math.max(0, Math.floor((cx - radius) * scale));
  const maxX = Math.min(width - 1, Math.ceil((cx + radius) * scale));
  const minY = Math.max(0, Math.floor((cy - radius) * scale));
  const maxY = Math.min(width - 1, Math.ceil((cy + radius) * scale));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const nx = (x + 0.5) / scale;
      const ny = (y + 0.5) / scale;

      if (Math.hypot(nx - cx, ny - cy) <= radius) {
        blendPixel(buffer, width, x, y, rgba);
      }
    }
  }
}

function drawLine(buffer, width, size, ax, ay, bx, by, stroke, rgba) {
  const scale = width / size;
  const minX = Math.max(0, Math.floor((Math.min(ax, bx) - stroke) * scale));
  const maxX = Math.min(width - 1, Math.ceil((Math.max(ax, bx) + stroke) * scale));
  const minY = Math.max(0, Math.floor((Math.min(ay, by) - stroke) * scale));
  const maxY = Math.min(width - 1, Math.ceil((Math.max(ay, by) + stroke) * scale));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const nx = (x + 0.5) / scale;
      const ny = (y + 0.5) / scale;

      if (distanceToSegment(nx, ny, ax, ay, bx, by) <= stroke / 2) {
        blendPixel(buffer, width, x, y, rgba);
      }
    }
  }

  drawCircle(buffer, width, size, ax, ay, stroke / 2, rgba);
  drawCircle(buffer, width, size, bx, by, stroke / 2, rgba);
}

function drawSpark(buffer, width, size, cx, cy, radius, rgba) {
  drawLine(buffer, width, size, cx - radius, cy, cx + radius, cy, radius * 0.24, rgba);
  drawLine(buffer, width, size, cx, cy - radius, cx, cy + radius, radius * 0.24, rgba);
  drawLine(
    buffer,
    width,
    size,
    cx - radius * 0.62,
    cy - radius * 0.62,
    cx + radius * 0.62,
    cy + radius * 0.62,
    radius * 0.18,
    rgba
  );
  drawLine(
    buffer,
    width,
    size,
    cx + radius * 0.62,
    cy - radius * 0.62,
    cx - radius * 0.62,
    cy + radius * 0.62,
    radius * 0.18,
    rgba
  );
}

function drawMark(buffer, width, size, offset = 0, multiplier = 1) {
  const points = (values) => values.map((value) => offset + value * multiplier);

  const gold = color("#d8af55");
  const brightGold = color("#fff4c7");
  const cyan = color("#61e6ff");
  const deepGold = color("#8a5a18");

  const shield = [
    [177, 158],
    [335, 158],
    [366, 224],
    [341, 329],
    [256, 384],
    [171, 329],
    [146, 224],
    [177, 158],
  ].map(([x, y]) => points([x, y]));

  for (let index = 0; index < shield.length - 1; index += 1) {
    drawLine(
      buffer,
      width,
      size,
      shield[index][0],
      shield[index][1],
      shield[index + 1][0],
      shield[index + 1][1],
      16 * multiplier,
      index % 2 === 0 ? brightGold : gold
    );
  }

  drawLine(
    buffer,
    width,
    size,
    offset + 212 * multiplier,
    offset + 136 * multiplier,
    offset + 232 * multiplier,
    offset + 108 * multiplier,
    10 * multiplier,
    brightGold
  );
  drawLine(
    buffer,
    width,
    size,
    offset + 232 * multiplier,
    offset + 108 * multiplier,
    offset + 256 * multiplier,
    offset + 136 * multiplier,
    10 * multiplier,
    gold
  );
  drawLine(
    buffer,
    width,
    size,
    offset + 256 * multiplier,
    offset + 136 * multiplier,
    offset + 280 * multiplier,
    offset + 108 * multiplier,
    10 * multiplier,
    gold
  );
  drawLine(
    buffer,
    width,
    size,
    offset + 280 * multiplier,
    offset + 108 * multiplier,
    offset + 300 * multiplier,
    offset + 136 * multiplier,
    10 * multiplier,
    brightGold
  );
  drawLine(
    buffer,
    width,
    size,
    offset + 212 * multiplier,
    offset + 142 * multiplier,
    offset + 300 * multiplier,
    offset + 142 * multiplier,
    9 * multiplier,
    deepGold
  );

  drawLine(
    buffer,
    width,
    size,
    offset + 213 * multiplier,
    offset + 225 * multiplier,
    offset + 256 * multiplier,
    offset + 306 * multiplier,
    28 * multiplier,
    gold
  );
  drawLine(
    buffer,
    width,
    size,
    offset + 256 * multiplier,
    offset + 306 * multiplier,
    offset + 314 * multiplier,
    offset + 225 * multiplier,
    28 * multiplier,
    brightGold
  );

  drawLine(
    buffer,
    width,
    size,
    offset + 149 * multiplier,
    offset + 246 * multiplier,
    offset + 218 * multiplier,
    offset + 205 * multiplier,
    12 * multiplier,
    color("#7dd3fc")
  );
  drawLine(
    buffer,
    width,
    size,
    offset + 218 * multiplier,
    offset + 205 * multiplier,
    offset + 292 * multiplier,
    offset + 212 * multiplier,
    12 * multiplier,
    color("#38bdf8")
  );
  drawLine(
    buffer,
    width,
    size,
    offset + 292 * multiplier,
    offset + 212 * multiplier,
    offset + 362 * multiplier,
    offset + 256 * multiplier,
    12 * multiplier,
    color("#22d3ee")
  );

  drawLine(
    buffer,
    width,
    size,
    offset + 151 * multiplier,
    offset + 269 * multiplier,
    offset + 224 * multiplier,
    offset + 318 * multiplier,
    10 * multiplier,
    color("#a5f3fc")
  );
  drawLine(
    buffer,
    width,
    size,
    offset + 224 * multiplier,
    offset + 318 * multiplier,
    offset + 306 * multiplier,
    offset + 313 * multiplier,
    10 * multiplier,
    color("#38bdf8")
  );
  drawLine(
    buffer,
    width,
    size,
    offset + 306 * multiplier,
    offset + 313 * multiplier,
    offset + 366 * multiplier,
    offset + 244 * multiplier,
    10 * multiplier,
    color("#2563eb")
  );

  drawCircle(
    buffer,
    width,
    size,
    offset + 149 * multiplier,
    offset + 246 * multiplier,
    11 * multiplier,
    color("#a5f3fc")
  );
  drawCircle(
    buffer,
    width,
    size,
    offset + 362 * multiplier,
    offset + 256 * multiplier,
    12 * multiplier,
    color("#22d3ee")
  );
  drawCircle(
    buffer,
    width,
    size,
    offset + 256 * multiplier,
    offset + 306 * multiplier,
    14 * multiplier,
    brightGold
  );
  drawSpark(
    buffer,
    width,
    size,
    offset + 378 * multiplier,
    offset + 170 * multiplier,
    29 * multiplier,
    brightGold
  );
}

function renderPixels(size, mode = "tile") {
  const workSize = size * ss;
  const buffer = Buffer.alloc(workSize * workSize * 4);
  const tileLeft = 34;
  const tileTop = 34;
  const tileRight = 478;
  const tileBottom = 478;
  const tileRadius = 112;

  if (mode !== "foreground") {
    for (let y = 0; y < workSize; y += 1) {
      for (let x = 0; x < workSize; x += 1) {
        const nx = ((x + 0.5) / workSize) * 512;
        const ny = ((y + 0.5) / workSize) * 512;

        if (!insideRoundedRect(nx, ny, tileLeft, tileTop, tileRight, tileBottom, tileRadius)) {
          continue;
        }

        const t = Math.min(1, Math.max(0, (nx + ny) / 1024));
        const r = mix(2, 15, t);
        const g = mix(6, 23, t);
        const b = mix(23, 42, t);
        const glow = Math.max(0, 1 - Math.hypot(nx - 350, ny - 142) / 260);
        const index = (y * workSize + x) * 4;

        buffer[index] = mix(r, 56, glow * 0.22);
        buffer[index + 1] = mix(g, 189, glow * 0.12);
        buffer[index + 2] = mix(b, 248, glow * 0.22);
        buffer[index + 3] = 255;
      }
    }

    drawLine(buffer, workSize, 512, 92, 60, 452, 452, 8, color("#d8af55", 180));
    drawLine(buffer, workSize, 512, 60, 92, 420, 452, 7, color("#61e6ff", 120));
  }

  if (mode === "foreground") {
    drawMark(buffer, workSize, 512, -8, 1.03);
  } else {
    drawMark(buffer, workSize, 512);
  }

  const output = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const totals = [0, 0, 0, 0];

      for (let sy = 0; sy < ss; sy += 1) {
        for (let sx = 0; sx < ss; sx += 1) {
          const index = ((y * ss + sy) * workSize + (x * ss + sx)) * 4;
          totals[0] += buffer[index];
          totals[1] += buffer[index + 1];
          totals[2] += buffer[index + 2];
          totals[3] += buffer[index + 3];
        }
      }

      const outputIndex = (y * size + x) * 4;
      output[outputIndex] = Math.round(totals[0] / (ss * ss));
      output[outputIndex + 1] = Math.round(totals[1] / (ss * ss));
      output[outputIndex + 2] = Math.round(totals[2] / (ss * ss));
      output[outputIndex + 3] = Math.round(totals[3] / (ss * ss));
    }
  }

  return output;
}

function render(size, mode = "tile") {
  return png(size, size, renderPixels(size, mode));
}

function compositePixels(target, targetWidth, source, sourceWidth, sourceHeight, left, top) {
  for (let y = 0; y < sourceHeight; y += 1) {
    const targetY = top + y;

    if (targetY < 0) {
      continue;
    }

    for (let x = 0; x < sourceWidth; x += 1) {
      const targetX = left + x;

      if (targetX < 0 || targetX >= targetWidth) {
        continue;
      }

      const sourceIndex = (y * sourceWidth + x) * 4;
      const alpha = source[sourceIndex + 3];

      if (!alpha) {
        continue;
      }

      blendPixel(target, targetWidth, targetX, targetY, [
        source[sourceIndex],
        source[sourceIndex + 1],
        source[sourceIndex + 2],
        alpha,
      ]);
    }
  }
}

function drawHorizontalLine(buffer, width, height, cx, cy, length, thickness, rgba) {
  const startX = Math.max(0, Math.floor(cx - length / 2));
  const endX = Math.min(width - 1, Math.ceil(cx + length / 2));
  const startY = Math.max(0, Math.floor(cy - thickness / 2));
  const endY = Math.min(height - 1, Math.ceil(cy + thickness / 2));

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const centerFade = Math.max(0, 1 - Math.abs(x - cx) / (length / 2));
      const edgeFade = Math.max(0, 1 - Math.abs(y - cy) / (thickness / 2 || 1));

      blendPixel(buffer, width, x, y, [
        rgba[0],
        rgba[1],
        rgba[2],
        Math.round(rgba[3] * centerFade * edgeFade),
      ]);
    }
  }
}

function renderSplash(width, height) {
  const buffer = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = width === 1 ? 0 : x / (width - 1);
      const ny = height === 1 ? 0 : y / (height - 1);
      const depth = Math.min(1, Math.max(0, nx * 0.44 + ny * 0.56));
      const diagonal = Math.max(0, 1 - Math.abs(nx - ny - 0.08) / 0.18);
      const cyanSheen = Math.max(0, 1 - Math.abs(nx + ny - 1.12) / 0.2);
      const vignette = Math.min(1, Math.hypot(nx - 0.5, ny - 0.47) / 0.72);
      const index = (y * width + x) * 4;

      buffer[index] = Math.max(
        1,
        Math.round(mix(2, 15, depth) + diagonal * 18 - vignette * 8)
      );
      buffer[index + 1] = Math.max(
        5,
        Math.round(mix(6, 23, depth) + diagonal * 15 + cyanSheen * 16 - vignette * 8)
      );
      buffer[index + 2] = Math.max(
        20,
        Math.round(mix(23, 42, depth) + diagonal * 8 + cyanSheen * 28 - vignette * 8)
      );
      buffer[index + 3] = 255;
    }
  }

  const markSize = Math.max(108, Math.round(Math.min(width, height) * 0.36));
  const markPixels = renderPixels(markSize);
  const markLeft = Math.round((width - markSize) / 2);
  const markTop = Math.round((height - markSize) / 2 - height * 0.035);
  const lineY = Math.round(markTop + markSize + Math.max(26, height * 0.035));

  compositePixels(buffer, width, markPixels, markSize, markSize, markLeft, markTop);
  drawHorizontalLine(
    buffer,
    width,
    height,
    Math.round(width / 2),
    lineY,
    Math.min(width * 0.3, markSize * 1.25),
    Math.max(4, Math.round(Math.min(width, height) * 0.006)),
    color("#d8af55", 210)
  );

  return buffer;
}

function save(relativePath, size, mode = "tile") {
  const target = join(root, relativePath);

  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, render(size, mode));
}

function saveSplash(relativePath, width, height) {
  const target = join(root, relativePath);

  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, png(width, height, renderSplash(width, height)));
}

save("public/icons/icon-512.png", 512);
save("public/icons/maskable-512.png", 512);
save("public/icons/icon-192.png", 192);

for (const [density, size] of [
  ["mdpi", 48],
  ["hdpi", 72],
  ["xhdpi", 96],
  ["xxhdpi", 144],
  ["xxxhdpi", 192],
]) {
  save(`android/app/src/main/res/mipmap-${density}/ic_launcher.png`, size);
  save(`android/app/src/main/res/mipmap-${density}/ic_launcher_round.png`, size);
}

for (const [density, size] of [
  ["mdpi", 108],
  ["hdpi", 162],
  ["xhdpi", 216],
  ["xxhdpi", 324],
  ["xxxhdpi", 432],
]) {
  save(`android/app/src/main/res/mipmap-${density}/ic_launcher_foreground.png`, size, "foreground");
}

saveSplash("android/app/src/main/res/drawable/splash.png", 480, 320);

for (const [density, width, height] of [
  ["mdpi", 480, 320],
  ["hdpi", 800, 480],
  ["xhdpi", 1280, 720],
  ["xxhdpi", 1600, 960],
  ["xxxhdpi", 1920, 1280],
]) {
  saveSplash(`android/app/src/main/res/drawable-land-${density}/splash.png`, width, height);
}

for (const [density, width, height] of [
  ["mdpi", 320, 480],
  ["hdpi", 480, 800],
  ["xhdpi", 720, 1280],
  ["xxhdpi", 960, 1600],
  ["xxxhdpi", 1280, 1920],
]) {
  saveSplash(`android/app/src/main/res/drawable-port-${density}/splash.png`, width, height);
}
