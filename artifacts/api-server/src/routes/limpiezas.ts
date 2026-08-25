import { Router } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db, udnsTable, cleaningClientsTable, cleaningAreasTable, cleaningAreaActivitiesTable, cleaningTypesTable, cleaningTypeActivitiesTable, cleaningExecutionsTable, cleaningExecutionActivitiesTable } from "@workspace/db";
import type { Request, Response } from "express";

const router = Router();
const json = (row: any) => row ? { id: row.id, name: row.name, plant_number: row.plantNumber, periodicity: row.periodicity, udn_id: row.udnId, code: row.code, description: row.description, area_type: row.areaType, client_id: row.clientId, cleaning_type_id: row.cleaningTypeId, execution_date: row.executionDate, status: row.status, started_at: row.startedAt, completed_at: row.completedAt, initial_photo: row.initialPhoto, final_photo: row.finalPhoto, completed: row.completed, completed_at_activity: row.completedAt, sort_order: row.sortOrder, area_name: row.areaName } : row;

async function areaWithActivities(id: number) {
  const [area] = await db.select().from(cleaningAreasTable).where(eq(cleaningAreasTable.id, id));
  if (!area) return null;
  const activities = await db.select().from(cleaningAreaActivitiesTable).where(eq(cleaningAreaActivitiesTable.areaId, id)).orderBy(asc(cleaningAreaActivitiesTable.sortOrder));
  return { ...json(area), activities: activities.map((a) => ({ id: a.id, description: a.description, sort_order: a.sortOrder })) };
}

async function typeWithActivities(id: number) {
  const [type] = await db.select().from(cleaningTypesTable).where(eq(cleaningTypesTable.id, id));
  if (!type) return null;
  const activities = await db.select().from(cleaningTypeActivitiesTable).where(eq(cleaningTypeActivitiesTable.cleaningTypeId, id)).orderBy(asc(cleaningTypeActivitiesTable.sortOrder));
  return { ...json(type), activities: activities.map((a) => json(a)) };
}

router.get("/limpiezas/catalogs", async (_req, res) => {
  const [clients, udns, areas, types] = await Promise.all([
    db.select().from(cleaningClientsTable).orderBy(asc(cleaningClientsTable.name)),
    db.select().from(udnsTable).orderBy(asc(udnsTable.name)),
    db.select().from(cleaningAreasTable).orderBy(asc(cleaningAreasTable.name)),
    db.select().from(cleaningTypesTable).orderBy(asc(cleaningTypesTable.name)),
  ]);
  res.json({ clients: clients.map(json), udns: udns.map((u) => ({ id: u.id, name: u.name, code: u.code })), areas: await Promise.all(areas.map((a) => areaWithActivities(a.id))), types: await Promise.all(types.map((t) => typeWithActivities(t.id))) });
});

