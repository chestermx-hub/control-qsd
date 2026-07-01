import { pgTable, serial, text, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { udnsTable } from "./udns";
import { profilesTable } from "./profiles";

export const userRoleEnum = pgEnum("user_role", ["superadmin", "admin", "user"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  puesto: text("puesto").notNull().default(""),
  area: text("area").notNull().default(""),
  profileId: integer("profile_id").references(() => profilesTable.id, { onDelete: "set null" }),
  udnId: integer("udn_id").references(() => udnsTable.id, { onDelete: "set null" }),
  role: userRoleEnum("role").notNull().default("user"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, passwordHash: true }).extend({
  password: z.string().min(6),
});
export const updateUserSchema = insertUserSchema.partial();
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
