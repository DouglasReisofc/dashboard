import { ResultSetHeader } from "mysql2";

import type {
  MercadoPagoCheckoutConfig,
  MercadoPagoCheckoutPaymentMethod,
  MercadoPagoCheckoutPaymentType,
  MercadoPagoPixConfig,
  PaymentConfirmationMessageConfig,
  PaymentMethodSummary,
} from "types/payments";

import {
  AdminPaymentMethodRow,
  ensureAdminPaymentMethodTable,
  getDb,
} from "./db";
import { getMercadoPagoNotificationUrl } from "./payments";

const DEFAULT_MERCADO_PAGO_PIX_DISPLAY_NAME = "Pagamento Pix";
const DEFAULT_MERCADO_PAGO_CHECKOUT_DISPLAY_NAME = "Pagamento online";
const DEFAULT_EXPIRATION_MINUTES = 30;
const DEFAULT_AMOUNT_OPTIONS = [25, 50, 100];
const DEFAULT_CONFIRMATION_MESSAGE =
  "Pagamento confirmado! Seu saldo foi atualizado automaticamente. Use o botão abaixo para continuar comprando.";
const DEFAULT_CONFIRMATION_BUTTON = "Ir para o menu";
const CHECKOUT_PAYMENT_TYPES: readonly MercadoPagoCheckoutPaymentType[] = [
  "credit_card",
  "debit_card",
  "ticket",
  "bank_transfer",
  "atm",
  "account_money",
];
const CHECKOUT_PAYMENT_METHODS: readonly MercadoPagoCheckoutPaymentMethod[] = ["pix"];

const getAppBaseUrl = () => {
  const raw = process.env.APP_URL?.trim();
  if (!raw) {
    return "http://localhost:4478";
  }

  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
};

const sanitizeText = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

const sanitizeOptionalText = (value: unknown): string | null => {
  const text = sanitizeText(value);
  return text.length > 0 ? text : null;
};

const sanitizeOptionalUrl = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    return null;
  }

  return trimmed;
};

const sanitizeOptionalMediaPath = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().replace(/^\/+/, "").replace(/\\/g, "/");
  if (!trimmed) {
    return null;
  }

  if (!trimmed.startsWith("uploads/")) {
    return null;
  }

  return trimmed;
};

const resolveMediaUrl = (relativePath: string | null): string | null => {
  if (!relativePath) {
    return null;
  }

  const normalized = relativePath.replace(/^\/+/, "");
  return `${getAppBaseUrl()}/${normalized}`;
};

const sanitizeAmountOptions = (values: unknown): number[] => {
  if (!Array.isArray(values)) {
    return [];
  }

  const centsSet = new Set<number>();

  for (const entry of values) {
    let numeric: number | null = null;

    if (typeof entry === "number" && Number.isFinite(entry)) {
      numeric = entry;
    } else if (typeof entry === "string" && entry.trim()) {
      const normalized = entry.trim().replace(/[^0-9,.-]/g, "");
      if (!normalized) {
        continue;
      }

      const usesComma = normalized.includes(",");
      const sanitized = usesComma
        ? normalized.replace(/\./g, "").replace(/,/g, ".")
        : normalized;
      const parsedNumber = Number.parseFloat(sanitized);
      if (Number.isFinite(parsedNumber)) {
        numeric = parsedNumber;
      }
    }

    if (numeric === null) {
      continue;
    }

    const cents = Math.round(numeric * 100);
    if (!Number.isFinite(cents) || cents < 1) {
      continue;
    }

    centsSet.add(cents);
  }

  return Array.from(centsSet)
    .sort((a, b) => a - b)
    .slice(0, 20)
    .map((cents) => cents / 100);
};

const sanitizeCheckoutPaymentTypes = (
  values: unknown,
): MercadoPagoCheckoutPaymentType[] => {
  if (!Array.isArray(values)) {
    return [];
  }

  const allowed = new Set<MercadoPagoCheckoutPaymentType>();

  for (const entry of values) {
    if (typeof entry !== "string") {
      continue;
    }

    const normalized = entry.trim().toLowerCase();
    const match = CHECKOUT_PAYMENT_TYPES.find((type) => type === normalized);
    if (match) {
      allowed.add(match);
    }
  }

  return Array.from(allowed);
};

