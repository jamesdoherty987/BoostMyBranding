/**
 * Image routes.
 *
 * Auth + ownership: upload requires a valid session and, for client-role users,
 * the target clientId must match the user's own.
 *
 * Automation: every upload fires a background analyze so the dashboard sees
 * a quality score within seconds. The 2-minute cron catches any that were
 * missed (e.g. Claude rate-limited during the burst).
 */

import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { getDb, isDbConfigured, clientImages, clients } from '@boost/database';
import { mockImages } from '@boost/core';
import { uploadFile, deleteFile } from '../services/r2.js';
import { analyzeImage } from '../services/claude.js';
import { enhanceImage } from '../services/fal.js';
import { imageAnalysisPrompt } from '../services/prompts.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../services/auth.js';
import { broadcast } from '../services/realtime.js';
import { fireAndForget, withRetry } from '../services/retry.js';

export const imagesRouter = Router();

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_FILES = 10;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, PNG, WEBP, and GIF uploads are allowed'));
  },
});

imagesRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { role: string; clientId?: string };
    let clientId = req.query.clientId as string | undefined;
    if (user.role === 'client') clientId = user.clientId;
    if (user.role === 'client' && !clientId) return res.json({ data: [] });
    const status = req.query.status as string | undefined;

    if (!isDbConfigured()) {
      let results = mockImages;
      if (clientId) results = results.filter((i) => i.clientId === clientId);
      if (status) results = results.filter((i) => i.status === status);
      return res.json({ data: results });
    }
    const db = getDb();
    const where = clientId
      ? status
        ? and(eq(clientImages.clientId, clientId), eq(clientImages.status, status as any))
        : eq(clientImages.clientId, clientId)
      : undefined;
    const rows = where
      ? await db.select().from(clientImages).where(where)
      : await db.select().from(clientImages);
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
});

const uploadSchema = z.object({
  clientId: z.string().min(1).max(100),
  tags: z.string().max(500).optional(),
});

imagesRouter.post(
  '/upload',
  requireAuth,
  uploadLimiter,
  upload.array('files', MAX_FILES),
  async (req, res, next) => {
    try {
      const { clientId, tags } = uploadSchema.parse(req.body);
      const user = (req as any).user as { role: string; clientId?: string };
      if (user.role === 'client' && clientId !== user.clientId) {
        return res.status(403).json({ error: { message: 'Forbidden', code: 'FORBIDDEN' } });
      }
      const files = (req.files as Express.Multer.File[]) ?? [];
      if (files.length === 0) {
        return res.status(400).json({ error: { message: 'No files uploaded', code: 'NO_FILES' } });
      }

      for (const f of files) {
        if (f.size > MAX_FILE_BYTES || !ALLOWED_MIME.has(f.mimetype)) {
          return res
            .status(400)
            .json({ error: { message: 'Unsupported file', code: 'BAD_FILE' } });
        }
      }

      const tagArr = tags
        ? tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 10)
        : [];
      const created: any[] = [];

      for (const file of files) {
        const { url } = await uploadFile(clientId, file.buffer, file.originalname, file.mimetype);
        if (!isDbConfigured()) {
          created.push({
            id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            clientId,
            fileUrl: url,
            fileName: file.originalname,
            fileSizeBytes: file.size,
            mimeType: file.mimetype,
            tags: tagArr,
            status: 'pending',
            uploadedAt: new Date().toISOString(),
          });
          continue;
        }
        const db = getDb();
        const [row] = await db
          .insert(clientImages)
          .values({
            clientId,
            fileUrl: url,
            fileName: file.originalname,
            fileSizeBytes: file.size,
            mimeType: file.mimetype,
            tags: tagArr,
            status: 'pending',
          })
          .returning();
        if (row) {
          created.push(row);
          // Auto-analyze in the background so the dashboard sees scores fast.
          fireAndForget(`analyze:${row.id}`, () => autoAnalyzeImage(row.id));
        }
      }

      // Broadcast so the dashboard refreshes client detail / review counts.
      broadcast({ type: 'image:uploaded', payload: { clientId, count: created.length } });

      res.status(201).json({ data: created });
    } catch (e) {
      next(e);
    }
  },
);

