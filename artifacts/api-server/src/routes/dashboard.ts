import { Router } from "express";
import { db, usersTable, udnsTable, zonesTable, defectsTable, panelsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import type { Request, Response } from "express";

const router = Router();

router.get("/dashboard/stats", async (_req: Request, res: Response) => {
  const [users, udns, zones, defects, panels, recentUsersRaw] = await Promise.all([
    db.select().from(usersTable),
    db.select().from(udnsTable),
    db.select().from(zonesTable),
    db.select().from(defectsTable),
    db.select().from(panelsTable),
    db.select().from(usersTable).orderBy(desc(usersTable.createdAt)).limit(5),
  ]);

  res.json({
    totalUsers: users.length,
    totalUdns: udns.length,
    totalZones: zones.length,
    totalDefects: defects.length,
    totalPanels: panels.length,
    recentUsers: recentUsersRaw.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      puesto: u.puesto,
      area: u.area,
      profile_id: u.profileId,
      udn_id: u.udnId,
      role: u.role,
      created_at: u.createdAt,
    })),
  });
});

export default router;
