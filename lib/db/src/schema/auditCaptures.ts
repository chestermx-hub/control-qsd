import { pgTable, serial, text, timestamp, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { panelsTable } from "./panels";
import { sidesTable } from "./sides";
import { visualZonesTable } from "./visualZones";
import { defectsTable } from "./defects";
import { zonesTable } from "./zones";

export const auditCapturesTable = pgTable("audit_captures", {
  id: serial("id").primaryKey(),
  unitNumber: integer("unit_number").notNull(),
  weekNumber: integer("week_number").notNull(),
  date: date("date").notNull(),
  skillNumber: text("skill_number"),
  zoneId: integer("zone_id").references(() => zonesTable.id, { onDelete: "set null" }),
  panelId: integer("panel_id").references(() => panelsTable.id, { onDelete: "set null" }),
  sideId: integer("side_id").references(() => sidesTable.id, { onDelete: "set null" }),
  visualZoneId: integer("visual_zone_id").references(() => visualZonesTable.id, { onDelete: "set null" }),
  alphanumericId: integer("alphanumeric_id"),
  gridCol: integer("grid_col").notNull(),
  gridRow: text("grid_row").notNull(),
  defectId: integer("defect_id").references(() => defectsTable.id, { onDelete: "set null" }),
  defectOther: text("defect_other"),
  quantity: integer("quantity").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAuditCaptureSchema = createInsertSchema(auditCapturesTable).omit({ id: true, createdAt: true });
export const updateAuditCaptureSchema = insertAuditCaptureSchema.partial();
export type InsertAuditCapture = z.infer<typeof insertAuditCaptureSchema>;
export type AuditCapture = typeof auditCapturesTable.$inferSelect;
