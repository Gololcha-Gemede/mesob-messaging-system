const fs = require('fs/promises');
const path = require('path');
const zlib = require('zlib');
const { buildLetterData, formatDate } = require('./letterFormatter');
const { uploadFileToCloudinary } = require('../utils/cloudinaryUpload');

const PDF_DIR = path.join(__dirname, '..', 'generated-pdfs');
const ASSETS_DIR = path.join(__dirname, '..');
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const LEFT = 62;
const RIGHT = 62;
const TOP = 62;
const BOTTOM = 62;
const LINE_HEIGHT = 16;

const HEADER_IMG_PATH = path.join(ASSETS_DIR, 'letter-header2.png');

function escapePdfText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapText(text, maxChars = 86) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });

  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function addWrapped(lines, text, options = {}) {
  const wrapped = wrapText(text, options.maxChars);
  wrapped.forEach((line) => lines.push({ text: line, font: options.font || 'regular', size: options.size || 11 }));
}

function parsePngChunks(buffer) {
  const chunks = [];
  let offset = 8; // skip PNG signature
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.slice(offset + 8, offset + 8 + length);
    chunks.push({ type, data });
    offset += 12 + length; // 4 len + 4 type + data + 4 crc
  }
  return chunks;
}

function decodePngToRgb(pngBuffer) {
  const chunks = parsePngChunks(pngBuffer);
  const ihdr = chunks.find((c) => c.type === 'IHDR');
  if (!ihdr) return null;

  const width = ihdr.data.readUInt32BE(0);
  const height = ihdr.data.readUInt32BE(4);
  const bitDepth = ihdr.data[8];
  const colorType = ihdr.data[9];

  // Collect all IDAT chunk data
  const idatChunks = chunks.filter((c) => c.type === 'IDAT');
  const compressed = Buffer.concat(idatChunks.map((c) => c.data));
  const raw = zlib.inflateSync(compressed);

  // Determine bytes per pixel based on color type
  let bytesPerPixel;
  let channels;
  switch (colorType) {
    case 0: bytesPerPixel = 1; channels = 1; break; // grayscale
    case 2: bytesPerPixel = 3; channels = 3; break; // RGB
    case 3: bytesPerPixel = 1; channels = 1; break; // indexed
    case 4: bytesPerPixel = 2; channels = 2; break; // grayscale + alpha
    case 6: bytesPerPixel = 4; channels = 4; break; // RGBA
    default: bytesPerPixel = 3; channels = 3; break;
  }

  const stride = 1 + width * bytesPerPixel;
  const rgbData = Buffer.alloc(width * height * 3);

  for (let y = 0; y < height; y++) {
    const filterByte = raw[y * stride];
    const rowStart = y * stride + 1;

    for (let x = 0; x < width; x++) {
      const srcIdx = rowStart + x * bytesPerPixel;
      const dstIdx = (y * width + x) * 3;

      if (colorType === 0 || colorType === 3) {
        const val = raw[srcIdx] || 0;
        rgbData[dstIdx] = val;
        rgbData[dstIdx + 1] = val;
        rgbData[dstIdx + 2] = val;
      } else if (colorType === 2) {
        rgbData[dstIdx] = raw[srcIdx] || 0;
        rgbData[dstIdx + 1] = raw[srcIdx + 1] || 0;
        rgbData[dstIdx + 2] = raw[srcIdx + 2] || 0;
      } else if (colorType === 4) {
        const val = raw[srcIdx] || 0;
        rgbData[dstIdx] = val;
        rgbData[dstIdx + 1] = val;
        rgbData[dstIdx + 2] = val;
      } else if (colorType === 6) {
        rgbData[dstIdx] = raw[srcIdx] || 0;
        rgbData[dstIdx + 1] = raw[srcIdx + 1] || 0;
        rgbData[dstIdx + 2] = raw[srcIdx + 2] || 0;
      }
    }
  }

  return { width, height, rgbData };
}

async function loadHeaderImage() {
  try {
    const buf = await fs.readFile(HEADER_IMG_PATH);
    return decodePngToRgb(buf);
  } catch {
    return null;
  }
}

