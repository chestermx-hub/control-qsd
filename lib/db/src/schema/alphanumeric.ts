import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const alphanumericTable = pgTable("alphanumeric_records", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAlphanumericSchema = createInsertSchema(alphanumericTable).omit({ id: true, createdAt: true });
export const updateAlphanumericSchema = insertAlphanumericSchema.partial();
export type InsertAlphanumeric = z.infer<typeof insertAlphanumericSchema>;
export type AlphanumericRecord = typeof alphanumericTable.$inferSelect;
