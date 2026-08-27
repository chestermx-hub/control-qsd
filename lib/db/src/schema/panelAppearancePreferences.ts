import { pgTable, serial, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { panelsTable } from "./panels";

export const panelAppearancePreferencesTable = pgTable(
  "panel_appearance_preferences",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    panelId: integer("panel_id").notNull().references(() => panelsTable.id, { onDelete: "cascade" }),
    diagramTint: text("diagram_tint"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userPanelUnique: uniqueIndex("panel_appearance_preferences_user_panel_idx").on(table.userId, table.panelId),
  }),
);

export type PanelAppearancePreference = typeof panelAppearancePreferencesTable.$inferSelect;