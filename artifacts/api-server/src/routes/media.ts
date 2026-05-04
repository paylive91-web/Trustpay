import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

/**
 * GET /media/:id
 *
 * Serves an admin-uploaded image from the media_blobs table. This is the
 * storage path used when PRIVATE_OBJECT_DIR is not set (e.g. on Render),
 * so admin-uploaded banners / rules images / invite share image stay as
 * short URLs in settings.value instead of multi-MB base64 data URLs.
 */
router.get("/media/:id", async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid media id" });
    return;
  }
  try {
    const result: any = await db.execute(
      sql`SELECT mime, data FROM media_blobs WHERE id = ${id} LIMIT 1`,
    );
    const row = (result.rows || result || [])[0];
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const mime: string = row.mime || "application/octet-stream";
    const raw = row.data;
    // pg returns BYTEA as a Node Buffer already
    const buf: Buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Length", String(buf.length));
    res.setHeader("Cache-Control", "public, max-age=86400, immutable");
    res.status(200).end(buf);
  } catch (err) {
    req.log.error({ err, id }, "media serve failed");
    res.status(500).json({ error: "Failed to serve media" });
  }
});

export default router;
