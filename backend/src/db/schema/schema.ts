import { pgTable, uuid, text, timestamp, integer, date } from 'drizzle-orm/pg-core';
import { user } from './auth-schema.js';

export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('user'),
  stressThreshold: integer('stress_threshold').notNull().default(70),
  heartRateThreshold: integer('heart_rate_threshold').notNull().default(100),
  trialStartedAt: timestamp('trial_started_at', { withTimezone: true }),
  subscriptionStatus: text('subscription_status').notNull().default('trial'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const healthEntries = pgTable('health_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  stressScore: integer('stress_score'),
  heartRate: integer('heart_rate'),
  hrv: integer('hrv'),
  sleepScore: integer('sleep_score'),
  sleepDurationMinutes: integer('sleep_duration_minutes'),
  sleepDate: date('sleep_date'),
  source: text('source').notNull().default('manual'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
