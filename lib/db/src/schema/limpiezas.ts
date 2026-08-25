import { pgTable, serial, text, integer, timestamp, date, boolean } from "drizzle-orm/pg-core";
import { udnsTable } from "./udns";

export const cleaningClientsTable = pgTable("cleaning_clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  plantNumber: text("plant_number").notNull(),
  periodicity: text("periodicity").notNull(),
  udnId: integer("udn_id").references(() => udnsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cleaningAreasTable = pgTable("cleaning_areas", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  areaType: text("area_type").notNull().default("normal"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cleaningAreaActivitiesTable = pgTable("cleaning_area_activities", {
  id: serial("id").primaryKey(),
  areaId: integer("area_id").notNull().references(() => cleaningAreasTable.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  requiresPhoto: boolean("requires_photo").notNull().default(false),
});

export const cleaningTypesTable = pgTable("cleaning_types", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => cleaningClientsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cleaningTypeActivitiesTable = pgTable("cleaning_type_activities", {
  id: serial("id").primaryKey(),
  cleaningTypeId: integer("cleaning_type_id").notNull().references(() => cleaningTypesTable.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  areaName: text("area_name"),
  sortOrder: integer("sort_order").notNull().default(0),
  requiresPhoto: boolean("requires_photo").notNull().default(false),
});

export const cleaningExecutionsTable = pgTable("cleaning_executions", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => cleaningClientsTable.id),
  cleaningTypeId: integer("cleaning_type_id").notNull().references(() => cleaningTypesTable.id),
  executionDate: date("execution_date").notNull(),
  status: text("status").notNull().default("in_progress"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const cleaningExecutionActivitiesTable = pgTable("cleaning_execution_activities", {
  id: serial("id").primaryKey(),
  executionId: integer("execution_id").notNull().references(() => cleaningExecutionsTable.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  areaName: text("area_name"),
  sortOrder: integer("sort_order").notNull().default(0),
  initialPhoto: text("initial_photo"),
  finalPhoto: text("final_photo"),
  requiresPhoto: boolean("requires_photo").notNull().default(false),
  completed: boolean("completed").notNull().default(false),
  notApplicable: boolean("not_applicable").notNull().default(false),
  completedAt: timestamp("completed_at"),
});

export const cleaningExecutionAreasTable = pgTable("cleaning_execution_areas", {
  id: serial("id").primaryKey(),
  executionId: integer("execution_id").notNull().references(() => cleaningExecutionsTable.id, { onDelete: "cascade" }),
  areaName: text("area_name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  initialPhoto: text("initial_photo"),
  finalPhoto: text("final_photo"),
  ready: boolean("ready").notNull().default(false),
});