import { integer, pgTable, primaryKey } from "drizzle-orm/pg-core";
import { defectsTable } from "./defects";
import { zonesTable } from "./zones";

export const defectZonesTable = pgTable(
  "defect_zones",
  {
    defectId: integer("defect_id").notNull().references(() => defectsTable.id, { onDelete: "cascade" }),
    zoneId: integer("zone_id").notNull().references(() => zonesTable.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.defectId, table.zoneId] }),
  }),
);

export type DefectZone = typeof defectZonesTable.$inferSelect;