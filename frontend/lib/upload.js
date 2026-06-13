import fs from 'fs';
import path from 'path';

/**
 * Uploads a file buffer to the local public/media/ directory.
 * @param {Buffer} fileBuffer The file contents.
 * @param {string} filename Relative filename (e.g. 'screenshots/my-uuid.png').
 * @param {string} mimetype File mime type.
 * @returns {Promise<string>} Relative URL of the uploaded image.
 */
export async function uploadFile(fileBuffer, filename, mimetype = 'image/jpeg') {
  const relativePath = `/media/${filename}`;
  const absolutePath = path.join(process.cwd(), 'public/media', filename);
  
  const parentDir = path.dirname(absolutePath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }
  
  fs.writeFileSync(absolutePath, fileBuffer);
  return relativePath;
}
