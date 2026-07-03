import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconDir = resolve(__dirname, '../public/icons');

const colors = {
  background: [196, 61, 61, 255],
  backgroundDark: [147, 40, 40, 255],
  card: [255, 253, 248, 255],
  ink: [24, 33, 43, 255],
  shadow: [24, 33, 43, 54],
  blue: [39, 109, 184, 255],
};

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);

  length.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function writePng(fileName, size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;

  const scanlines = Buffer.alloc((size * 4 + 1) * size);

  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    scanlines[rowStart] = 0;
    pixels.copy(scanlines, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }

  writeFileSync(
    resolve(iconDir, fileName),
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', header),
      chunk('IDAT', deflateSync(scanlines, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
}

function mix(base, overlay) {
  const alpha = overlay[3] / 255;
  const inverse = 1 - alpha;

  return [
    Math.round(overlay[0] * alpha + base[0] * inverse),
    Math.round(overlay[1] * alpha + base[1] * inverse),
    Math.round(overlay[2] * alpha + base[2] * inverse),
    255,
  ];
}

function insideRoundRect(x, y, left, top, right, bottom, radius) {
  const nearestX = Math.max(left + radius, Math.min(x, right - radius));
  const nearestY = Math.max(top + radius, Math.min(y, bottom - radius));
  const dx = x - nearestX;
  const dy = y - nearestY;

  return dx * dx + dy * dy <= radius * radius;
}

function paintRoundRect(pixels, size, rect, radius, color) {
  const [left, top, right, bottom] = rect;
  const startX = Math.floor(left * size);
  const endX = Math.ceil(right * size);
  const startY = Math.floor(top * size);
  const endY = Math.ceil(bottom * size);

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const nx = (x + 0.5) / size;
      const ny = (y + 0.5) / size;

      if (!insideRoundRect(nx, ny, left, top, right, bottom, radius)) {
        continue;
      }

      setPixel(pixels, size, x, y, color);
    }
  }
}

function setPixel(pixels, size, x, y, color) {
  const index = (y * size + x) * 4;
  const current = [
    pixels[index],
    pixels[index + 1],
    pixels[index + 2],
    pixels[index + 3],
  ];
  const next = color[3] === 255 ? color : mix(current, color);

  pixels[index] = next[0];
  pixels[index + 1] = next[1];
  pixels[index + 2] = next[2];
  pixels[index + 3] = next[3];
}

function paintCircle(pixels, size, center, radius, color, predicate = () => true) {
  const [centerX, centerY] = center;
  const startX = Math.floor((centerX - radius) * size);
  const endX = Math.ceil((centerX + radius) * size);
  const startY = Math.floor((centerY - radius) * size);
  const endY = Math.ceil((centerY + radius) * size);

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const nx = (x + 0.5) / size;
      const ny = (y + 0.5) / size;
      const dx = nx - centerX;
      const dy = ny - centerY;

      if (dx * dx + dy * dy <= radius * radius && predicate(nx, ny)) {
        setPixel(pixels, size, x, y, color);
      }
    }
  }
}

function paintStripe(pixels, size, center, radius, color) {
  const [centerX, centerY] = center;
  const stripeHeight = 0.06;

  for (let y = Math.floor((centerY - stripeHeight) * size); y < Math.ceil((centerY + stripeHeight) * size); y += 1) {
    for (let x = Math.floor((centerX - radius) * size); x < Math.ceil((centerX + radius) * size); x += 1) {
      const nx = (x + 0.5) / size;
      const ny = (y + 0.5) / size;
      const dx = nx - centerX;
      const dy = ny - centerY;

      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(pixels, size, x, y, color);
      }
    }
  }
}

function downsample(source, sourceSize, targetSize, scale) {
  const target = Buffer.alloc(targetSize * targetSize * 4);

  for (let y = 0; y < targetSize; y += 1) {
    for (let x = 0; x < targetSize; x += 1) {
      const totals = [0, 0, 0, 0];

      for (let sampleY = 0; sampleY < scale; sampleY += 1) {
        for (let sampleX = 0; sampleX < scale; sampleX += 1) {
          const sourceIndex = ((y * scale + sampleY) * sourceSize + x * scale + sampleX) * 4;
          totals[0] += source[sourceIndex];
          totals[1] += source[sourceIndex + 1];
          totals[2] += source[sourceIndex + 2];
          totals[3] += source[sourceIndex + 3];
        }
      }

      const targetIndex = (y * targetSize + x) * 4;
      const samples = scale * scale;
      target[targetIndex] = Math.round(totals[0] / samples);
      target[targetIndex + 1] = Math.round(totals[1] / samples);
      target[targetIndex + 2] = Math.round(totals[2] / samples);
      target[targetIndex + 3] = Math.round(totals[3] / samples);
    }
  }

  return target;
}

function renderIcon(size) {
  const scale = size < 128 ? 4 : 3;
  const renderSize = size * scale;
  const pixels = Buffer.alloc(renderSize * renderSize * 4);

  for (let y = 0; y < renderSize; y += 1) {
    for (let x = 0; x < renderSize; x += 1) {
      const nx = x / renderSize;
      const ny = y / renderSize;
      const color = nx + ny > 1.55 ? colors.backgroundDark : colors.background;
      setPixel(pixels, renderSize, x, y, color);
    }
  }

  paintRoundRect(pixels, renderSize, [0.2, 0.14, 0.84, 0.9], 0.075, colors.shadow);
  paintRoundRect(pixels, renderSize, [0.16, 0.1, 0.8, 0.86], 0.075, colors.ink);
  paintRoundRect(pixels, renderSize, [0.185, 0.125, 0.775, 0.835], 0.055, colors.card);
  paintRoundRect(pixels, renderSize, [0.245, 0.69, 0.715, 0.745], 0.016, colors.blue);

  const center = [0.48, 0.45];
  paintCircle(pixels, renderSize, center, 0.255, colors.ink);
  paintCircle(pixels, renderSize, center, 0.215, colors.card);
  paintCircle(pixels, renderSize, center, 0.215, colors.background, (_, y) => y < center[1]);
  paintStripe(pixels, renderSize, center, 0.215, colors.ink);
  paintCircle(pixels, renderSize, center, 0.088, colors.ink);
  paintCircle(pixels, renderSize, center, 0.056, colors.card);

  return downsample(pixels, renderSize, size, scale);
}

mkdirSync(iconDir, { recursive: true });

for (const [fileName, size] of [
  ['favicon-32.png', 32],
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
]) {
  writePng(fileName, size, renderIcon(size));
}