imagesRouter.post('/:id/analyze', requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    if (!isDbConfigured()) {
      return res.json({
        data: { id, qualityScore: 8, mood: 'warm', needsEditing: false },
      });
    }
    const db = getDb();
    const [img] = await db.select().from(clientImages).where(eq(clientImages.id, id));
    if (!img) return res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });

    const user = (req as any).user as { role: string; clientId?: string };
    if (user.role === 'client' && img.clientId !== user.clientId) {
      return res.status(403).json({ error: { message: 'Forbidden', code: 'FORBIDDEN' } });
    }

    const analysis = await runAnalysisForImage(img.id);
    res.json({ data: analysis });
  } catch (e) {
    next(e);
  }
});

imagesRouter.post('/:id/enhance', requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    if (!isDbConfigured()) {
      return res.json({ data: { id, enhancedUrl: 'https://picsum.photos/seed/e/1024' } });
    }
    const db = getDb();
    const [img] = await db.select().from(clientImages).where(eq(clientImages.id, id));
    if (!img) return res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });

    const user = (req as any).user as { role: string; clientId?: string };
    if (user.role === 'client' && img.clientId !== user.clientId) {
      return res.status(403).json({ error: { message: 'Forbidden', code: 'FORBIDDEN' } });
    }

    const prompt =
      (img.aiSuggestions as any)?.fluxKontextPrompt ??
      (typeof req.body?.prompt === 'string' ? req.body.prompt.slice(0, 500) : undefined) ??
      'Enhance lighting and color while preserving subject';
    const url = await withRetry(() => enhanceImage(img.fileUrl, prompt), {
      label: `enhance:${img.id}`,
      attempts: 2,
    });

    await db
      .update(clientImages)
      .set({ enhancedUrl: url, status: 'enhanced' })
      .where(eq(clientImages.id, img.id));

    res.json({ data: { id: img.id, enhancedUrl: url } });
  } catch (e) {
    next(e);
  }
});

imagesRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    if (!isDbConfigured()) {
      return res.json({ data: { id, deleted: true } });
    }
    const db = getDb();
    const [img] = await db.select().from(clientImages).where(eq(clientImages.id, id));
    if (!img) return res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });

    const user = (req as any).user as { role: string; clientId?: string };
    if (user.role === 'client' && img.clientId !== user.clientId) {
      return res.status(403).json({ error: { message: 'Forbidden', code: 'FORBIDDEN' } });
    }

    try {
      const key = img.fileUrl.split('/').slice(-3).join('/');
      await deleteFile(key);
    } catch {}
    await db.delete(clientImages).where(eq(clientImages.id, img.id));
    res.json({ data: { id: img.id, deleted: true } });
  } catch (e) {
    next(e);
  }
});

// -------- helpers --------

async function autoAnalyzeImage(imageId: string) {
  try {
    await runAnalysisForImage(imageId);
  } catch (e) {
    console.warn(`[autoAnalyze] failed for ${imageId}:`, (e as Error).message);
  }
}

async function runAnalysisForImage(imageId: string) {
  const db = getDb();
  const [row] = await db
    .select({ img: clientImages, client: clients })
    .from(clientImages)
    .leftJoin(clients, eq(clients.id, clientImages.clientId))
    .where(eq(clientImages.id, imageId));
  if (!row) return null;
  const { img, client } = row;

  const analysis = await withRetry(
    () =>
      analyzeImage(
        img.fileUrl,
        imageAnalysisPrompt({
          industry: client?.industry ?? 'Local Business',
          businessName: client?.businessName ?? 'Client',
        }),
      ),
    { label: `analyze:${img.id}`, attempts: 2 },
  );

  await db
    .update(clientImages)
    .set({
      aiDescription: analysis.subject ?? analysis.captionAngle ?? null,
      aiSuggestions: analysis,
      qualityScore: analysis.qualityScore ?? null,
      status: analysis.usable ? 'approved' : 'rejected',
    })
    .where(eq(clientImages.id, img.id));

  broadcast({ type: 'image:analyzed', payload: { id: img.id, score: analysis.qualityScore } });
  return analysis;
}
