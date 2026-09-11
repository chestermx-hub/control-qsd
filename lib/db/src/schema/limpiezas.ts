import { pgTable, serial, text, integer, timestamp, date, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { udnsTable } from "./udns";

export const cleaningClientsTable = pgTable("cleaning_clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  plantNumber: text("plant_number").notNull(),
  lineNumber: text("line_number"),
  periodicity: text("periodicity").notNull(),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  udnId: integer("udn_id").references(() => udnsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cleaningClientLinesTable = pgTable("cleaning_client_lines", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => cleaningClientsTable.id, { onDelete: "cascade" }),
  lineNumber: text("line_number").notNull(),
  lineName: text("line_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  clientLineUnique: uniqueIndex("cleaning_client_lines_client_line_idx").on(table.clientId, table.lineNumber),
}));

export const cleaningAreasTable = pgTable("cleaning_areas", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  areaType: text("area_type").notNull().default("normal"),
  clientId: integer("client_id").references(() => cleaningClientsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cleaningAreaActivitiesTable = pgTable("cleaning_area_activities", {
  id: serial("id").primaryKey(),
  areaId: integer("area_id").notNull().references(() => cleaningAreasTable.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  activityDescription: text("activity_description"),
  sortOrder: integer("sort_order").notNull().default(0),
  requiresPhoto: boolean("requires_photo").notNull().default(false),
});

export const cleaningAreaClientsTable = pgTable("cleaning_area_clients", {
  id: serial("id").primaryKey(),
  areaId: integer("area_id").notNull().references(() => cleaningAreasTable.id, { onDelete: "cascade" }),
  clientId: integer("client_id").notNull().references(() => cleaningClientsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  areaClientUnique: uniqueIndex("cleaning_area_clients_area_client_idx").on(table.areaId, table.clientId),
}));

export const cleaningAreaClientLinesTable = pgTable("cleaning_area_client_lines", {
  id: serial("id").primaryKey(),
  areaClientId: integer("area_client_id").notNull().references(() => cleaningAreaClientsTable.id, { onDelete: "cascade" }),
  clientLineId: integer("client_line_id").notNull().references(() => cleaningClientLinesTable.id, { onDelete: "cascade" }),
}, (table) => ({
  areaClientLineUnique: uniqueIndex("cleaning_area_client_lines_assignment_line_idx").on(table.areaClientId, table.clientLineId),
}));

export const cleaningAreaClientActivitiesTable = pgTable("cleaning_area_client_activities", {
  id: serial("id").primaryKey(),
  areaClientId: integer("area_client_id").notNull().references(() => cleaningAreaClientsTable.id, { onDelete: "cascade" }),
  clientLineId: integer("client_line_id").references(() => cleaningClientLinesTable.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  activityDescription: text("activity_description"),
  sortOrder: integer("sort_order").notNull().default(0),
  requiresPhoto: boolean("requires_photo").notNull().default(false),
});

export const cleaningTypesTable = pgTable("cleaning_types", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => cleaningClientsTable.id, { onDelete: "cascade" }),
  lineNumber: text("line_number"),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cleaningTypeActivitiesTable = pgTable("cleaning_type_activities", {
  id: serial("id").primaryKey(),
  cleaningTypeId: integer("cleaning_type_id").notNull().references(() => cleaningTypesTable.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  activityDescription: text("activity_description"),
  areaName: text("area_name"),
  sortOrder: integer("sort_order").notNull().default(0),
  requiresPhoto: boolean("requires_photo").notNull().default(false),
});

export const cleaningExecutionsTable = pgTable("cleaning_executions", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => cleaningClientsTable.id),
  cleaningTypeId: integer("cleaning_type_id").notNull().references(() => cleaningTypesTable.id),
  lineNumber: text("line_number"),
  executionDate: date("execution_date").notNull(),
  status: text("status").notNull().default("in_progress"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  signature: text("signature"),
  signatureUserName: text("signature_user_name"),
  signedAt: timestamp("signed_at"),
  checklistPhotos: text("checklist_photos").array(),
});

export const cleaningExecutionActivitiesTable = pgTable("cleaning_execution_activities", {
  id: serial("id").primaryKey(),
  executionId: integer("execution_id").notNull().references(() => cleaningExecutionsTable.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  activityDescription: text("activity_description"),
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
  intermediatePhoto: text("intermediate_photo"),
  finalPhoto: text("final_photo"),
  ready: boolean("ready").notNull().default(false),
  excluded: boolean("excluded").notNull().default(false),
});