function letterLines(input) {
  const data = buildLetterData(input);
  const lines = [];
  // Header is drawn as an image in the PDF stream; add spacing after it
  lines.push({ spacer: 80 });
  if (data.templateType === 'official_letter') {
    lines.push({ text: `${data.recipientLine || data.recipientName}`, font: 'bold', size: 11 });
    lines.push({ spacer: 8 });
    lines.push({ text: `Ref No: ${data.referenceNumber}`, font: 'regular', size: 10, alignRight: true });
    lines.push({ text: `Date: ${formatDate(data.date)}`, font: 'regular', size: 10, alignRight: true });
    lines.push({ spacer: 8 });
    lines.push({ text: data.subject, font: 'bold', size: 13, center: true });
    lines.push({ spacer: 10 });
  } else {
    lines.push({ spacer: 8 });
    lines.push({ text: `Subject: ${data.subject}`, font: 'bold', size: 12 });
    lines.push({ spacer: 10 });

    if (data.templateType === 'memo') {
      lines.push({ text: 'MEMO', font: 'bold', size: 14, center: true });
  } else if (data.templateType === 'notice') {
    lines.push({ spacer: 8 });
    lines.push({ text: `Ref No: ${data.referenceNumber}`, font: 'regular', size: 10, alignRight: true });
    lines.push({ text: `Date: ${formatDate(data.date)}`, font: 'regular', size: 10, alignRight: true });
    lines.push({ spacer: 8 });
    lines.push({ text: data.subject, font: 'bold', size: 13, alignRight: true });
    lines.push({ spacer: 10 });
  } else if (data.templateType === 'circular') {
      lines.push({ text: 'CIRCULAR', font: 'bold', size: 14, center: true });
      lines.push({ text: 'Dear Team,', font: 'regular', size: 11 });
    } else {
      lines.push({ text: `Dear ${data.recipientName},`, font: 'regular', size: 11 });
    }
  }

  String(data.body || '').split(/\n{2,}/).forEach((paragraph) => {
    lines.push({ spacer: 6 });
    addWrapped(lines, paragraph.replace(/\n/g, ' '), { size: 11 });
  });

  if (data.attachments.length) {
    lines.push({ spacer: 12 });
    lines.push({ text: 'Attachments:', font: 'bold', size: 11 });
    data.attachments.forEach((item) => {
      const size = Number(item.size);
      const sizeLabel = Number.isFinite(size) && size > 0 ? ` (${Math.ceil(size / 1024)} KB)` : '';
      addWrapped(lines, `- ${item.name}${sizeLabel}`, { size: 10, maxChars: 92 });
    });
  }

  lines.push({ spacer: 12 });
  if (data.templateType === 'official_letter') {
    lines.push({ text: 'ከሰላምታ ጋር', font: 'regular', size: 11, alignRight: true });
    lines.push({ spacer: 4 });
    lines.push({ text: 'Signature', font: 'regular', size: 10, alignRight: true });
    lines.push({ spacer: 6 });
    lines.push({ text: data.senderName, font: 'bold', size: 11, alignRight: true });
    if (data.senderTitle) lines.push({ text: data.senderTitle, font: 'regular', size: 10, alignRight: true });
  } else if (data.templateType === 'notice') {
    lines.push({ text: data.senderName, font: 'bold', size: 11, alignRight: true });
    if (data.senderTitle) lines.push({ text: data.senderTitle, font: 'regular', size: 10, alignRight: true });
    lines.push({ spacer: 6 });
    lines.push({ text: 'Signature', font: 'regular', size: 10, alignRight: true });
  } else if (data.templateType === 'memo') {
    lines.push({ text: 'For your information and necessary action.', font: 'regular', size: 11 });
    lines.push({ spacer: 12 });
    lines.push({ text: data.senderName, font: 'bold', size: 11 });
    if (data.senderTitle) lines.push({ text: data.senderTitle, font: 'regular', size: 10 });
  } else {
    lines.push({ text: 'Kind regards,', font: 'regular', size: 11 });
    lines.push({ spacer: 12 });
    lines.push({ text: data.senderName, font: 'bold', size: 11 });
    if (data.senderTitle) lines.push({ text: data.senderTitle, font: 'regular', size: 10 });
  }

  // Footer
  lines.push({ spacer: 24 });
  lines.push({ text: '─────────────────────────────────────────────────────────────', font: 'regular', size: 8, center: true });
  lines.push({ spacer: 4 });
  lines.push({ text: 'Lideta Address: Burundi Street, Addis Ababa, Ethiopia', font: 'regular', size: 8, center: true });
  lines.push({ text: 'Contact Center: 9838 | Website: www.mesobcenter.net', font: 'regular', size: 8, center: true });
  lines.push({ spacer: 4 });
  lines.push({ text: 'The New Horizon Of Service!', font: 'bold', size: 9, center: true });

  return lines;
}