const sanitizeCheckoutPaymentMethods = (
  values: unknown,
): MercadoPagoCheckoutPaymentMethod[] => {
  if (!Array.isArray(values)) {
    return [];
  }

  const allowed = new Set<MercadoPagoCheckoutPaymentMethod>();

  for (const entry of values) {
    if (typeof entry !== "string") {
      continue;
    }

    const normalized = entry.trim().toLowerCase();
    const match = CHECKOUT_PAYMENT_METHODS.find((method) => method === normalized);
    if (match) {
      allowed.add(match);
    }
  }

  return Array.from(allowed);
};

const mapPixPaymentMethodRow = (row: AdminPaymentMethodRow | null): MercadoPagoPixConfig => {
  const defaultConfig: MercadoPagoPixConfig = {
    isActive: false,
    displayName: DEFAULT_MERCADO_PAGO_PIX_DISPLAY_NAME,
    accessToken: "",
    publicKey: null,
    pixKey: null,
    notificationUrl: null,
    pixExpirationMinutes: DEFAULT_EXPIRATION_MINUTES,
    amountOptions: Array.from(DEFAULT_AMOUNT_OPTIONS),
    instructions: null,
    isConfigured: false,
    updatedAt: null,
  };

  if (!row) {
    return defaultConfig;
  }

  let credentials: Record<string, unknown> = {};
  if (row.credentials) {
    try {
      const parsed = JSON.parse(row.credentials) as unknown;
      if (parsed && typeof parsed === "object") {
        credentials = parsed as Record<string, unknown>;
      }
    } catch (error) {
      console.warn("Failed to parse admin payment credentials", error);
    }
  }

  let settings: Record<string, unknown> = {};
  if (row.settings) {
    try {
      const parsed = JSON.parse(row.settings) as unknown;
      if (parsed && typeof parsed === "object") {
        settings = parsed as Record<string, unknown>;
      }
    } catch (error) {
      console.warn("Failed to parse admin payment settings", error);
    }
  }

  const accessToken = sanitizeText(credentials.accessToken);
  const publicKey = sanitizeOptionalText(credentials.publicKey);
  const pixKey = sanitizeOptionalText(credentials.pixKey);

  const notificationUrl =
    sanitizeOptionalText(settings.notificationUrl) ?? getMercadoPagoNotificationUrl();
  const pixExpirationMinutesRaw = typeof settings.pixExpirationMinutes === "number"
    ? settings.pixExpirationMinutes
    : typeof settings.pixExpirationMinutes === "string"
      ? Number.parseInt(settings.pixExpirationMinutes, 10)
      : undefined;
  const pixExpirationMinutes = Number.isFinite(pixExpirationMinutesRaw)
    ? Math.min(Math.max(Number(pixExpirationMinutesRaw), 5), 1440)
    : DEFAULT_EXPIRATION_MINUTES;

  const amountOptionsRaw = Array.isArray(settings.amountOptions)
    ? settings.amountOptions
    : DEFAULT_AMOUNT_OPTIONS;
  const amountOptions = sanitizeAmountOptions(amountOptionsRaw);

  const instructions = sanitizeOptionalText(settings.instructions);

  const updatedAt = row.updated_at instanceof Date
    ? row.updated_at.toISOString()
    : new Date(row.updated_at).toISOString();

  return {
    isActive: row.is_active === 1 && accessToken.length > 0,
    displayName: row.display_name?.trim() || DEFAULT_MERCADO_PAGO_PIX_DISPLAY_NAME,
    accessToken,
    publicKey,
    pixKey,
    notificationUrl,
    pixExpirationMinutes,
    amountOptions: amountOptions.length > 0 ? amountOptions : Array.from(DEFAULT_AMOUNT_OPTIONS),
    instructions,
    isConfigured: accessToken.length > 0,
    updatedAt,
  } satisfies MercadoPagoPixConfig;
};

