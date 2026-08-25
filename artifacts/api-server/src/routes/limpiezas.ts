import { Router } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db, udnsTable, usersTable, cleaningClientsTable, cleaningAreasTable, cleaningAreaActivitiesTable, cleaningTypesTable, cleaningTypeActivitiesTable, cleaningExecutionsTable, cleaningExecutionActivitiesTable, cleaningExecutionAreasTable } from "@workspace/db";
import type { Request, Response } from "express";

const router = Router();
const json = (row: any) => row ? { id: row.id, name: row.name, plant_number: row.plantNumber, periodicity: row.periodicity, contact_name: row.contactName, contact_email: row.contactEmail, contact_phone: row.contactPhone, udn_id: row.udnId, code: row.code, description: row.description, area_type: row.areaType, client_id: row.clientId, cleaning_type_id: row.cleaningTypeId, execution_date: row.executionDate, status: row.status, started_at: row.startedAt, completed_at: row.completedAt, signature: row.signature, signature_user_name: row.signatureUserName, signed_at: row.signedAt, checklist_photos: row.checklistPhotos, initial_photo: row.initialPhoto, final_photo: row.finalPhoto, completed: row.completed, not_applicable: row.notApplicable, ready: row.ready, excluded: row.excluded, requires_photo: row.requiresPhoto, completed_at_activity: row.completedAt, sort_order: row.sortOrder, area_name: row.areaName } : row;

