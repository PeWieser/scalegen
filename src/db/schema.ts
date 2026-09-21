import { jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import type { ScaleParams } from "@/core/scale-engine/types";

/** Saved scales – only parameters are stored, geometry is always recomputed. */
export const scales = pgTable("scales", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  params: jsonb("params").$type<ScaleParams>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type SavedScale = typeof scales.$inferSelect;