const mapCheckoutPaymentMethodRow = (
  row: AdminPaymentMethodRow | null,
): MercadoPagoCheckoutConfig => {
  const defaultConfig: MercadoPagoCheckoutConfig = {
    isActive: false,
    displayName: DEFAULT_MERCADO_PAGO_CHECKOUT_DISPLAY_NAME,
    accessToken: "",
    publicKey: null,
    notificationUrl: null,
    amountOptions: Array.from(DEFAULT_AMOUNT_OPTIONS),
    allowedPaymentTypes: ["credit_card", "debit_card", "ticket", "bank_transfer"],
    allowedPaymentMethods: ["pix"],
    isConfigured: false,
    updatedAt: null,
  };

  if (!row) {
    return defaultConfig;
  }

  let credentials: Record<string, unknown> = {};
  if (row.credentials) {
    try {
      const parsed = JSON.parse(row.credentials) as unknown;
      if (parsed && typeof parsed === "object") {
        credentials = parsed as Record<string, unknown>;
      }
    } catch (error) {
      console.warn("Failed to parse admin checkout credentials", error);
    }
  }

  let settings: Record<string, unknown> = {};
  if (row.settings) {
    try {
      const parsed = JSON.parse(row.settings) as unknown;
      if (parsed && typeof parsed === "object") {
        settings = parsed as Record<string, unknown>;
      }
    } catch (error) {
      console.warn("Failed to parse admin checkout settings", error);
    }
  }

  const accessToken = sanitizeText(credentials.accessToken);
  const publicKey = sanitizeOptionalText(credentials.publicKey);

  const notificationUrl =
    sanitizeOptionalText(settings.notificationUrl) ?? getMercadoPagoNotificationUrl();

  const amountOptionsRaw = Array.isArray(settings.amountOptions)
    ? settings.amountOptions
    : DEFAULT_AMOUNT_OPTIONS;
  const amountOptions = sanitizeAmountOptions(amountOptionsRaw);

  const allowedPaymentTypes = sanitizeCheckoutPaymentTypes(settings.allowedPaymentTypes);
  const allowedPaymentMethods = sanitizeCheckoutPaymentMethods(settings.allowedPaymentMethods);

  const updatedAt = row.updated_at instanceof Date
    ? row.updated_at.toISOString()
    : new Date(row.updated_at).toISOString();

  return {
    isActive: row.is_active === 1 && accessToken.length > 0,
    displayName: row.display_name?.trim() || DEFAULT_MERCADO_PAGO_CHECKOUT_DISPLAY_NAME,
    accessToken,
    publicKey,
    notificationUrl,
    amountOptions: amountOptions.length > 0 ? amountOptions : Array.from(DEFAULT_AMOUNT_OPTIONS),
    allowedPaymentTypes: allowedPaymentTypes.length > 0
      ? allowedPaymentTypes
      : ["credit_card", "debit_card", "ticket", "bank_transfer"],
    allowedPaymentMethods: allowedPaymentMethods.length > 0 ? allowedPaymentMethods : ["pix"],
    isConfigured: accessToken.length > 0,
    updatedAt,
  } satisfies MercadoPagoCheckoutConfig;
};

const mapPaymentConfirmationRow = (
  row: AdminPaymentMethodRow | null,
): PaymentConfirmationMessageConfig => {
  const defaultConfig: PaymentConfirmationMessageConfig = {
    messageText: DEFAULT_CONFIRMATION_MESSAGE,
    buttonLabel: DEFAULT_CONFIRMATION_BUTTON,
    mediaPath: null,
    mediaUrl: null,
    updatedAt: null,
  };

  if (!row) {
    return defaultConfig;
  }

  let settings: Record<string, unknown> = {};
  if (row.settings) {
    try {
      const parsed = JSON.parse(row.settings) as unknown;
      if (parsed && typeof parsed === "object") {
        settings = parsed as Record<string, unknown>;
      }
    } catch (error) {
      console.warn("Failed to parse admin confirmation settings", error);
    }
  }

  const messageText = sanitizeText(settings.messageText);
  const buttonLabel = sanitizeText(settings.buttonLabel);
  const mediaPath = sanitizeOptionalMediaPath(settings.mediaPath);
  const mediaUrl = mediaPath ? resolveMediaUrl(mediaPath) : sanitizeOptionalUrl(settings.mediaUrl);

  const updatedAt = row.updated_at instanceof Date
    ? row.updated_at.toISOString()
    : new Date(row.updated_at).toISOString();

  return {
    messageText: messageText || DEFAULT_CONFIRMATION_MESSAGE,
    buttonLabel: buttonLabel || DEFAULT_CONFIRMATION_BUTTON,
    mediaPath: mediaPath ?? null,
    mediaUrl: mediaUrl ?? null,
    updatedAt,
  } satisfies PaymentConfirmationMessageConfig;
};

export const getAdminMercadoPagoPixConfig = async (): Promise<MercadoPagoPixConfig> => {
  await ensureAdminPaymentMethodTable();
  const db = getDb();
  const [rows] = await db.query<AdminPaymentMethodRow[]>(
    `SELECT * FROM admin_payment_methods WHERE provider = 'mercadopago_pix' LIMIT 1`,
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return mapPixPaymentMethodRow(null);
  }

  return mapPixPaymentMethodRow(rows[0]);
};

