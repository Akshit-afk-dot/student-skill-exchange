import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import { env, storageDriver } from '../../config/env';
import { logger } from '../../config/logger';
import { ApiError } from '../../utils/errors';

export interface StoredFile {
  url: string;
  /** Identifier needed to delete the object later. */
  key: string;
  mimeType: string;
  size: number;
}

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const ALLOWED_FILE_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  'application/pdf',
  'text/plain',
  'application/zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'application/zip': '.zip',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};

if (storageDriver === 'cloudinary') {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  logger.info('Storage driver: cloudinary');
} else {
  logger.info({ dir: env.UPLOAD_DIR }, 'Storage driver: local disk');
}

export function assertAllowedType(mimeType: string, allowed: string[]): void {
  if (!allowed.includes(mimeType)) {
    throw ApiError.badRequest(`Unsupported file type "${mimeType}"`, { allowed });
  }
}

function uploadToCloudinary(buffer: Buffer, folder: string): Promise<{ url: string; key: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `student-skill-exchange/${folder}`, resource_type: 'auto' },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error('Cloudinary upload failed'));
        resolve({ url: result.secure_url, key: result.public_id });
      },
    );
    stream.end(buffer);
  });
}

async function saveToDisk(
  buffer: Buffer,
  folder: string,
  mimeType: string,
): Promise<{ url: string; key: string }> {
  const ext = EXTENSIONS[mimeType] ?? '';
  const name = `${crypto.randomBytes(16).toString('hex')}${ext}`;
  const dir = path.resolve(process.cwd(), env.UPLOAD_DIR, folder);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), buffer);
  const key = `${folder}/${name}`;
  return { url: `${env.PUBLIC_URL}/uploads/${key}`, key };
}

/**
 * Persists a file and returns a public URL.
 *
 * Cloudinary is used when configured; otherwise the file lands on local disk under
 * UPLOAD_DIR and is served by the static handler. Local disk is fine for development
 * and single-host deployments, but note it does not survive an ephemeral filesystem
 * (Heroku, Cloud Run) — configure Cloudinary for those.
 */
export async function storeFile(
  buffer: Buffer,
  options: { folder: string; mimeType: string },
): Promise<StoredFile> {
  const { folder, mimeType } = options;
  const result =
    storageDriver === 'cloudinary'
      ? await uploadToCloudinary(buffer, folder)
      : await saveToDisk(buffer, folder, mimeType);

  return { ...result, mimeType, size: buffer.byteLength };
}

export async function deleteFile(key: string): Promise<void> {
  try {
    if (storageDriver === 'cloudinary') {
      await cloudinary.uploader.destroy(key);
      return;
    }
    // Refuse to traverse outside the upload root, whatever the stored key says.
    const root = path.resolve(process.cwd(), env.UPLOAD_DIR);
    const target = path.resolve(root, key);
    if (!target.startsWith(root + path.sep)) {
      logger.warn({ key }, 'Refusing to delete a path outside the upload directory');
      return;
    }
    await fs.unlink(target);
  } catch (err) {
    // A missing object is the desired end state anyway.
    logger.debug({ err, key }, 'File delete failed (ignored)');
  }
}
