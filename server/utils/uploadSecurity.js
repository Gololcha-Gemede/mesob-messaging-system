const fs = require('fs');

const PDF = Buffer.from('%PDF-');
const JPG = Buffer.from([0xff, 0xd8, 0xff]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const GIF87 = Buffer.from('GIF87a');
const GIF89 = Buffer.from('GIF89a');
const WEBP_RIFF = Buffer.from('RIFF');
const WEBP_WEBP = Buffer.from('WEBP');

function startsWith(buffer, signature, offset = 0) {
  return buffer.length >= offset + signature.length &&
    buffer.subarray(offset, offset + signature.length).equals(signature);
}

function detectMime(buffer) {
  if (startsWith(buffer, PDF)) return 'application/pdf';
  if (startsWith(buffer, JPG)) return 'image/jpeg';
  if (startsWith(buffer, PNG)) return 'image/png';
  if (startsWith(buffer, GIF87) || startsWith(buffer, GIF89)) return 'image/gif';
  if (startsWith(buffer, WEBP_RIFF) && startsWith(buffer, WEBP_WEBP, 8)) return 'image/webp';
  return '';
}

function removeUploadedFile(file) {
  if (!file?.path) return;
  fs.promises.unlink(file.path).catch(() => {});
}

async function validateUploadedFile(file, { allowPdf = true, allowImages = true } = {}) {
  if (!file) return '';

  const header = Buffer.alloc(16);
  const handle = await fs.promises.open(file.path, 'r');
  try {
    await handle.read(header, 0, header.length, 0);
  } finally {
    await handle.close();
  }

  const detected = detectMime(header);
  const imageAllowed = allowImages && detected.startsWith('image/');
  const pdfAllowed = allowPdf && detected === 'application/pdf';

  if (!detected || (!imageAllowed && !pdfAllowed)) {
    removeUploadedFile(file);
    return 'Uploaded file type is not allowed.';
  }

  if (file.mimetype && file.mimetype !== detected) {
    removeUploadedFile(file);
    return 'Uploaded file type does not match its contents.';
  }

  return '';
}

module.exports = {
  removeUploadedFile,
  validateUploadedFile
};
