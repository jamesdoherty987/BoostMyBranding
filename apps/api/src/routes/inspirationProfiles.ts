/**
 * Inspiration profile routes — per-client library of "brands I admire"
 * that the AI uses as style references for generation.
 *
 *   GET    /api/v1/clients/:clientId/inspiration-profiles
 *   POST   /api/v1/clients/:clientId/inspiration-profiles
 *   GET    /api/v1/clients/:clientId/inspiration-profiles/:profileId
 *   PATCH  /api/v1/clients/:clientId/inspiration-profiles/:profileId
 *   DELETE /api/v1/clients/:clientId/inspiration-profiles/:profileId
 *   POST   /api/v1/clients/:clientId/inspiration-profiles/:profileId/scrape
 *   POST   /api/v1/clients/:clientId/inspiration-profiles/:profileId/media   (multipart)
 *   DELETE /api/v1/clients/:clientId/inspiration-profiles/:profileId/media/:mediaId
 */

import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import {
  listProfiles,
  getProfile,
  createProfile,
  updateProfile,
  deleteProfile,
  scrapeAndAnalyse,
  addMediaToProfile,
  removeMediaFromProfile,
} from '../services/inspirationProfiles.js';
import { uploadFile } from '../services/r2.js';
import { requireAuth, requireRole } from '../services/auth.js';
import { uploadLimiter } from '../middleware/rateLimit.js';

export const inspirationProfilesRouter = Router({ mergeParams: true });

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_FILES = 10;
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error('Supported: JPG, PNG, WEBP, MP4, MOV'));
  },
});

/**
 * Agency roles can fully manage profiles. Clients can read their own
 * profiles but not mutate them. The `scopeCheck` middleware enforces
 * client scoping on any request where the auth'd user is a client.
 */
function scopeCheck(req: any, res: any, next: any) {
  const user = req.user as { role: string; clientId?: string };
  const clientId = String(req.params.clientId);
  if (user.role === 'client' && user.clientId !== clientId) {
    return res.status(403).json({ error: { message: 'Forbidden', code: 'FORBIDDEN' } });
  }
  next();
}

inspirationProfilesRouter.get('/', requireAuth, scopeCheck, async (req, res, next) => {
  try {
    const clientId = String(req.params.clientId);
    const profiles = await listProfiles(clientId);
    res.json({ data: profiles });
  } catch (e) {
    next(e);
  }
});

const createSchema = z.object({
  name: z.string().min(1).max(200),
  referenceUrl: z.string().url().max(1000).optional().or(z.literal('')),
  description: z.string().max(1000).optional(),
});

inspirationProfilesRouter.post(
  '/',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const clientId = String(req.params.clientId);
      const body = createSchema.parse(req.body);
      const profile = await createProfile({
        clientId,
        name: body.name,
        referenceUrl: body.referenceUrl || undefined,
        description: body.description,
      });
      res.status(201).json({ data: profile });
    } catch (e) {
      next(e);
    }
  },
);

inspirationProfilesRouter.get('/:profileId', requireAuth, scopeCheck, async (req, res, next) => {
  try {
    const clientId = String(req.params.clientId);
    const profileId = String(req.params.profileId);
    const profile = await getProfile(clientId, profileId);
    if (!profile) {
      return res.status(404).json({ error: { message: 'Profile not found', code: 'NOT_FOUND' } });
    }
    res.json({ data: profile });
  } catch (e) {
    next(e);
  }
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  referenceUrl: z.string().url().max(1000).nullable().optional().or(z.literal('')),
  isEnabled: z.boolean().optional(),
});

inspirationProfilesRouter.patch(
  '/:profileId',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const clientId = String(req.params.clientId);
      const profileId = String(req.params.profileId);
      const body = updateSchema.parse(req.body);
      const profile = await updateProfile(clientId, profileId, {
        ...body,
        referenceUrl:
          body.referenceUrl === ''
            ? null
            : body.referenceUrl ?? undefined,
      });
      if (!profile) {
        return res.status(404).json({ error: { message: 'Profile not found', code: 'NOT_FOUND' } });
      }
      res.json({ data: profile });
    } catch (e) {
      next(e);
    }
  },
);

inspirationProfilesRouter.delete(
  '/:profileId',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const clientId = String(req.params.clientId);
      const profileId = String(req.params.profileId);
      const ok = await deleteProfile(clientId, profileId);
      if (!ok) {
        return res.status(404).json({ error: { message: 'Profile not found', code: 'NOT_FOUND' } });
      }
      res.json({ data: { ok: true } });
    } catch (e) {
      next(e);
    }
  },
);

/**
 * Trigger a scrape of the profile's reference URL. Synchronous — the
 * Claude call is fast enough to return in-flight. The response carries
 * the fully-populated profile.
 */
inspirationProfilesRouter.post(
  '/:profileId/scrape',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const clientId = String(req.params.clientId);
      const profileId = String(req.params.profileId);
      const profile = await scrapeAndAnalyse({ clientId, profileId });
      if (!profile) {
        return res.status(404).json({ error: { message: 'Profile not found', code: 'NOT_FOUND' } });
      }
      res.json({ data: profile });
    } catch (e) {
      next(e);
    }
  },
);

/**
 * Upload one or more reference files and attach them to the profile.
 * These live on R2 under `{clientId}/inspiration-profiles/{profileId}/`
 * so deletion is simple and traffic is auditable.
 */
inspirationProfilesRouter.post(
  '/:profileId/media',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  uploadLimiter,
  upload.array('files', MAX_FILES),
  async (req, res, next) => {
    try {
      const clientId = String(req.params.clientId);
      const profileId = String(req.params.profileId);
      const files = (req.files as Express.Multer.File[]) ?? [];
      if (files.length === 0) {
        return res.status(400).json({ error: { message: 'No files uploaded', code: 'NO_FILES' } });
      }

      const added: Array<{ id: string; url: string; mimeType: string; fileName: string }> = [];
      for (const file of files) {
        if (file.size > MAX_FILE_BYTES || !ALLOWED_MIME.has(file.mimetype)) {
          return res
            .status(400)
            .json({ error: { message: 'Unsupported file', code: 'BAD_FILE' } });
        }
        const { url } = await uploadFile(
          `${clientId}/inspiration-profiles/${profileId}`,
          file.buffer,
          file.originalname,
          file.mimetype,
        );
        const ref = await addMediaToProfile({
          clientId,
          profileId,
          fileUrl: url,
          fileName: file.originalname,
          mimeType: file.mimetype,
          source: 'upload',
        });
        if (!ref) {
          return res
            .status(404)
            .json({ error: { message: 'Profile not found', code: 'NOT_FOUND' } });
        }
        added.push({ id: ref.id, url, mimeType: file.mimetype, fileName: file.originalname });
      }
      res.status(201).json({ data: added });
    } catch (e) {
      next(e);
    }
  },
);

inspirationProfilesRouter.delete(
  '/:profileId/media/:mediaId',
  requireAuth,
  requireRole('agency_admin', 'agency_member'),
  async (req, res, next) => {
    try {
      const clientId = String(req.params.clientId);
      const profileId = String(req.params.profileId);
      const mediaId = String(req.params.mediaId);
      const ok = await removeMediaFromProfile({ clientId, profileId, mediaId });
      if (!ok) {
        return res.status(404).json({ error: { message: 'Media not found', code: 'NOT_FOUND' } });
      }
      res.json({ data: { ok: true } });
    } catch (e) {
      next(e);
    }
  },
);
