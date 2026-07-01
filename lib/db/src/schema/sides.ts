import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sidesTable = pgTable("sides", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSideSchema = createInsertSchema(sidesTable).omit({ id: true, createdAt: true });
export const updateSideSchema = insertSideSchema.partial();
export type InsertSide = z.infer<typeof insertSideSchema>;
export type Side = typeof sidesTable.$inferSelect;
