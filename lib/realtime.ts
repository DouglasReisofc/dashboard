import type { Server as IoServer } from "socket.io";
import { EventEmitter } from "events";

import { SESSION_COOKIE, getSessionUserById } from "lib/auth";

const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? "";
const basePrefix = rawBasePath && rawBasePath !== "/"
  ? (rawBasePath.startsWith("/") ? rawBasePath : `/${rawBasePath}`)
  : "";
export const SOCKET_PATH = `${basePrefix}/api/socket/io`;

let ioInstance: IoServer | null = null;

// Simple in-process Event Bus for SSE fallback
let eventBus: EventEmitter | null = null;

export const registerSocketServer = (server: IoServer) => {
  ioInstance = server;
};

export const getSocketServer = () => ioInstance;

export const getEventBus = () => {
  if (!eventBus) {
    eventBus = new EventEmitter();
    // increase listeners to avoid warning if many clients
    eventBus.setMaxListeners(1000);
  }
  return eventBus;
};

const normalizeWhatsappId = (value: string) => value.trim();

export const buildSupportUserRoom = (userId: number) => `user:${userId}`;

export const buildSupportThreadRoom = (userId: number, whatsappId: string) =>
  `${buildSupportUserRoom(userId)}:thread:${normalizeWhatsappId(whatsappId)}`;

export const parseSessionIdFromCookie = (cookieHeader: string | undefined | null) => {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";");
  for (const item of cookies) {
    const [rawName, ...rest] = item.trim().split("=");
    if (rawName === SESSION_COOKIE) {
      return decodeURIComponent(rest.join("="));
    }
  }

  return null;
};

export const authenticateSocket = async (cookieHeader: string | undefined) => {
  const sessionId = parseSessionIdFromCookie(cookieHeader);
  if (!sessionId) {
    return null;
  }

  return getSessionUserById(sessionId);
};

export type SupportThreadUpdatePayload = {
  userId: number;
  thread: {
    whatsappId: string;
    customerName: string | null;
    profileName: string | null;
    lastMessagePreview: string | null;
    lastMessageAt: string | null;
    status: "open" | "closed";
    within24h: boolean;
    minutesLeft24h: number;
  };
};

export type SupportMessageCreatedPayload = {
  userId: number;
  whatsappId: string;
  message: {
    id: number;
    direction: "inbound" | "outbound";
    messageType: string;
    text: string | null;
    timestamp: string;
    media?: {
      mediaId: string;
      mediaType: string;
      mimeType: string | null;
      filename?: string | null;
      caption?: string | null;
    } | null;
  };
};

export type PurchaseCreatedPayload = {
  userId: number;
  purchase: {
    categoryName: string;
    categoryPrice: number;
    customerName: string | null;
    customerWhatsapp: string | null;
    purchasedAt: string;
    productDetails?: string | null;
  };
};

export type UserNotificationCreatedPayload = {
  userId: number;
  notification: {
    id: number;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: string;
    metadata?: Record<string, unknown> | null;
  };
};

export const emitSupportThreadUpdate = (payload: SupportThreadUpdatePayload) => {
  const server = getSocketServer();
  if (!server) {
    // still broadcast through SSE bus
    getEventBus().emit("support:thread-updated", payload);
    return;
  }

  const room = buildSupportUserRoom(payload.userId);
  server.to(room).emit("support:thread-updated", payload.thread);
  // also via SSE bus (for clients connected over SSE)
  getEventBus().emit("support:thread-updated", payload);
};

export const emitSupportMessageEvent = (payload: SupportMessageCreatedPayload) => {
  const server = getSocketServer();
  if (!server) {
    // still broadcast through SSE bus
    getEventBus().emit("support:message-created", payload);
    return;
  }

  const threadRoom = buildSupportThreadRoom(payload.userId, payload.whatsappId);
  server.to(threadRoom).emit("support:message-created", {
    whatsappId: payload.whatsappId,
    message: payload.message,
  });
  // also via SSE bus
  getEventBus().emit("support:message-created", payload);
};

export const emitPurchaseCreated = (payload: PurchaseCreatedPayload) => {
  const server = getSocketServer();
  if (server) {
    const room = buildSupportUserRoom(payload.userId);
    server.to(room).emit("purchase:created", payload.purchase);
  }

  getEventBus().emit("purchase:created", payload);
};

export const emitUserNotificationCreated = (payload: UserNotificationCreatedPayload) => {
  const server = getSocketServer();
  if (server) {
    const room = buildSupportUserRoom(payload.userId);
    server.to(room).emit("notification:created", payload.notification);
  }

  getEventBus().emit("notification:created", payload);
};

export const SSE_PATH = `${basePrefix}/api/support/stream`;
