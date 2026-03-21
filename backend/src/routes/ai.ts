import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface AIRecommendationBody {
  stress_score?: number | null;
  heart_rate?: number | null;
  hrv?: number | null;
  sleep_score?: number | null;
  sleep_duration_minutes?: number | null;
}

type Severity = 'optimal' | 'caution' | 'warning' | 'danger';

function determineSeverity(body: AIRecommendationBody): Severity {
  if (body.stress_score !== null && body.stress_score !== undefined) {
    if (body.stress_score < 40) return 'optimal';
    if (body.stress_score < 70) return 'caution';
    if (body.stress_score < 85) return 'warning';
    return 'danger';
  }

  if (
    (body.sleep_score !== null && body.sleep_score !== undefined && body.sleep_score >= 70) &&
    (body.hrv === null || body.hrv === undefined || body.hrv >= 50)
  ) {
    return 'optimal';
  }

  if (body.sleep_score !== null && body.sleep_score !== undefined && body.sleep_score >= 50) {
    return 'caution';
  }

  if (body.sleep_score !== null && body.sleep_score !== undefined && body.sleep_score < 50) {
    return 'warning';
  }

  if (
    (body.sleep_score === null || body.sleep_score === undefined) &&
    (body.hrv === null || body.hrv === undefined)
  ) {
    return 'caution';
  }

  return 'caution';
}

export function registerAIRoutes(app: App) {
  app.fastify.post(
    '/api/ai/recommendation',
    {
      schema: {
        description: 'Get an AI-powered trading recommendation based on health metrics',
        tags: ['ai'],
        body: {
          type: 'object',
          required: ['stress_score'],
          properties: {
            stress_score: { type: ['integer', 'null'], minimum: 0, maximum: 100 },
            heart_rate: { type: ['integer', 'null'] },
            hrv: { type: ['integer', 'null'] },
            sleep_score: { type: ['integer', 'null'], minimum: 0, maximum: 100 },
            sleep_duration_minutes: { type: ['integer', 'null'] },
          },
        },
        response: {
          200: {
            description: 'AI recommendation generated',
            type: 'object',
            properties: {
              recommendation: { type: 'string' },
              severity: { type: 'string', enum: ['optimal', 'caution', 'warning', 'danger'] },
            },
          },
          401: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request: FastifyRequest<{ Body: AIRecommendationBody }>, reply: FastifyReply) => {
      const session = await app.requireAuth()(request, reply);
      if (!session) return;

      const { stress_score, heart_rate, hrv, sleep_score, sleep_duration_minutes } = request.body;

      app.logger.info(
        { userId: session.user.id, stress_score, heart_rate, sleep_score },
        'Generating AI recommendation'
      );

      const severity = determineSeverity(request.body);

      const prompt = `You are a health advisor for professional traders. Based on these metrics: stress=${
        stress_score ?? 'N/A'
      }/100, heart_rate=${heart_rate ?? 'N/A'}bpm, HRV=${hrv ?? 'N/A'}ms, sleep_score=${
        sleep_score ?? 'N/A'
      }/100, sleep_duration=${sleep_duration_minutes ?? 'N/A'}min — provide a single concise trading recommendation (1-2 sentences max). Focus on whether the trader should be cautious, reduce position size, or is in optimal condition. Be direct and specific.`;

      try {
        const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

        let recommendation: string;

        if (!apiKey) {
          app.logger.warn({}, 'GOOGLE_GENERATIVE_AI_API_KEY not configured, using mock response');

          // Mock recommendation based on severity
          const mockRecommendations: Record<Severity, string> = {
            optimal:
              'Your health metrics are excellent. You are in optimal condition for active trading. Maintain current strategies and capitalize on market opportunities with confidence.',
            caution:
              'Your metrics show moderate stress levels. Exercise caution with position sizes and avoid high-risk trades. Focus on defensive strategies.',
            warning:
              'Your stress levels are elevated. Consider reducing position size and stepping back from the markets. Prioritize recovery and rest.',
            danger:
              'Your health metrics indicate significant stress. Avoid all trading activity today. Take a break and focus on recovery.',
          };
          recommendation = mockRecommendations[severity];
        } else {
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

          const result = await model.generateContent(prompt);
          recommendation = result.response.text();
        }

        app.logger.info(
          { userId: session.user.id, severity, recommendationLength: recommendation.length },
          'AI recommendation generated'
        );

        return {
          recommendation,
          severity,
        };
      } catch (error) {
        app.logger.error(
          { err: error, userId: session.user.id },
          'Failed to generate AI recommendation'
        );
        throw error;
      }
    }
  );
}
