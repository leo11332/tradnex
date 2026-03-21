import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

interface UpdateProfileBody {
  stress_threshold?: number;
  heart_rate_threshold?: number;
}

async function getOrCreateProfile(app: App, userId: string, userEmail: string) {
  app.logger.debug({ userId }, 'Looking up profile');

  let profile = await app.db.query.userProfiles.findFirst({
    where: eq(schema.userProfiles.userId, userId),
  });

  if (!profile) {
    app.logger.info({ userId, userEmail }, 'Creating new profile');

    const isAdmin = userEmail === process.env.ADMIN_EMAIL;
    const newProfile = {
      userId,
      role: isAdmin ? 'admin' : 'user',
      stressThreshold: 70,
      heartRateThreshold: 100,
      subscriptionStatus: isAdmin ? 'admin' : 'trial',
      trialStartedAt: null,
    };

    const [created] = await app.db.insert(schema.userProfiles).values(newProfile).returning();
    profile = created;
    app.logger.info({ userId, role: profile.role }, 'Profile created');
  }

  return profile;
}

async function computeTrialDaysRemaining(app: App, profile: any): Promise<number | null> {
  if (profile.subscriptionStatus === 'admin' || profile.subscriptionStatus === 'active') {
    return null;
  }

  if (!profile.trialStartedAt) {
    return 5;
  }

  const now = Date.now();
  const trialStart = new Date(profile.trialStartedAt).getTime();
  const daysElapsed = Math.floor((now - trialStart) / (24 * 60 * 60 * 1000));
  const daysRemaining = Math.max(0, 5 - daysElapsed);

  if (profile.subscriptionStatus === 'trial' && daysElapsed > 5) {
    await app.db
      .update(schema.userProfiles)
      .set({ subscriptionStatus: 'expired', updatedAt: new Date() })
      .where(eq(schema.userProfiles.userId, profile.userId));
    return 0;
  }

  return daysRemaining;
}

