import crypto from 'crypto';
import { put } from '@vercel/blob';

const MAX_BYTES = 5 * 1024 * 1024;

// Detect the real type from the file's first bytes — never trust the
// browser-supplied name/mimetype (an "image" could be HTML or SVG with script).
function sniffImageType(buffer) {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { ext: '.jpg', mime: 'image/jpeg' };
  if (buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: '.png', mime: 'image/png' };
  if (buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP') return { ext: '.webp', mime: 'image/webp' };
  if (buffer.slice(0, 3).toString('ascii') === 'GIF') return { ext: '.gif', mime: 'image/gif' };
  return null;
}

export class UploadError extends Error {}

/**
 * Uploads a file buffer to Vercel Blob storage (private store) and returns a
 * same-origin URL served by app/api/media/[...path]/route.js, which fetches
 * the private blob server-side and streams it back.
 * @param {Buffer} fileBuffer The file contents.
 * @param {string} filename Relative filename (e.g. 'products/my-uuid.png').
 * @param {string} mimetype File mime type.
 * @returns {Promise<string>} URL of the uploaded image.
 */
export async function uploadFile(fileBuffer, filename, mimetype = 'image/jpeg') {
  await put(`media/${filename}`, fileBuffer, {
    access: 'private',
    contentType: mimetype,
    addRandomSuffix: false,
  });
  return `/api/media/${filename}`;
}

/** Validates a browser File as a real image and stores it under `folder/`. */
export async function uploadImageFile(file, folder) {
  if (!file || typeof file !== 'object' || typeof file.arrayBuffer !== 'function') {
    throw new UploadError('Please choose an image to upload.');
  }
  if (file.size > MAX_BYTES) throw new UploadError('Image is too large. Please upload an image under 5 MB.');
  const buffer = Buffer.from(await file.arrayBuffer());
  const type = sniffImageType(buffer);
  if (!type) throw new UploadError('Only JPG, PNG, WEBP or GIF images are allowed.');
  return uploadFile(buffer, `${folder}/${crypto.randomUUID()}${type.ext}`, type.mime);
}