async function areaWithActivities(id: number) {
  const [area] = await db.select().from(cleaningAreasTable).where(eq(cleaningAreasTable.id, id));
  if (!area) return null;
  const activities = await db.select().from(cleaningAreaActivitiesTable).where(eq(cleaningAreaActivitiesTable.areaId, id)).orderBy(asc(cleaningAreaActivitiesTable.sortOrder));
  return { ...json(area), activities: activities.map((a) => ({ id: a.id, description: a.description, sort_order: a.sortOrder, requires_photo: a.requiresPhoto })) };
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
  const { name, plant_number, periodicity, contact_name, contact_email, contact_phone, udn_id } = req.body;
  const [row] = await db.insert(cleaningClientsTable).values({ name, plantNumber: plant_number, periodicity, contactName: contact_name || null, contactEmail: contact_email || null, contactPhone: contact_phone || null, udnId: udn_id || null }).returning();
  res.status(201).json(json(row));
});
router.patch("/limpiezas/clientes/:id", async (req, res) => {
  const id = Number(req.params.id); const { name, plant_number, periodicity, contact_name, contact_email, contact_phone, udn_id } = req.body;
  const [row] = await db.update(cleaningClientsTable).set({ name, plantNumber: plant_number, periodicity, contactName: contact_name || null, contactEmail: contact_email || null, contactPhone: contact_phone || null, udnId: udn_id || null }).where(eq(cleaningClientsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Cliente no encontrado" }); return; } res.json(json(row)); return;
});
router.delete("/limpiezas/clientes/:id", async (req, res) => {
  try { await db.delete(cleaningClientsTable).where(eq(cleaningClientsTable.id, Number(req.params.id))); res.status(204).send(); }
  catch { res.status(409).json({ error: "No se puede eliminar el cliente porque tiene ejecuciones registradas" }); }
});

router.get("/limpiezas/areas", async (_req, res) => { const rows = await db.select().from(cleaningAreasTable).orderBy(asc(cleaningAreasTable.name)); res.json(await Promise.all(rows.map((a) => areaWithActivities(a.id)))); });
router.post("/limpiezas/areas", async (req, res) => {
  const { name, description, area_type, client_id, activities = [] } = req.body;
  const code = `ICMX-${Date.now().toString().slice(-6)}`;
  const [area] = await db.insert(cleaningAreasTable).values({ code, name, description, areaType: area_type || "normal", clientId: client_id ? Number(client_id) : null }).returning();
  for (const [index, activity] of activities.entries()) {
    const value = typeof activity === "string" ? { description: activity, requires_photo: false } : activity;
    await db.insert(cleaningAreaActivitiesTable).values({ areaId: area.id, description: String(value.description), sortOrder: index, requiresPhoto: Boolean(value.requires_photo) });
  }
  res.status(201).json(await areaWithActivities(area.id));
});
router.patch("/limpiezas/areas/:id", async (req, res) => {
  const id = Number(req.params.id); const { name, description, area_type, client_id, activities = [] } = req.body;
  const [area] = await db.update(cleaningAreasTable).set({ name, description, areaType: area_type, clientId: client_id ? Number(client_id) : null }).where(eq(cleaningAreasTable.id, id)).returning();
  if (!area) { res.status(404).json({ error: "Área no encontrada" }); return; }
  await db.delete(cleaningAreaActivitiesTable).where(eq(cleaningAreaActivitiesTable.areaId, id));
  for (const [index, activity] of activities.entries()) {
    const value = typeof activity === "string" ? { description: activity, requires_photo: false } : activity;
    await db.insert(cleaningAreaActivitiesTable).values({ areaId: id, description: String(value.description), sortOrder: index, requiresPhoto: Boolean(value.requires_photo) });
  }
  res.json(await areaWithActivities(id));
});
router.delete("/limpiezas/areas/:id", async (req, res) => { await db.delete(cleaningAreasTable).where(eq(cleaningAreasTable.id, Number(req.params.id))); res.status(204).send(); });

router.get("/limpiezas/tipos", async (_req, res) => { const rows = await db.select().from(cleaningTypesTable).orderBy(asc(cleaningTypesTable.name)); res.json(await Promise.all(rows.map((t) => typeWithActivities(t.id)))); });
router.post("/limpiezas/tipos", async (req, res) => {
  const { client_id, name, description, activities = [] } = req.body;
  const [type] = await db.insert(cleaningTypesTable).values({ clientId: Number(client_id), name, description }).returning();
  for (const [index, activity] of activities.entries()) {
    const value = typeof activity === "string" ? { description: activity } : activity;
    await db.insert(cleaningTypeActivitiesTable).values({ cleaningTypeId: type.id, description: String(value.description || value), areaName: value.area_name || null, sortOrder: index, requiresPhoto: Boolean(value.requires_photo) });
  }
  res.status(201).json(await typeWithActivities(type.id));
});
router.patch("/limpiezas/tipos/:id", async (req, res) => {
  const id = Number(req.params.id); const { client_id, name, description, activities = [] } = req.body;
  const [type] = await db.update(cleaningTypesTable).set({ clientId: Number(client_id), name, description }).where(eq(cleaningTypesTable.id, id)).returning();
  if (!type) { res.status(404).json({ error: "Tipo no encontrado" }); return; }
  await db.delete(cleaningTypeActivitiesTable).where(eq(cleaningTypeActivitiesTable.cleaningTypeId, id));
  for (const [index, activity] of activities.entries()) {
    const value = typeof activity === "string" ? { description: activity } : activity;
    await db.insert(cleaningTypeActivitiesTable).values({ cleaningTypeId: id, description: String(value.description || value), areaName: value.area_name || null, sortOrder: index, requiresPhoto: Boolean(value.requires_photo) });
  }
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
  const [activities, areas] = await Promise.all([
    db.select().from(cleaningExecutionActivitiesTable).where(eq(cleaningExecutionActivitiesTable.executionId, id)).orderBy(asc(cleaningExecutionActivitiesTable.sortOrder)),
    db.select().from(cleaningExecutionAreasTable).where(eq(cleaningExecutionAreasTable.executionId, id)).orderBy(asc(cleaningExecutionAreasTable.sortOrder)),
  ]);
  return { ...json(execution), client: client ? json(client) : null, cleaning_type: type ? json(type) : null, areas: areas.map(json), activities: activities.map(json) };
}

async function maybeCompleteExecution(executionId: number) {
  const [activities, areas] = await Promise.all([
    db.select().from(cleaningExecutionActivitiesTable).where(eq(cleaningExecutionActivitiesTable.executionId, executionId)),
    db.select().from(cleaningExecutionAreasTable).where(eq(cleaningExecutionAreasTable.executionId, executionId)),
  ]);
  const activeAreaNames = new Set(areas.filter((area) => !area.excluded).map((area) => area.areaName));
  const relevantActivities = activities.filter((activity) => !activity.areaName || activeAreaNames.has(activity.areaName));
  if (relevantActivities.every((activity) => activity.completed || activity.notApplicable) && areas.every((area) => area.excluded || area.ready)) {
    await db.update(cleaningExecutionsTable).set({ status: "completed", completedAt: new Date() }).where(eq(cleaningExecutionsTable.id, executionId));
  }
}
router.get("/limpiezas/ejecuciones", async (_req, res) => { const rows = await db.select().from(cleaningExecutionsTable).orderBy(asc(cleaningExecutionsTable.executionDate)); res.json(await Promise.all(rows.map((r) => executionJson(r.id)))); });
router.post("/limpiezas/ejecuciones", async (req, res) => {
  const { client_id, cleaning_type_id, execution_date } = req.body;
  const [type] = await db.select().from(cleaningTypesTable).where(eq(cleaningTypesTable.id, Number(cleaning_type_id)));
  if (!type) { res.status(404).json({ error: "Flujo no encontrado" }); return; }
  const activities = await db.select().from(cleaningTypeActivitiesTable).where(eq(cleaningTypeActivitiesTable.cleaningTypeId, type.id)).orderBy(asc(cleaningTypeActivitiesTable.sortOrder));
  if (!activities.length) { res.status(400).json({ error: "El flujo no tiene actividades" }); return; }
  const [execution] = await db.insert(cleaningExecutionsTable).values({ clientId: Number(client_id), cleaningTypeId: type.id, executionDate: execution_date || new Date().toISOString().slice(0, 10) }).returning();
  for (const activity of activities) await db.insert(cleaningExecutionActivitiesTable).values({ executionId: execution.id, description: activity.description, areaName: activity.areaName, sortOrder: activity.sortOrder, requiresPhoto: activity.requiresPhoto });
  const areaNames = Array.from(new Set(activities.map((activity) => activity.areaName || "Área general")));
  for (const [index, areaName] of areaNames.entries()) await db.insert(cleaningExecutionAreasTable).values({ executionId: execution.id, areaName, sortOrder: index });
  res.status(201).json(await executionJson(execution.id));
});
router.get("/limpiezas/ejecuciones/:id", async (req, res) => { const data = await executionJson(Number(req.params.id)); if (!data) { res.status(404).json({ error: "Ejecución no encontrada" }); return; } res.json(data); });
router.delete("/limpiezas/ejecuciones/:id", async (req, res) => {
  const userId = (req.session as unknown as Record<string, unknown>).userId as number | undefined;
  if (!userId) { res.status(401).json({ error: "No autenticado" }); return; }
  const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user || (user.role !== "admin" && user.role !== "superadmin")) { res.status(403).json({ error: "Sólo un administrador puede eliminar reportes" }); return; }
  await db.delete(cleaningExecutionsTable).where(eq(cleaningExecutionsTable.id, Number(req.params.id))); res.status(204).send();
});
router.patch("/limpiezas/ejecuciones/:id/areas/:areaId", async (req, res) => {
  const executionId = Number(req.params.id); const areaId = Number(req.params.areaId);
  const [current] = await db.select().from(cleaningExecutionAreasTable).where(and(eq(cleaningExecutionAreasTable.id, areaId), eq(cleaningExecutionAreasTable.executionId, executionId)));
  if (!current) { res.status(404).json({ error: "Área de ejecución no encontrada" }); return; }
  const initialPhoto = req.body.initial_photo ?? current.initialPhoto;
  const finalPhoto = req.body.final_photo ?? current.finalPhoto;
  const ready = req.body.ready ?? current.ready;
  const excluded = req.body.excluded ?? current.excluded;
  if (!excluded && ready && (!initialPhoto || !finalPhoto)) { res.status(400).json({ error: "El área requiere foto inicial y final antes de marcarla como lista" }); return; }
  if (!excluded && req.body.final_photo && !current.excluded) {
    const activities = await db.select().from(cleaningExecutionActivitiesTable).where(eq(cleaningExecutionActivitiesTable.executionId, executionId));
    const areaActivities = activities.filter((activity) => (activity.areaName || "Área general") === current.areaName);
    if (areaActivities.some((activity) => !activity.completed && !activity.notApplicable)) { res.status(400).json({ error: "La foto final se habilita después de completar las actividades del área" }); return; }
  }
  const [updated] = await db.update(cleaningExecutionAreasTable).set({ initialPhoto, finalPhoto, ready: excluded ? false : ready, excluded }).where(eq(cleaningExecutionAreasTable.id, areaId)).returning();
  await maybeCompleteExecution(executionId);
  res.json(json(updated));
});
router.patch("/limpiezas/ejecuciones/:id/actividades/:activityId", async (req, res) => {
  const executionId = Number(req.params.id); const activityId = Number(req.params.activityId);
  const { initial_photo, final_photo, completed, not_applicable } = req.body;
  const [current] = await db.select().from(cleaningExecutionActivitiesTable).where(and(eq(cleaningExecutionActivitiesTable.id, activityId), eq(cleaningExecutionActivitiesTable.executionId, executionId)));
  if (!current) { res.status(404).json({ error: "Actividad no encontrada" }); return; }
  const nextInitial = initial_photo ?? current.initialPhoto; const nextFinal = final_photo ?? current.finalPhoto; const nextCompleted = completed ?? current.completed; const nextNotApplicable = not_applicable ?? current.notApplicable;
  if (nextCompleted && nextNotApplicable) { res.status(400).json({ error: "Una actividad no puede estar completada y marcada como no aplica" }); return; }
   if (nextCompleted && current.requiresPhoto && (!nextInitial || !nextFinal)) { res.status(400).json({ error: "Esta actividad requiere foto inicial y foto final antes de completarse" }); return; }
  const [updated] = await db.update(cleaningExecutionActivitiesTable).set({ initialPhoto: nextInitial, finalPhoto: nextFinal, completed: nextCompleted, notApplicable: nextNotApplicable, completedAt: nextCompleted ? new Date() : null }).where(eq(cleaningExecutionActivitiesTable.id, activityId)).returning();
  await maybeCompleteExecution(executionId);
  res.json(json(updated));
});

export default router;