export function registerProfileRoutes(app: App) {
  app.fastify.get(
    '/api/profile',
    {
      schema: {
        description: "Get the current user's profile",
        tags: ['profile'],
        response: {
          200: {
            description: 'Profile retrieved successfully',
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              user_id: { type: 'string' },
              role: { type: 'string', enum: ['user', 'admin'] },
              stress_threshold: { type: 'integer' },
              heart_rate_threshold: { type: 'integer' },
              subscription_status: { type: 'string', enum: ['trial', 'active', 'expired', 'admin'] },
              trial_started_at: { type: ['string', 'null'], format: 'date-time' },
              trial_days_remaining: { type: ['integer', 'null'] },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
          401: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await app.requireAuth()(request, reply);
      if (!session) return;

      app.logger.info({ userId: session.user.id }, 'Fetching profile');

      const profile = await getOrCreateProfile(app, session.user.id, session.user.email!);
      const trialDaysRemaining = await computeTrialDaysRemaining(app, profile);

      const response = {
        id: profile.id,
        user_id: profile.userId,
        role: profile.role,
        stress_threshold: profile.stressThreshold,
        heart_rate_threshold: profile.heartRateThreshold,
        subscription_status: profile.subscriptionStatus,
        trial_started_at: profile.trialStartedAt,
        trial_days_remaining: trialDaysRemaining,
        created_at: profile.createdAt,
        updated_at: profile.updatedAt,
      };

      app.logger.info({ userId: session.user.id, role: profile.role }, 'Profile fetched successfully');
      return response;
    }
  );

  app.fastify.put(
    '/api/profile',
    {
      schema: {
        description: 'Update alert thresholds',
        tags: ['profile'],
        body: {
          type: 'object',
          properties: {
            stress_threshold: { type: 'integer', minimum: 0, maximum: 100 },
            heart_rate_threshold: { type: 'integer', minimum: 40, maximum: 220 },
          },
        },
        response: {
          200: {
            description: 'Profile updated successfully',
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              user_id: { type: 'string' },
              role: { type: 'string', enum: ['user', 'admin'] },
              stress_threshold: { type: 'integer' },
              heart_rate_threshold: { type: 'integer' },
              subscription_status: { type: 'string', enum: ['trial', 'active', 'expired', 'admin'] },
              trial_started_at: { type: ['string', 'null'], format: 'date-time' },
              trial_days_remaining: { type: ['integer', 'null'] },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
          401: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request: FastifyRequest<{ Body: UpdateProfileBody }>, reply: FastifyReply) => {
      const session = await app.requireAuth()(request, reply);
      if (!session) return;

      const { stress_threshold, heart_rate_threshold } = request.body;
      app.logger.info({ userId: session.user.id, stress_threshold, heart_rate_threshold }, 'Updating profile');

      const profile = await getOrCreateProfile(app, session.user.id, session.user.email!);

      const updateData: any = { updatedAt: new Date() };
      if (stress_threshold !== undefined) {
        updateData.stressThreshold = stress_threshold;
      }
      if (heart_rate_threshold !== undefined) {
        updateData.heartRateThreshold = heart_rate_threshold;
      }

      const [updated] = await app.db
        .update(schema.userProfiles)
        .set(updateData)
        .where(eq(schema.userProfiles.userId, session.user.id))
        .returning();

      const trialDaysRemaining = await computeTrialDaysRemaining(app, updated);

      const response = {
        id: updated.id,
        user_id: updated.userId,
        role: updated.role,
        stress_threshold: updated.stressThreshold,
        heart_rate_threshold: updated.heartRateThreshold,
        subscription_status: updated.subscriptionStatus,
        trial_started_at: updated.trialStartedAt,
        trial_days_remaining: trialDaysRemaining,
        created_at: updated.createdAt,
        updated_at: updated.updatedAt,
      };

      app.logger.info({ userId: session.user.id }, 'Profile updated successfully');
      return response;
    }
  );

  app.fastify.post(
    '/api/profile/start-trial',
    {
      schema: {
        description: 'Start the 5-day free trial',
        tags: ['profile'],
        response: {
          200: {
            description: 'Trial started or already active',
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              user_id: { type: 'string' },
              role: { type: 'string', enum: ['user', 'admin'] },
              stress_threshold: { type: 'integer' },
              heart_rate_threshold: { type: 'integer' },
              subscription_status: { type: 'string', enum: ['trial', 'active', 'expired', 'admin'] },
              trial_started_at: { type: ['string', 'null'], format: 'date-time' },
              trial_days_remaining: { type: ['integer', 'null'] },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
          401: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await app.requireAuth()(request, reply);
      if (!session) return;

      app.logger.info({ userId: session.user.id }, 'Starting trial');

      let profile = await getOrCreateProfile(app, session.user.id, session.user.email!);

      if (!profile.trialStartedAt) {
        const [updated] = await app.db
          .update(schema.userProfiles)
          .set({
            trialStartedAt: new Date(),
            subscriptionStatus: 'trial',
            updatedAt: new Date(),
          })
          .where(eq(schema.userProfiles.userId, session.user.id))
          .returning();
        profile = updated;
        app.logger.info({ userId: session.user.id }, 'Trial started');
      } else {
        app.logger.debug({ userId: session.user.id }, 'Trial already started');
      }

      const trialDaysRemaining = await computeTrialDaysRemaining(app, profile);

      const response = {
        id: profile.id,
        user_id: profile.userId,
        role: profile.role,
        stress_threshold: profile.stressThreshold,
        heart_rate_threshold: profile.heartRateThreshold,
        subscription_status: profile.subscriptionStatus,
        trial_started_at: profile.trialStartedAt,
        trial_days_remaining: trialDaysRemaining,
        created_at: profile.createdAt,
        updated_at: profile.updatedAt,
      };

      return response;
    }
  );
}