router.get("/limpiezas/clientes", async (_req, res) => res.json((await db.select().from(cleaningClientsTable).orderBy(asc(cleaningClientsTable.name))).map(json)));
router.post("/limpiezas/clientes", async (req, res) => {
  const { name, plant_number, periodicity, udn_id } = req.body;
  const [row] = await db.insert(cleaningClientsTable).values({ name, plantNumber: plant_number, periodicity, udnId: udn_id || null }).returning();
  res.status(201).json(json(row));
});
router.patch("/limpiezas/clientes/:id", async (req, res) => {
  const id = Number(req.params.id); const { name, plant_number, periodicity, udn_id } = req.body;
  const [row] = await db.update(cleaningClientsTable).set({ name, plantNumber: plant_number, periodicity, udnId: udn_id || null }).where(eq(cleaningClientsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Cliente no encontrado" }); return; } res.json(json(row)); return;
});
router.delete("/limpiezas/clientes/:id", async (req, res) => {
  try { await db.delete(cleaningClientsTable).where(eq(cleaningClientsTable.id, Number(req.params.id))); res.status(204).send(); }
  catch { res.status(409).json({ error: "No se puede eliminar el cliente porque tiene ejecuciones registradas" }); }
});

router.get("/limpiezas/areas", async (_req, res) => { const rows = await db.select().from(cleaningAreasTable).orderBy(asc(cleaningAreasTable.name)); res.json(await Promise.all(rows.map((a) => areaWithActivities(a.id)))); });
router.post("/limpiezas/areas", async (req, res) => {
  const { name, description, area_type, activities = [] } = req.body;
  const code = `ICMX-${Date.now().toString().slice(-6)}`;
  const [area] = await db.insert(cleaningAreasTable).values({ code, name, description, areaType: area_type || "normal" }).returning();
  for (const [index, activity] of activities.entries()) await db.insert(cleaningAreaActivitiesTable).values({ areaId: area.id, description: String(activity), sortOrder: index });
  res.status(201).json(await areaWithActivities(area.id));
});
router.patch("/limpiezas/areas/:id", async (req, res) => {
  const id = Number(req.params.id); const { name, description, area_type, activities = [] } = req.body;
  const [area] = await db.update(cleaningAreasTable).set({ name, description, areaType: area_type }).where(eq(cleaningAreasTable.id, id)).returning();
  if (!area) { res.status(404).json({ error: "Área no encontrada" }); return; }
  await db.delete(cleaningAreaActivitiesTable).where(eq(cleaningAreaActivitiesTable.areaId, id));
  for (const [index, activity] of activities.entries()) await db.insert(cleaningAreaActivitiesTable).values({ areaId: id, description: String(activity), sortOrder: index });
  res.json(await areaWithActivities(id));
});
router.delete("/limpiezas/areas/:id", async (req, res) => { await db.delete(cleaningAreasTable).where(eq(cleaningAreasTable.id, Number(req.params.id))); res.status(204).send(); });

router.get("/limpiezas/tipos", async (_req, res) => { const rows = await db.select().from(cleaningTypesTable).orderBy(asc(cleaningTypesTable.name)); res.json(await Promise.all(rows.map((t) => typeWithActivities(t.id)))); });
router.post("/limpiezas/tipos", async (req, res) => {
  const { client_id, name, description, activities = [] } = req.body;
  const [type] = await db.insert(cleaningTypesTable).values({ clientId: Number(client_id), name, description }).returning();
  for (const [index, activity] of activities.entries()) await db.insert(cleaningTypeActivitiesTable).values({ cleaningTypeId: type.id, description: String(activity.description || activity), areaName: activity.area_name || null, sortOrder: index });
  res.status(201).json(await typeWithActivities(type.id));
});
router.patch("/limpiezas/tipos/:id", async (req, res) => {
  const id = Number(req.params.id); const { client_id, name, description, activities = [] } = req.body;
  const [type] = await db.update(cleaningTypesTable).set({ clientId: Number(client_id), name, description }).where(eq(cleaningTypesTable.id, id)).returning();
  if (!type) { res.status(404).json({ error: "Tipo no encontrado" }); return; }
  await db.delete(cleaningTypeActivitiesTable).where(eq(cleaningTypeActivitiesTable.cleaningTypeId, id));
  for (const [index, activity] of activities.entries()) await db.insert(cleaningTypeActivitiesTable).values({ cleaningTypeId: id, description: String(activity.description || activity), areaName: activity.area_name || null, sortOrder: index });
  res.json(await typeWithActivities(id));
});
router.delete("/limpiezas/tipos/:id", async (req, res) => {
  try { await db.delete(cleaningTypesTable).where(eq(cleaningTypesTable.id, Number(req.params.id))); res.status(204).send(); }
  catch { res.status(409).json({ error: "No se puede eliminar el flujo porque tiene ejecuciones registradas" }); }
});

async function executionJson(id: number) {
  const [execution] = await db.select().from(cleaningExecutionsTable).where(eq(cleaningExecutionsTable.id, id));
  if (!execution) return null;
  const [client] = await db.select().from(cleaningClientsTable).where(eq(cleaningClientsTable.id, execution.clientId));
  const [type] = await db.select().from(cleaningTypesTable).where(eq(cleaningTypesTable.id, execution.cleaningTypeId));
  const activities = await db.select().from(cleaningExecutionActivitiesTable).where(eq(cleaningExecutionActivitiesTable.executionId, id)).orderBy(asc(cleaningExecutionActivitiesTable.sortOrder));
  return { ...json(execution), client: client ? json(client) : null, cleaning_type: type ? json(type) : null, activities: activities.map(json) };
}
router.get("/limpiezas/ejecuciones", async (_req, res) => { const rows = await db.select().from(cleaningExecutionsTable).orderBy(asc(cleaningExecutionsTable.executionDate)); res.json(await Promise.all(rows.map((r) => executionJson(r.id)))); });
router.post("/limpiezas/ejecuciones", async (req, res) => {
  const { client_id, cleaning_type_id, execution_date } = req.body;
  const [type] = await db.select().from(cleaningTypesTable).where(eq(cleaningTypesTable.id, Number(cleaning_type_id)));
  if (!type) { res.status(404).json({ error: "Flujo no encontrado" }); return; }
  const activities = await db.select().from(cleaningTypeActivitiesTable).where(eq(cleaningTypeActivitiesTable.cleaningTypeId, type.id)).orderBy(asc(cleaningTypeActivitiesTable.sortOrder));
  if (!activities.length) { res.status(400).json({ error: "El flujo no tiene actividades" }); return; }
  const [execution] = await db.insert(cleaningExecutionsTable).values({ clientId: Number(client_id), cleaningTypeId: type.id, executionDate: execution_date || new Date().toISOString().slice(0, 10) }).returning();
  for (const activity of activities) await db.insert(cleaningExecutionActivitiesTable).values({ executionId: execution.id, description: activity.description, areaName: activity.areaName, sortOrder: activity.sortOrder });
  res.status(201).json(await executionJson(execution.id));
});
router.get("/limpiezas/ejecuciones/:id", async (req, res) => { const data = await executionJson(Number(req.params.id)); if (!data) { res.status(404).json({ error: "Ejecución no encontrada" }); return; } res.json(data); });
router.delete("/limpiezas/ejecuciones/:id", async (req, res) => { await db.delete(cleaningExecutionsTable).where(eq(cleaningExecutionsTable.id, Number(req.params.id))); res.status(204).send(); });
router.patch("/limpiezas/ejecuciones/:id/actividades/:activityId", async (req, res) => {
  const executionId = Number(req.params.id); const activityId = Number(req.params.activityId);
  const { initial_photo, final_photo, completed } = req.body;
  const [current] = await db.select().from(cleaningExecutionActivitiesTable).where(and(eq(cleaningExecutionActivitiesTable.id, activityId), eq(cleaningExecutionActivitiesTable.executionId, executionId)));
  if (!current) { res.status(404).json({ error: "Actividad no encontrada" }); return; }
  const nextInitial = initial_photo ?? current.initialPhoto; const nextFinal = final_photo ?? current.finalPhoto; const nextCompleted = completed ?? current.completed;
  if (nextCompleted && (!nextInitial || !nextFinal)) { res.status(400).json({ error: "Cada actividad requiere foto inicial y final" }); return; }
  const [updated] = await db.update(cleaningExecutionActivitiesTable).set({ initialPhoto: nextInitial, finalPhoto: nextFinal, completed: nextCompleted, completedAt: nextCompleted ? new Date() : null }).where(eq(cleaningExecutionActivitiesTable.id, activityId)).returning();
  const all = await db.select().from(cleaningExecutionActivitiesTable).where(eq(cleaningExecutionActivitiesTable.executionId, executionId));
  if (all.length && all.every((a) => a.completed && a.initialPhoto && a.finalPhoto)) await db.update(cleaningExecutionsTable).set({ status: "completed", completedAt: new Date() }).where(eq(cleaningExecutionsTable.id, executionId));
  res.json(json(updated));
});

export default router;