export const getAdminMercadoPagoCheckoutConfig = async (): Promise<MercadoPagoCheckoutConfig> => {
  await ensureAdminPaymentMethodTable();
  const db = getDb();
  const [rows] = await db.query<AdminPaymentMethodRow[]>(
    `SELECT * FROM admin_payment_methods WHERE provider = 'mercadopago_checkout' LIMIT 1`,
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return mapCheckoutPaymentMethodRow(null);
  }

  return mapCheckoutPaymentMethodRow(rows[0]);
};

export const getAdminPaymentConfirmationConfig = async (): Promise<PaymentConfirmationMessageConfig> => {
  await ensureAdminPaymentMethodTable();
  const db = getDb();
  const [rows] = await db.query<AdminPaymentMethodRow[]>(
    `SELECT * FROM admin_payment_methods WHERE provider = 'payment_confirmation' LIMIT 1`,
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return mapPaymentConfirmationRow(null);
  }

  return mapPaymentConfirmationRow(rows[0]);
};

export const getAdminPaymentMethodSummaries = async (): Promise<PaymentMethodSummary[]> => {
  const [pixConfig, checkoutConfig] = await Promise.all([
    getAdminMercadoPagoPixConfig(),
    getAdminMercadoPagoCheckoutConfig(),
  ]);

  return [
    {
      provider: "mercadopago_pix",
      displayName: pixConfig.displayName,
      isActive: pixConfig.isActive,
      isConfigured: pixConfig.isConfigured,
    },
    {
      provider: "mercadopago_checkout",
      displayName: checkoutConfig.displayName,
      isActive: checkoutConfig.isActive,
      isConfigured: checkoutConfig.isConfigured,
    },
  ];
};

export const upsertAdminMercadoPagoPixConfig = async (payload: {
  isActive: boolean;
  displayName?: string | null;
  accessToken: string;
  publicKey?: string | null;
  pixKey?: string | null;
  notificationUrl?: string | null;
  pixExpirationMinutes?: number;
  amountOptions?: number[];
  instructions?: string | null;
}): Promise<MercadoPagoPixConfig> => {
  await ensureAdminPaymentMethodTable();
  const db = getDb();

  const sanitizedAccessToken = sanitizeText(payload.accessToken);
  const sanitizedDisplayName =
    payload.displayName?.trim() || DEFAULT_MERCADO_PAGO_PIX_DISPLAY_NAME;
  const sanitizedPublicKey = sanitizeOptionalText(payload.publicKey);
  const sanitizedPixKey = sanitizeOptionalText(payload.pixKey);
  const sanitizedNotificationUrl = sanitizeOptionalText(payload.notificationUrl);
  const sanitizedInstructions = sanitizeOptionalText(payload.instructions);

  const expirationMinutes = Number.isFinite(payload.pixExpirationMinutes)
    ? Math.min(Math.max(Number(payload.pixExpirationMinutes), 5), 1440)
    : DEFAULT_EXPIRATION_MINUTES;

  const amountOptions = sanitizeAmountOptions(payload.amountOptions ?? DEFAULT_AMOUNT_OPTIONS);
  const normalizedAmountOptions = amountOptions.length > 0 ? amountOptions : Array.from(DEFAULT_AMOUNT_OPTIONS);

  const credentials = JSON.stringify({
    accessToken: sanitizedAccessToken,
    publicKey: sanitizedPublicKey,
    pixKey: sanitizedPixKey,
  });

  const settings = JSON.stringify({
    notificationUrl: sanitizedNotificationUrl,
    pixExpirationMinutes: expirationMinutes,
    amountOptions: normalizedAmountOptions,
    instructions: sanitizedInstructions,
  });

  await db.query<ResultSetHeader>(
    `
      INSERT INTO admin_payment_methods (
        provider,
        is_active,
        display_name,
        credentials,
        settings,
        metadata
      ) VALUES ('mercadopago_pix', ?, ?, ?, ?, NULL)
      ON DUPLICATE KEY UPDATE
        is_active = VALUES(is_active),
        display_name = VALUES(display_name),
        credentials = VALUES(credentials),
        settings = VALUES(settings),
        metadata = VALUES(metadata)
    `,
    [sanitizedAccessToken.length > 0 && payload.isActive ? 1 : 0, sanitizedDisplayName, credentials, settings],
  );

  return getAdminMercadoPagoPixConfig();
};