function paginate(lines) {
  const pages = [[]];
  let y = TOP;

  lines.forEach((line) => {
    const height = line.spacer || LINE_HEIGHT;
    if (y + height > PAGE_HEIGHT - BOTTOM) {
      pages.push([]);
      y = TOP;
    }
    pages[pages.length - 1].push(line);
    y += height;
  });

  return pages;
}

function streamForPage(lines) {
  let y = PAGE_HEIGHT - TOP;
  const commands = [
    '0.95 0.95 0.95 rg',
    `0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT} re f`,
    '1 1 1 rg',
    `44 40 ${PAGE_WIDTH - 88} ${PAGE_HEIGHT - 80} re f`,
    '0.19 0.31 0.63 RG',
    '2 w',
    `44 ${PAGE_HEIGHT - 46} m ${PAGE_WIDTH - 44} ${PAGE_HEIGHT - 46} l S`,
    '0 0 0 rg'
  ];

  lines.forEach((line) => {
    if (line.spacer) {
      y -= line.spacer;
      return;
    }
    const font = line.font === 'bold' ? 'F2' : 'F1';
    const size = line.size || 11;
    const approxWidth = String(line.text || '').length * size * 0.48;
    const x = line.center ? Math.max(LEFT, (PAGE_WIDTH - approxWidth) / 2) : (line.alignRight ? Math.max(LEFT, PAGE_WIDTH - RIGHT - approxWidth) : LEFT);

    commands.push(`BT /${font} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdfText(line.text)}) Tj ET`);

    y -= Math.max(LINE_HEIGHT, size + 5);
  });

  return commands.join('\n');
}

function buildPdf(pages, headerImage) {
  const objects = [];
  const addObject = (content) => {
    objects.push(content);
    return objects.length;
  };

  const catalogId = addObject('');
  const pagesId = addObject('');
  const fontRegularId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const fontBoldId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  let imageObjectId = 0;
  let imageWidth = 0;
  let imageHeight = 0;

  if (headerImage) {
    imageWidth = headerImage.width;
    imageHeight = headerImage.height;
    const imgStream = headerImage.rgbData;
    imageObjectId = addObject(
      `<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${Buffer.byteLength(imgStream)} >>\nstream\n${imgStream}\nendstream`
    );
  }

  const pageIds = [];

  pages.forEach((pageLines) => {
    let stream = streamForPage(pageLines);

    if (headerImage && imageObjectId) {
      const imgDisplayWidth = PAGE_WIDTH - 44;
      const imgDisplayHeight = (imageHeight / imageWidth) * imgDisplayWidth;
      const imgY = PAGE_HEIGHT - 46 - imgDisplayHeight;

      const imageCmd = `q ${imgDisplayWidth.toFixed(2)} 0 0 ${imgDisplayHeight.toFixed(2)} 44 ${imgY.toFixed(2)} cm /Im0 Do Q`;
      stream = imageCmd + '\n' + stream;
    }

    const contentId = addObject(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    const pageResources = headerImage && imageObjectId
      ? `<< /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> /XObject << /Im0 ${imageObjectId} 0 R >> >>`
      : `<< /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >>`;
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources ${pageResources} /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  });

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

async function generateLetterPdf(input) {
  await fs.mkdir(PDF_DIR, { recursive: true });
  const reference = String(input.referenceNumber || `message-${Date.now()}`).replace(/[^a-z0-9-]/gi, '_');
  const fileName = `${reference}.pdf`;
  const filePath = path.join(PDF_DIR, fileName);
  const headerImage = await loadHeaderImage();
  const pages = paginate(letterLines(input));
  const pdfBuffer = buildPdf(pages, headerImage);
  await fs.writeFile(filePath, pdfBuffer);

  try {
    const cloudUrl = await uploadFileToCloudinary(filePath, 'generated-pdfs');
    return cloudUrl;
  } catch {
    return filePath;
  }
}

module.exports = {
  generateLetterPdf
};
