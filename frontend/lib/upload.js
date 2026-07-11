import { put } from '@vercel/blob';

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
