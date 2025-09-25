import { ResultSetHeader, RowDataPacket } from "mysql2";

import { ensureCustomerTable, getDb } from "lib/db";
import { findCustomerByPhoneForUser } from "lib/customers";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const normalizePhone = (value: string) => value.trim();

const ensureSupportTables = async () => {
  const db = getDb();

  await db.query(`
    CREATE TABLE IF NOT EXISTS user_support_threads (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      whatsapp_id VARCHAR(32) NOT NULL,
      customer_name VARCHAR(255) NULL,
      profile_name VARCHAR(255) NULL,
      last_message_preview TEXT NULL,
      last_message_at DATETIME NULL,
      status ENUM('open', 'closed') NOT NULL DEFAULT 'open',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user_whatsapp (user_id, whatsapp_id),
      INDEX idx_user_status (user_id, status, updated_at),
      CONSTRAINT fk_support_threads_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS user_support_messages (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      thread_id INT NOT NULL,
      user_id INT NOT NULL,
      whatsapp_id VARCHAR(32) NOT NULL,
      direction ENUM('inbound', 'outbound') NOT NULL,
      message_type VARCHAR(32) NOT NULL,
      text TEXT NULL,
      payload LONGTEXT NULL,
      message_id VARCHAR(128) NULL,
      timestamp DATETIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_thread_created (thread_id, created_at),
      INDEX idx_user_whatsapp (user_id, whatsapp_id, created_at),
      CONSTRAINT fk_support_messages_thread FOREIGN KEY (thread_id) REFERENCES user_support_threads(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);
};

export type SupportThread = {
  id: number;
  userId: number;
  whatsappId: string;
  customerName: string | null;
  profileName: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: Date | null;
  status: "open" | "closed";
};

type SupportThreadRow = RowDataPacket & {
  id: number;
  user_id: number;
  whatsapp_id: string;
  customer_name: string | null;
  profile_name: string | null;
  last_message_preview: string | null;
  last_message_at: Date | string | null;
  status: string;
};

const mapThreadRow = (row: SupportThreadRow): SupportThread => ({
  id: Number(row.id),
  userId: Number(row.user_id),
  whatsappId: row.whatsapp_id,
  customerName: row.customer_name ?? null,
  profileName: row.profile_name ?? null,
  lastMessagePreview: row.last_message_preview ?? null,
  lastMessageAt: row.last_message_at ? new Date(row.last_message_at) : null,
  status: row.status === "closed" ? "closed" : "open",
});

export const getOrCreateSupportThread = async (
  userId: number,
  whatsappId: string,
  options?: { customerName?: string | null; profileName?: string | null },
): Promise<SupportThread> => {
  await ensureSupportTables();
  const db = getDb();
  const normalizedWhatsappId = normalizePhone(whatsappId);

  const [existing] = await db.query<SupportThreadRow[]>(
    `SELECT * FROM user_support_threads WHERE user_id = ? AND whatsapp_id = ? LIMIT 1`,
    [userId, normalizedWhatsappId],
  );

  if (Array.isArray(existing) && existing.length > 0) {
    return mapThreadRow(existing[0]);
  }

  const [insert] = await db.query<ResultSetHeader>(
    `
      INSERT INTO user_support_threads (user_id, whatsapp_id, customer_name, profile_name)
      VALUES (?, ?, ?, ?)
    `,
    [userId, normalizedWhatsappId, options?.customerName ?? null, options?.profileName ?? null],
  );

  const threadId = Number(insert.insertId);
  const [rows] = await db.query<SupportThreadRow[]>(
    `SELECT * FROM user_support_threads WHERE id = ? LIMIT 1`,
    [threadId],
  );

  return mapThreadRow(rows[0]);
};

export type SupportMessage = {
  id: number;
  threadId: number;
  userId: number;
  whatsappId: string;
  direction: "inbound" | "outbound";
  messageType: string;
  text: string | null;
  payload: unknown;
  messageId: string | null;
  timestamp: string;
};

export type SerializedSupportMessage = {
  id: number;
  direction: "inbound" | "outbound";
  messageType: string;
  text: string | null;
  timestamp: string;
  media?: {
    mediaId?: string | null;
    mediaUrl?: string | null;
    mediaType: string;
    mimeType: string | null;
    filename?: string | null;
    caption?: string | null;
  } | null;
};

export type SerializedSupportThread = {
  whatsappId: string;
  customerName: string | null;
  profileName: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  status: "open" | "closed";
};

export type SupportThreadSummary = SerializedSupportThread & {
  within24h: boolean;
  minutesLeft24h: number;
};

type SupportMessageRow = RowDataPacket & {
  id: number;
  thread_id: number;
  user_id: number;
  whatsapp_id: string;
  direction: string;
  message_type: string;
  text: string | null;
  payload: string | null;
  message_id: string | null;
  timestamp: Date | string;
};

const mapMessageRow = (row: SupportMessageRow): SupportMessage => ({
  id: Number(row.id),
  threadId: Number(row.thread_id),
  userId: Number(row.user_id),
  whatsappId: row.whatsapp_id,
  direction: row.direction === "outbound" ? "outbound" : "inbound",
  messageType: row.message_type,
  text: row.text ?? null,
  payload: (() => {
    if (!row.payload) return null;
    try {
      return JSON.parse(row.payload);
    } catch {
      return row.payload;
    }
  })(),
  messageId: row.message_id ?? null,
  timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : new Date(row.timestamp).toISOString(),
});

const extractMediaFromPayload = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const mediaId = typeof record.mediaId === "string" ? record.mediaId : null;
  const mediaUrl = typeof record.mediaUrl === "string" ? record.mediaUrl : null;
  const mediaType = typeof record.mediaType === "string" ? record.mediaType : null;

  if (!mediaType) {
    return null;
  }

  if (!mediaId && !mediaUrl) {
    return null;
  }

  return {
    mediaId,
    mediaUrl,
    mediaType,
    mimeType: typeof record.mimeType === "string" ? record.mimeType : null,
    filename: typeof record.filename === "string" ? record.filename : null,
    caption: typeof record.caption === "string" ? record.caption : null,
  };
};

export const serializeSupportMessage = (message: SupportMessage): SerializedSupportMessage => ({
  id: message.id,
  direction: message.direction,
  messageType: message.messageType,
  text: message.text,
  timestamp: message.timestamp,
  media: extractMediaFromPayload(message.payload),
});

export const serializeSupportThread = (thread: SupportThread): SerializedSupportThread => ({
  whatsappId: thread.whatsappId,
  customerName: thread.customerName,
  profileName: thread.profileName,
  lastMessagePreview: thread.lastMessagePreview,
  lastMessageAt: thread.lastMessageAt ? thread.lastMessageAt.toISOString() : null,
  status: thread.status,
});

export const recordSupportMessage = async (options: {
  userId: number;
  whatsappId: string;
  direction: "inbound" | "outbound";
  messageType: string;
  text?: string | null;
  payload?: unknown;
  messageId?: string | null;
  timestamp?: Date;
  customerName?: string | null;
  profileName?: string | null;
}): Promise<{ message: SupportMessage; thread: SupportThread }> => {
  const { userId, whatsappId, direction, messageType } = options;
  const timestamp = options.timestamp ? new Date(options.timestamp) : new Date();
  const thread = await getOrCreateSupportThread(userId, whatsappId);
  const db = getDb();

  const [insert] = await db.query<ResultSetHeader>(
    `
      INSERT INTO user_support_messages
        (thread_id, user_id, whatsapp_id, direction, message_type, text, payload, message_id, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      thread.id,
      userId,
      normalizePhone(whatsappId),
      direction,
      messageType,
      options.text ?? null,
      options.payload ? JSON.stringify(options.payload) : null,
      options.messageId ?? null,
      timestamp,
    ],
  );

  const insertedId = Number(insert.insertId);
  const [rows] = await db.query<SupportThreadRow[]>(
    `SELECT * FROM user_support_messages WHERE id = ? LIMIT 1`,
    [insertedId],
  );

  const message = mapMessageRow(rows[0]);

  const previewSource = options.text ?? (() => {
    if (!options.payload || typeof options.payload !== "object") {
      return null;
    }
    const payloadRecord = options.payload as Record<string, unknown>;
    const caption = payloadRecord.caption;
    if (typeof caption === "string" && caption.trim()) {
      return caption;
    }
    const mimeType = payloadRecord.mimeType;
    if (typeof mimeType === "string" && mimeType.trim()) {
      return mimeType;
    }
    try {
      return JSON.stringify(payloadRecord).slice(0, 120);
    } catch {
      return null;
    }
  })();
  const preview = previewSource ? previewSource.slice(0, 280) : null;

  const nextCustomerName =
    typeof options.customerName === "string" && options.customerName.trim().length > 0
      ? options.customerName
      : thread.customerName;
  const nextProfileName =
    typeof options.profileName === "string" && options.profileName.trim().length > 0
      ? options.profileName
      : thread.profileName;

  const updatedThread: SupportThread = {
    ...thread,
    customerName: nextCustomerName ?? null,
    profileName: nextProfileName ?? null,
    lastMessagePreview: preview,
    lastMessageAt: timestamp,
    status: "open",
  };

  await db.query(
    `
      UPDATE user_support_threads
      SET
        last_message_preview = ?,
        last_message_at = ?,
      status = 'open',
      customer_name = COALESCE(NULLIF(?, ''), customer_name),
      profile_name = COALESCE(NULLIF(?, ''), profile_name)
      WHERE id = ?
    `,
    [
      preview,
      timestamp,
      options.customerName ?? "",
      options.profileName ?? "",
      thread.id,
    ],
  );

  return { message, thread: updatedThread };
};

