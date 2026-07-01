import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const udnsTable = pgTable("udns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUdnSchema = createInsertSchema(udnsTable).omit({ id: true, createdAt: true });
export const updateUdnSchema = insertUdnSchema.partial();
export type InsertUdn = z.infer<typeof insertUdnSchema>;
export type Udn = typeof udnsTable.$inferSelect;
