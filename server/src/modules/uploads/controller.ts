import { Router } from 'express';
import multer from 'multer';
import { env } from '../../config/env';
import { currentUser, currentUserId, requireAuth, uploadLimiter } from '../../middleware';
import { User } from '../../models';
import { asyncHandler } from '../../utils/async';
import { ApiError } from '../../utils/errors';
import {
  ALLOWED_FILE_TYPES,
  ALLOWED_IMAGE_TYPES,
  assertAllowedType,
  deleteFile,
  storeFile,
} from './storage';

/**
 * Files are buffered in memory rather than written to a temp directory: they are small
 * by policy, and the storage driver wants a Buffer either way. The size limit is what
 * keeps that safe.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
});

export const uploadsRouter = Router();

/** POST /uploads/avatar — replaces the caller's profile photo. */
uploadsRouter.post(
  '/avatar',
  requireAuth,
  uploadLimiter,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('No file was uploaded (field name must be "file")');
    assertAllowedType(req.file.mimetype, ALLOWED_IMAGE_TYPES);

    const stored = await storeFile(req.file.buffer, {
      folder: 'avatars',
      mimeType: req.file.mimetype,
    });

    const user = currentUser(req);
    const previous = user.profileImage;

    await User.updateOne({ _id: user._id }, { $set: { profileImage: stored.url } });

    // Best-effort cleanup of the replaced image; a stale object is not worth failing over.
    if (previous && previous.includes('/uploads/')) {
      const key = previous.split('/uploads/')[1];
      if (key) void deleteFile(key);
    }

    res.status(201).json({ data: { url: stored.url } });
  }),
);

/** POST /uploads/attachment — chat image or document. */
uploadsRouter.post(
  '/attachment',
  requireAuth,
  uploadLimiter,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('No file was uploaded (field name must be "file")');
    assertAllowedType(req.file.mimetype, ALLOWED_FILE_TYPES);

    const stored = await storeFile(req.file.buffer, {
      folder: `attachments/${currentUserId(req)}`,
      mimeType: req.file.mimetype,
    });

    res.status(201).json({
      data: {
        url: stored.url,
        mimeType: stored.mimeType,
        size: stored.size,
        name: req.file.originalname,
        // Ready to hand straight to POST /conversations/:id/messages.
        type: ALLOWED_IMAGE_TYPES.includes(req.file.mimetype) ? 'IMAGE' : 'FILE',
      },
    });
  }),
);

/** Translates multer's own errors into the API's error envelope. */
uploadsRouter.use(
  (err: unknown, _req: unknown, _res: unknown, next: (e?: unknown) => void): void => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(ApiError.badRequest(`File is larger than the ${env.MAX_UPLOAD_MB}MB limit`));
      }
      return next(ApiError.badRequest(`Upload failed: ${err.message}`));
    }
    next(err);
  },
);
