import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, gte, isNotNull, or, desc } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

interface CreateHealthEntryBody {
  stress_score?: number | null;
  heart_rate?: number | null;
  hrv?: number | null;
  sleep_score?: number | null;
  sleep_duration_minutes?: number | null;
  sleep_date?: string | null;
  recorded_at?: string;
  source?: string;
}

interface HealthEntriesQuery {
  days?: string;
  type?: string;
}

export function registerHealthRoutes(app: App) {
  app.fastify.post(
    '/api/health/entries',
    {
      schema: {
        description: 'Save a health data entry',
        tags: ['health'],
        body: {
          type: 'object',
          properties: {
            stress_score: { type: ['integer', 'null'], minimum: 0, maximum: 100 },
            heart_rate: { type: ['integer', 'null'], minimum: 30, maximum: 220 },
            hrv: { type: ['integer', 'null'] },
            sleep_score: { type: ['integer', 'null'], minimum: 0, maximum: 100 },
            sleep_duration_minutes: { type: ['integer', 'null'] },
            sleep_date: { type: ['string', 'null'], format: 'date' },
            recorded_at: { type: 'string', format: 'date-time' },
            source: { type: 'string' },
          },
        },
        response: {
          201: {
            description: 'Health entry created',
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              user_id: { type: 'string' },
              recorded_at: { type: 'string', format: 'date-time' },
              stress_score: { type: ['integer', 'null'] },
              heart_rate: { type: ['integer', 'null'] },
              hrv: { type: ['integer', 'null'] },
              sleep_score: { type: ['integer', 'null'] },
              sleep_duration_minutes: { type: ['integer', 'null'] },
              sleep_date: { type: ['string', 'null'] },
              source: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
          401: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateHealthEntryBody }>, reply: FastifyReply) => {
      const session = await app.requireAuth()(request, reply);
      if (!session) return;

      const {
        stress_score,
        heart_rate,
        hrv,
        sleep_score,
        sleep_duration_minutes,
        sleep_date,
        recorded_at,
        source,
      } = request.body;

      app.logger.info(
        { userId: session.user.id, source: source || 'manual', stress_score, heart_rate },
        'Creating health entry'
      );

      const [created] = await app.db
        .insert(schema.healthEntries)
        .values({
          userId: session.user.id,
          recordedAt: recorded_at ? new Date(recorded_at) : new Date(),
          stressScore: stress_score ?? null,
          heartRate: heart_rate ?? null,
          hrv: hrv ?? null,
          sleepScore: sleep_score ?? null,
          sleepDurationMinutes: sleep_duration_minutes ?? null,
          sleepDate: sleep_date ?? null,
          source: source || 'manual',
        })
        .returning();

      app.logger.info({ userId: session.user.id, entryId: created.id }, 'Health entry created');

      reply.status(201);
      return {
        id: created.id,
        user_id: created.userId,
        recorded_at: created.recordedAt,
        stress_score: created.stressScore,
        heart_rate: created.heartRate,
        hrv: created.hrv,
        sleep_score: created.sleepScore,
        sleep_duration_minutes: created.sleepDurationMinutes,
        sleep_date: created.sleepDate,
        source: created.source,
        created_at: created.createdAt,
      };
    }
  );

  app.fastify.get(
    '/api/health/entries',
    {
      schema: {
        description: 'List health entries for the current user',
        tags: ['health'],
        querystring: {
          type: 'object',
          properties: {
            days: { type: 'integer', default: 7, description: 'Number of days to look back' },
            type: {
              type: 'string',
              enum: ['stress', 'sleep', 'hrv', 'heart_rate', 'all'],
              default: 'all',
              description: 'Filter by metric type',
            },
          },
        },
        response: {
          200: {
            description: 'List of health entries',
            type: 'object',
            properties: {
              entries: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    user_id: { type: 'string' },
                    recorded_at: { type: 'string', format: 'date-time' },
                    stress_score: { type: ['integer', 'null'] },
                    heart_rate: { type: ['integer', 'null'] },
                    hrv: { type: ['integer', 'null'] },
                    sleep_score: { type: ['integer', 'null'] },
                    sleep_duration_minutes: { type: ['integer', 'null'] },
                    sleep_date: { type: ['string', 'null'] },
                    source: { type: 'string' },
                    created_at: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          401: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: HealthEntriesQuery }>, reply: FastifyReply) => {
      const session = await app.requireAuth()(request, reply);
      if (!session) return;

      const days = parseInt(request.query.days || '7', 10);
      const filterType = request.query.type || 'all';

      app.logger.debug({ userId: session.user.id, days, type: filterType }, 'Fetching health entries');

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      let whereConditions: any = and(eq(schema.healthEntries.userId, session.user.id), gte(schema.healthEntries.recordedAt, cutoffDate));

      if (filterType === 'stress') {
        whereConditions = and(whereConditions, isNotNull(schema.healthEntries.stressScore));
      } else if (filterType === 'sleep') {
        whereConditions = and(
          whereConditions,
          or(isNotNull(schema.healthEntries.sleepScore), isNotNull(schema.healthEntries.sleepDurationMinutes))
        );
      } else if (filterType === 'hrv') {
        whereConditions = and(whereConditions, isNotNull(schema.healthEntries.hrv));
      } else if (filterType === 'heart_rate') {
        whereConditions = and(whereConditions, isNotNull(schema.healthEntries.heartRate));
      }

      const entries = await app.db
        .select()
        .from(schema.healthEntries)
        .where(whereConditions)
        .orderBy(desc(schema.healthEntries.recordedAt));

      app.logger.info({ userId: session.user.id, count: entries.length }, 'Health entries fetched');

      return {
        entries: entries.map((e) => ({
          id: e.id,
          user_id: e.userId,
          recorded_at: e.recordedAt,
          stress_score: e.stressScore,
          heart_rate: e.heartRate,
          hrv: e.hrv,
          sleep_score: e.sleepScore,
          sleep_duration_minutes: e.sleepDurationMinutes,
          sleep_date: e.sleepDate,
          source: e.source,
          created_at: e.createdAt,
        })),
      };
    }
  );

  app.fastify.get(
    '/api/health/latest',
    {
      schema: {
        description: 'Get the most recent non-null value for each metric',
        tags: ['health'],
        response: {
          200: {
            description: 'Latest health metrics',
            type: 'object',
            properties: {
              stress_score: { type: ['integer', 'null'] },
              heart_rate: { type: ['integer', 'null'] },
              hrv: { type: ['integer', 'null'] },
              sleep_score: { type: ['integer', 'null'] },
              sleep_duration_minutes: { type: ['integer', 'null'] },
              last_updated: { type: ['string', 'null'], format: 'date-time' },
            },
          },
          401: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await app.requireAuth()(request, reply);
      if (!session) return;

      app.logger.debug({ userId: session.user.id }, 'Fetching latest health metrics');

      const metrics = {
        stress_score: null as number | null,
        heart_rate: null as number | null,
        hrv: null as number | null,
        sleep_score: null as number | null,
        sleep_duration_minutes: null as number | null,
        last_updated: null as string | null,
      };

      const allEntries = await app.db
        .select()
        .from(schema.healthEntries)
        .where(eq(schema.healthEntries.userId, session.user.id))
        .orderBy(desc(schema.healthEntries.recordedAt));

      let lastRecordedAt: Date | null = null;

      for (const entry of allEntries) {
        if (metrics.stress_score === null && entry.stressScore !== null) {
          metrics.stress_score = entry.stressScore;
          if (!lastRecordedAt) lastRecordedAt = entry.recordedAt;
        }
        if (metrics.heart_rate === null && entry.heartRate !== null) {
          metrics.heart_rate = entry.heartRate;
          if (!lastRecordedAt) lastRecordedAt = entry.recordedAt;
        }
        if (metrics.hrv === null && entry.hrv !== null) {
          metrics.hrv = entry.hrv;
          if (!lastRecordedAt) lastRecordedAt = entry.recordedAt;
        }
        if (metrics.sleep_score === null && entry.sleepScore !== null) {
          metrics.sleep_score = entry.sleepScore;
          if (!lastRecordedAt) lastRecordedAt = entry.recordedAt;
        }
        if (metrics.sleep_duration_minutes === null && entry.sleepDurationMinutes !== null) {
          metrics.sleep_duration_minutes = entry.sleepDurationMinutes;
          if (!lastRecordedAt) lastRecordedAt = entry.recordedAt;
        }
      }

      if (lastRecordedAt) {
        metrics.last_updated = lastRecordedAt.toISOString();
      }

      app.logger.info({ userId: session.user.id }, 'Latest health metrics fetched');
      return metrics;
    }
  );
}