export const listSupportThreads = async (userId: number) => {
  await ensureSupportTables();
  const db = getDb();
  const [rows] = await db.query<SupportThreadRow[]>(
    `
      SELECT * FROM user_support_threads
      WHERE user_id = ?
      ORDER BY status = 'open' DESC, COALESCE(last_message_at, created_at) DESC
    `,
    [userId],
  );

  return rows.map(mapThreadRow);
};

export const getSupportThreadByWhatsapp = async (
  userId: number,
  whatsappId: string,
): Promise<SupportThread | null> => {
  await ensureSupportTables();
  const db = getDb();
  const [rows] = await db.query<SupportMessageRow[]>(
    `SELECT * FROM user_support_threads WHERE user_id = ? AND whatsapp_id = ? LIMIT 1`,
    [userId, normalizePhone(whatsappId)],
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return mapThreadRow(rows[0]);
};

export const getSupportMessages = async (threadId: number) => {
  const db = getDb();
  const [rows] = await db.query<SupportMessageRow[]>(
    `SELECT * FROM user_support_messages WHERE thread_id = ? ORDER BY created_at ASC`,
    [threadId],
  );

  return rows.map(mapMessageRow);
};

export const closeSupportThread = async (userId: number, whatsappId: string) => {
  await ensureSupportTables();
  const db = getDb();
  await db.query(
    `UPDATE user_support_threads SET status = 'closed' WHERE user_id = ? AND whatsapp_id = ?`,
    [userId, normalizePhone(whatsappId)],
  );
};

export const reopenSupportThread = async (userId: number, whatsappId: string) => {
  await ensureSupportTables();
  const db = getDb();
  await db.query(
    `UPDATE user_support_threads SET status = 'open' WHERE user_id = ? AND whatsapp_id = ?`,
    [userId, normalizePhone(whatsappId)],
  );
};

export const getMinutesLeftIn24hWindow = async (userId: number, whatsappId: string) => {
  await ensureCustomerTable();
  const customer = await findCustomerByPhoneForUser(userId, whatsappId);
  if (!customer?.lastInteraction) {
    return { within24h: false, minutesLeft: 0 } as const;
  }
  const last = new Date(customer.lastInteraction).getTime();
  const diff = Date.now() - last;
  const minutesLeft = Math.max(0, Math.floor((DAY_IN_MS - diff) / 60000));
  return { within24h: minutesLeft > 0, minutesLeft } as const;
};

export const buildSupportThreadSummary = async (
  userId: number,
  thread: SupportThread,
): Promise<SupportThreadSummary> => {
  const { within24h, minutesLeft } = await getMinutesLeftIn24hWindow(userId, thread.whatsappId);

  return {
    ...serializeSupportThread(thread),
    within24h,
    minutesLeft24h: minutesLeft,
  };
};