export const upsertAdminMercadoPagoCheckoutConfig = async (payload: {
  isActive: boolean;
  displayName?: string | null;
  accessToken: string;
  publicKey?: string | null;
  notificationUrl?: string | null;
  amountOptions?: number[];
  allowedPaymentTypes?: MercadoPagoCheckoutPaymentType[];
  allowedPaymentMethods?: MercadoPagoCheckoutPaymentMethod[];
}): Promise<MercadoPagoCheckoutConfig> => {
  await ensureAdminPaymentMethodTable();
  const db = getDb();

  const sanitizedAccessToken = sanitizeText(payload.accessToken);
  const sanitizedDisplayName =
    payload.displayName?.trim() || DEFAULT_MERCADO_PAGO_CHECKOUT_DISPLAY_NAME;
  const sanitizedPublicKey = sanitizeOptionalText(payload.publicKey);
  const sanitizedNotificationUrl = sanitizeOptionalText(payload.notificationUrl);
  const amountOptions = sanitizeAmountOptions(payload.amountOptions ?? DEFAULT_AMOUNT_OPTIONS);
  const normalizedAmountOptions = amountOptions.length > 0 ? amountOptions : Array.from(DEFAULT_AMOUNT_OPTIONS);

  const allowedPaymentTypes = sanitizeCheckoutPaymentTypes(payload.allowedPaymentTypes);
  const allowedPaymentMethods = sanitizeCheckoutPaymentMethods(payload.allowedPaymentMethods);

  const credentials = JSON.stringify({
    accessToken: sanitizedAccessToken,
    publicKey: sanitizedPublicKey,
  });

  const settings = JSON.stringify({
    notificationUrl: sanitizedNotificationUrl,
    amountOptions: normalizedAmountOptions,
    allowedPaymentTypes: allowedPaymentTypes.length > 0
      ? allowedPaymentTypes
      : ["credit_card", "debit_card", "ticket", "bank_transfer"],
    allowedPaymentMethods: allowedPaymentMethods.length > 0 ? allowedPaymentMethods : ["pix"],
  });

  await db.query<ResultSetHeader>(
    `
      INSERT INTO admin_payment_methods (
        provider,
        is_active,
        display_name,
        credentials,
        settings,
        metadata
      ) VALUES ('mercadopago_checkout', ?, ?, ?, ?, NULL)
      ON DUPLICATE KEY UPDATE
        is_active = VALUES(is_active),
        display_name = VALUES(display_name),
        credentials = VALUES(credentials),
        settings = VALUES(settings),
        metadata = VALUES(metadata)
    `,
    [sanitizedAccessToken.length > 0 && payload.isActive ? 1 : 0, sanitizedDisplayName, credentials, settings],
  );

  return getAdminMercadoPagoCheckoutConfig();
};

export const upsertAdminPaymentConfirmationConfig = async (payload: {
  messageText: string;
  buttonLabel: string;
  mediaPath?: string | null;
  mediaUrl?: string | null;
}): Promise<PaymentConfirmationMessageConfig> => {
  await ensureAdminPaymentMethodTable();
  const db = getDb();

  const messageText = sanitizeText(payload.messageText);
  const buttonLabel = sanitizeText(payload.buttonLabel);
  const mediaPath = sanitizeOptionalMediaPath(payload.mediaPath);
  const mediaUrl = mediaPath ? resolveMediaUrl(mediaPath) : sanitizeOptionalUrl(payload.mediaUrl);

  const settings = JSON.stringify({
    messageText: messageText || DEFAULT_CONFIRMATION_MESSAGE,
    buttonLabel: buttonLabel || DEFAULT_CONFIRMATION_BUTTON,
    mediaPath: mediaPath ?? null,
    mediaUrl: mediaUrl ?? null,
  });

  await db.query<ResultSetHeader>(
    `
      INSERT INTO admin_payment_methods (
        provider,
        is_active,
        display_name,
        credentials,
        settings,
        metadata
      ) VALUES ('payment_confirmation', 1, 'Confirmação de pagamento', NULL, ?, NULL)
      ON DUPLICATE KEY UPDATE
        settings = VALUES(settings),
        updated_at = CURRENT_TIMESTAMP
    `,
    [settings],
  );

  return getAdminPaymentConfirmationConfig();
};
