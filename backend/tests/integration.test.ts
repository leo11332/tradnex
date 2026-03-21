import { describe, test, expect } from "bun:test";
import { api, authenticatedApi, signUpTestUser, expectStatus } from "./helpers";

describe("API Integration Tests", () => {
  let authToken: string;

  test("Sign up test user", async () => {
    const { token } = await signUpTestUser();
    authToken = token;
    expect(authToken).toBeDefined();
  });

  // Profile endpoints
  test("GET /api/profile - Get user profile", async () => {
    const res = await authenticatedApi("/api/profile", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.role).toBeDefined();
  });

  test("PUT /api/profile - Update alert thresholds", async () => {
    const res = await authenticatedApi("/api/profile", authToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stress_threshold: 75,
        heart_rate_threshold: 120,
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBeDefined();
  });

  test("POST /api/profile/start-trial - Start trial", async () => {
    const res = await authenticatedApi("/api/profile/start-trial", authToken, {
      method: "POST",
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBeDefined();
  });

  // Health entries endpoints
  test("POST /api/health/entries - Create health entry", async () => {
    const res = await authenticatedApi("/api/health/entries", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stress_score: 65,
        heart_rate: 95,
        hrv: 50,
        sleep_score: 80,
        sleep_duration_minutes: 480,
        sleep_date: "2026-03-21",
        recorded_at: new Date().toISOString(),
        source: "wearable",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    expect(data.id).toBeDefined();
  });

  test("GET /api/health/entries - List health entries", async () => {
    const res = await authenticatedApi("/api/health/entries", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.entries).toBeDefined();
    expect(Array.isArray(data.entries)).toBe(true);
  });

  test("GET /api/health/entries with query parameters", async () => {
    const res = await authenticatedApi("/api/health/entries?days=14&type=stress", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.entries).toBeDefined();
  });

  test("GET /api/health/latest - Get latest metrics", async () => {
    const res = await authenticatedApi("/api/health/latest", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data).toBeDefined();
  });

  // AI recommendation endpoints
  test("POST /api/ai/recommendation - Get recommendation with valid data", async () => {
    const res = await authenticatedApi("/api/ai/recommendation", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stress_score: 65,
        heart_rate: 95,
        hrv: 50,
        sleep_score: 80,
        sleep_duration_minutes: 480,
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.recommendation).toBeDefined();
    expect(data.severity).toBeDefined();
  });

  test("POST /api/ai/recommendation - Missing required stress_score returns 400", async () => {
    const res = await authenticatedApi("/api/ai/recommendation", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        heart_rate: 95,
      }),
    });
    await expectStatus(res, 400);
  });

  // Unauthenticated request tests
  test("GET /api/profile - Unauthenticated request returns 401", async () => {
    const res = await api("/api/profile");
    await expectStatus(res, 401);
  });

  test("POST /api/health/entries - Unauthenticated request returns 401", async () => {
    const res = await api("/api/health/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stress_score: 65,
        recorded_at: new Date().toISOString(),
        source: "wearable",
      }),
    });
    await expectStatus(res, 401);
  });

  test("GET /api/health/latest - Unauthenticated request returns 401", async () => {
    const res = await api("/api/health/latest");
    await expectStatus(res, 401);
  });

  test("POST /api/ai/recommendation - Unauthenticated request returns 401", async () => {
    const res = await api("/api/ai/recommendation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stress_score: 65,
      }),
    });
    await expectStatus(res, 401);
  });
});
