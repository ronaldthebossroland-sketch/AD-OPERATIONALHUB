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

  const [x1, y1, x2, y2, x3, y3] = points([154, 339, 226, 164, 357, 339]);
  const stroke = 31 * multiplier;
  const gold = color("#d8af55");
  const brightGold = color("#fff4c7");
  const cyan = color("#61e6ff");

  drawLine(buffer, width, size, x1, y1, x2, y2, stroke, gold);
  drawLine(buffer, width, size, x2, y2, x3, y3, stroke, gold);
  drawLine(
    buffer,
    width,
    size,
    offset + 213 * multiplier,
    offset + 267 * multiplier,
    offset + 306 * multiplier,
    offset + 267 * multiplier,
    25 * multiplier,
    brightGold
  );
  drawLine(
    buffer,
    width,
    size,
    offset + 159 * multiplier,
    offset + 207 * multiplier,
    offset + 236 * multiplier,
    offset + 246 * multiplier,
    11 * multiplier,
    color("#7dd3fc")
  );
  drawLine(
    buffer,
    width,
    size,
    offset + 236 * multiplier,
    offset + 246 * multiplier,
    offset + 310 * multiplier,
    offset + 236 * multiplier,
    11 * multiplier,
    color("#38bdf8")
  );
  drawLine(
    buffer,
    width,
    size,
    offset + 310 * multiplier,
    offset + 236 * multiplier,
    offset + 369 * multiplier,
    offset + 192 * multiplier,
    11 * multiplier,
    color("#22d3ee")
  );
  drawCircle(buffer, width, size, x2, y2, 14 * multiplier, brightGold);
  drawCircle(buffer, width, size, x1, y1, 13 * multiplier, gold);
  drawCircle(buffer, width, size, x3, y3, 13 * multiplier, cyan);
  drawCircle(
    buffer,
    width,
    size,
    offset + 369 * multiplier,
    offset + 192 * multiplier,
    9 * multiplier,
    color("#22d3ee")
  );
  drawSpark(
    buffer,
    width,
    size,
    offset + 352 * multiplier,
    offset + 149 * multiplier,
    32 * multiplier,
    brightGold
  );
}

function render(size, mode = "tile") {
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

  return png(size, size, output);
}

function save(relativePath, size, mode = "tile") {
  const target = join(root, relativePath);

  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, render(size, mode));
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
