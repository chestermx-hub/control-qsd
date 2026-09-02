import { Router } from "express";
import { db, defectZonesTable, defectsTable, zonesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response } from "express";

const router = Router();

type ApplicableZone = { id: number; name: string };

function toJson(row: typeof defectsTable.$inferSelect, applicableZones: ApplicableZone[] = []) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    created_at: row.createdAt,
    applicable_zones: applicableZones,
  };
}

async function getZoneMap(defectIds?: number[]) {
  const rows = await db
    .select({ defectId: defectZonesTable.defectId, zoneId: zonesTable.id, zoneName: zonesTable.name })
    .from(defectZonesTable)
    .innerJoin(zonesTable, eq(defectZonesTable.zoneId, zonesTable.id));
  const allowed = defectIds ? new Set(defectIds) : null;
  const zoneMap = new Map<number, ApplicableZone[]>();
  for (const row of rows) {
    if (allowed && !allowed.has(row.defectId)) continue;
    zoneMap.set(row.defectId, [...(zoneMap.get(row.defectId) || []), { id: row.zoneId, name: row.zoneName }]);
  }
  return zoneMap;
}

async function defectJson(id: number) {
  const [row] = await db.select().from(defectsTable).where(eq(defectsTable.id, id));
  if (!row) return null;
  const zoneMap = await getZoneMap([id]);
  return toJson(row, zoneMap.get(id) || []);
}

function normalizeZoneIds(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  return Array.from(new Set(value.map(Number).filter((id) => Number.isInteger(id) && id > 0)));
}

async function replaceDefectZones(defectId: number, zoneIds: number[]) {
  await db.delete(defectZonesTable).where(eq(defectZonesTable.defectId, defectId));
  if (zoneIds.length) {
    await db.insert(defectZonesTable).values(zoneIds.map((zoneId) => ({ defectId, zoneId })));
  }
}

router.get("/defects", async (_req: Request, res: Response) => {
  const rows = await db.select().from(defectsTable).orderBy(defectsTable.name);
  const zoneMap = await getZoneMap(rows.map((row) => row.id));
  res.json(rows.map((row) => toJson(row, zoneMap.get(row.id) || [])));
});

router.post("/defects", async (req: Request, res: Response) => {
  const { name, code, description } = req.body as { name: string; code: string; description?: string };
  const zoneIds = normalizeZoneIds(req.body.zone_ids) || [];
  try {
    const [row] = await db.insert(defectsTable).values({ name, code, description }).returning();
    await replaceDefectZones(row!.id, zoneIds);
    res.status(201).json(await defectJson(row!.id));
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "El código ya está en uso por otro defecto." });
      return;
    }
    throw err;
  }
});

router.get("/defects/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  const defect = await defectJson(id);
  if (!defect) { res.status(404).json({ error: "Not found" }); return; }
  res.json(defect);
});

router.patch("/defects/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  const { name, code, description } = req.body as { name?: string; code?: string; description?: string };
  const zoneIds = normalizeZoneIds(req.body.zone_ids);
  const updates: Partial<typeof defectsTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (code !== undefined) updates.code = code;
  if (description !== undefined) updates.description = description;
  try {
    const [row] = await db.update(defectsTable).set(updates).where(eq(defectsTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    if (zoneIds !== undefined) await replaceDefectZones(id, zoneIds);
    res.json(await defectJson(id));
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "El código ya está en uso por otro defecto." });
      return;
    }
    throw err;
  }
});

router.delete("/defects/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  await db.delete(defectsTable).where(eq(defectsTable.id, id));
  res.status(204).send();
});

export default router;
