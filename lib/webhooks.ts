import { randomBytes, randomUUID } from "crypto";

import {
  ensureWebhookEventTable,
  ensureWebhookTable,
  getDb,
  UserWebhookRow,
  WebhookEventRow,
} from "lib/db";
import type { UserWebhookDetails, WebhookEventSummary } from "types/webhooks";

const getBaseUrl = () => {
  const rawUrl = process.env.APP_URL?.trim();
  if (!rawUrl) {
    return "http://localhost:4478";
  }

  return rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
};

const mapWebhookRow = (row: UserWebhookRow): UserWebhookDetails => ({
  id: row.id,
  endpoint: `${getBaseUrl()}/api/webhooks/meta/${row.id}`,
  verifyToken: row.verify_token,
  apiKey: row.api_key,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
  lastEventAt: row.last_event_at ? row.last_event_at.toISOString() : null,
});

const mapEventRow = (row: WebhookEventRow): WebhookEventSummary => ({
  id: row.id,
  webhookId: row.webhook_id,
  eventType: row.event_type,
  receivedAt: row.received_at.toISOString(),
  payload: row.payload,
});

export const ensureUserWebhook = async (userId: number) => {
  await ensureWebhookTable();
  const db = getDb();

  const [rows] = await db.query<UserWebhookRow[]>(
    "SELECT * FROM user_webhooks WHERE user_id = ? LIMIT 1",
    [userId],
  );

  if (rows.length) {
    return mapWebhookRow(rows[0]);
  }

  const webhookId = randomUUID();
  const verifyToken = randomBytes(24).toString("hex");
  const apiKey = randomBytes(32).toString("hex");

  await db.query(
    `
      INSERT INTO user_webhooks (id, user_id, verify_token, api_key)
      VALUES (?, ?, ?, ?)
    `,
    [webhookId, userId, verifyToken, apiKey],
  );

  const [createdRows] = await db.query<UserWebhookRow[]>(
    "SELECT * FROM user_webhooks WHERE id = ? LIMIT 1",
    [webhookId],
  );

  return createdRows.length ? mapWebhookRow(createdRows[0]) : null;
};

export const getWebhookForUser = async (
  userId: number,
): Promise<UserWebhookDetails | null> => {
  const webhook = await ensureUserWebhook(userId);
  return webhook;
};

export const getWebhookByPublicId = async (
  webhookId: string,
): Promise<UserWebhookRow | null> => {
  await ensureWebhookTable();
  const db = getDb();

  const [rows] = await db.query<UserWebhookRow[]>(
    "SELECT * FROM user_webhooks WHERE id = ? LIMIT 1",
    [webhookId],
  );

  if (!rows.length) {
    return null;
  }

  return rows[0];
};

export const recordWebhookEvent = async (
  webhookId: string,
  userId: number,
  eventType: string | null,
  payload: unknown,
) => {
  await ensureWebhookEventTable();
  const db = getDb();

  const serializedPayload = JSON.stringify(payload ?? {});

  await db.query(
    `
      INSERT INTO user_webhook_events (webhook_id, user_id, event_type, payload)
      VALUES (?, ?, ?, ?)
    `,
    [webhookId, userId, eventType, serializedPayload],
  );

  await db.query(
    `
      UPDATE user_webhooks
      SET last_event_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [webhookId],
  );
};

export const getRecentWebhookEvents = async (
  userId: number,
  limit = 20,
): Promise<WebhookEventSummary[]> => {
  await ensureWebhookEventTable();
  const db = getDb();

  const [rows] = await db.query<WebhookEventRow[]>(
    `
      SELECT *
      FROM user_webhook_events
      WHERE user_id = ?
      ORDER BY received_at DESC
      LIMIT ?
    `,
    [userId, limit],
  );

  return rows.map(mapEventRow);
};

export const rotateWebhookSecrets = async (
  userId: number,
): Promise<UserWebhookDetails | null> => {
  await ensureWebhookTable();
  const db = getDb();

  const newVerify = randomBytes(24).toString("hex");
  const newApiKey = randomBytes(32).toString("hex");

  const [result] = await db.query(
    `
      UPDATE user_webhooks
      SET verify_token = ?, api_key = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `,
    [newVerify, newApiKey, userId],
  );

  if (Array.isArray(result) || (result as { affectedRows?: number }).affectedRows === 0) {
    return ensureUserWebhook(userId);
  }

  return ensureUserWebhook(userId);
};
