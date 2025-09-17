import { randomUUID } from "crypto";
import { ResultSetHeader } from "mysql2";

import type {
  MercadoPagoCheckoutCharge,
  MercadoPagoCheckoutConfig,
  MercadoPagoCheckoutPaymentMethod,
  MercadoPagoCheckoutPaymentType,
  MercadoPagoPixCharge,
  MercadoPagoPixConfig,
  PaymentCharge,
  PaymentMethodSummary,
} from "types/payments";
import {
  UserPaymentChargeRow,
  UserPaymentMethodRow,
  ensurePaymentChargeTable,
  ensurePaymentMethodTable,
  getDb,
} from "./db";
import {
  createMercadoPagoCheckoutPreference,
  createMercadoPagoPixPayment,
} from "./mercadopago";

const DEFAULT_MERCADO_PAGO_PIX_DISPLAY_NAME = "Pagamento Pix";
const DEFAULT_MERCADO_PAGO_CHECKOUT_DISPLAY_NAME = "Pagamento online";
const DEFAULT_EXPIRATION_MINUTES = 30;
const DEFAULT_AMOUNT_OPTIONS = [25, 50, 100];
const CHECKOUT_PAYMENT_TYPES: readonly MercadoPagoCheckoutPaymentType[] = [
  "credit_card",
  "debit_card",
  "ticket",
  "bank_transfer",
  "atm",
  "account_money",
];
const CHECKOUT_PAYMENT_METHODS: readonly MercadoPagoCheckoutPaymentMethod[] = ["pix"];
const DEFAULT_CHECKOUT_PAYMENT_TYPES: readonly MercadoPagoCheckoutPaymentType[] = [
  "credit_card",
  "debit_card",
  "ticket",
  "bank_transfer",
];
const DEFAULT_CHECKOUT_PAYMENT_METHODS: readonly MercadoPagoCheckoutPaymentMethod[] = ["pix"];

const getAppBaseUrl = () => {
  const raw = process.env.APP_URL?.trim();
  if (!raw) {
    return "http://localhost:4478";
  }

  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
};

export const getMercadoPagoNotificationUrl = () =>
  `${getAppBaseUrl()}/api/payments/mercadopago/webhook`;

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

const sanitizeAmountOptions = (values: unknown): number[] => {
  if (!Array.isArray(values)) {
    return [];
  }

  const parsed = values
    .map((entry) => {
      if (typeof entry === "number" && Number.isFinite(entry)) {
        return entry;
      }

      if (typeof entry === "string" && entry.trim()) {
        const normalized = entry.trim().replace(/[^0-9,.-]/g, "");
        const usesComma = normalized.includes(",");
        const sanitized = usesComma
          ? normalized.replace(/\./g, "").replace(/,/g, ".")
          : normalized;
        const parsedNumber = Number.parseFloat(sanitized);
        if (Number.isFinite(parsedNumber)) {
          return parsedNumber;
        }
      }

      return null;
    })
    .filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry));

  const unique = Array.from(new Set(parsed.map((value) => Number(value.toFixed(2)))));
  return unique
    .filter((value) => value > 0)
    .sort((a, b) => a - b)
    .slice(0, 20);
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

const mapPixPaymentMethodRow = (row: UserPaymentMethodRow | null): MercadoPagoPixConfig => {
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
      console.warn("Failed to parse payment credentials", error);
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
      console.warn("Failed to parse payment settings", error);
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
  row: UserPaymentMethodRow | null,
): MercadoPagoCheckoutConfig => {
  const defaultConfig: MercadoPagoCheckoutConfig = {
    isActive: false,
    displayName: DEFAULT_MERCADO_PAGO_CHECKOUT_DISPLAY_NAME,
    accessToken: "",
    publicKey: null,
    notificationUrl: null,
    allowedPaymentTypes: Array.from(DEFAULT_CHECKOUT_PAYMENT_TYPES),
    allowedPaymentMethods: Array.from(DEFAULT_CHECKOUT_PAYMENT_METHODS),
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
      console.warn("Failed to parse payment credentials", error);
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
      console.warn("Failed to parse payment settings", error);
    }
  }

  const accessToken = sanitizeText(credentials.accessToken);
  const publicKey = sanitizeOptionalText(credentials.publicKey);
  const notificationUrl =
    sanitizeOptionalText(settings.notificationUrl) ?? getMercadoPagoNotificationUrl();

  const allowedPaymentTypesRaw = Array.isArray(settings.allowedPaymentTypes)
    ? settings.allowedPaymentTypes
    : DEFAULT_CHECKOUT_PAYMENT_TYPES;
  const allowedPaymentTypes = sanitizeCheckoutPaymentTypes(allowedPaymentTypesRaw);

  const allowedPaymentMethodsRaw = Array.isArray(settings.allowedPaymentMethods)
    ? settings.allowedPaymentMethods
    : DEFAULT_CHECKOUT_PAYMENT_METHODS;
  const allowedPaymentMethods = sanitizeCheckoutPaymentMethods(allowedPaymentMethodsRaw);

  const updatedAt = row.updated_at instanceof Date
    ? row.updated_at.toISOString()
    : new Date(row.updated_at).toISOString();

  return {
    isActive: row.is_active === 1 && accessToken.length > 0,
    displayName: row.display_name?.trim() || DEFAULT_MERCADO_PAGO_CHECKOUT_DISPLAY_NAME,
    accessToken,
    publicKey,
    notificationUrl,
    allowedPaymentTypes:
      allowedPaymentTypes.length > 0
        ? allowedPaymentTypes
        : Array.from(DEFAULT_CHECKOUT_PAYMENT_TYPES),
    allowedPaymentMethods:
      allowedPaymentMethods.length > 0
        ? allowedPaymentMethods
        : Array.from(DEFAULT_CHECKOUT_PAYMENT_METHODS),
    isConfigured: accessToken.length > 0,
    updatedAt,
  } satisfies MercadoPagoCheckoutConfig;
};

const parseChargeMetadata = (raw: unknown): Record<string, unknown> | null => {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch (error) {
    console.warn("Failed to parse charge metadata", error);
  }

  return null;
};

const mapChargeRow = (row: UserPaymentChargeRow): PaymentCharge => ({
  id: row.id,
  publicId: row.public_id,
  userId: row.user_id,
  provider: row.provider,
  providerPaymentId: row.provider_payment_id,
  status: row.status,
  amount: Number.parseFloat(row.amount),
  currency: row.currency,
  qrCode: row.qr_code,
  qrCodeBase64: row.qr_code_base64,
  ticketUrl: row.ticket_url,
  expiresAt: row.expires_at ? (row.expires_at instanceof Date
    ? row.expires_at.toISOString()
    : new Date(row.expires_at).toISOString()) : null,
  customerWhatsapp: row.customer_whatsapp,
  customerName: row.customer_name,
  metadata: parseChargeMetadata(row.metadata),
  createdAt: row.created_at instanceof Date
    ? row.created_at.toISOString()
    : new Date(row.created_at).toISOString(),
  updatedAt: row.updated_at instanceof Date
    ? row.updated_at.toISOString()
    : new Date(row.updated_at).toISOString(),
});

export const getPixChargeImageUrl = (publicId: string) => {
  const trimmed = publicId.trim();
  return `${getAppBaseUrl()}/api/payments/mercadopago/pix/${trimmed}/image`;
};

export const getMercadoPagoPixConfigForUser = async (
  userId: number,
): Promise<MercadoPagoPixConfig> => {
  await ensurePaymentMethodTable();
  const db = getDb();
  const [rows] = await db.query<UserPaymentMethodRow[]>(
    `SELECT * FROM user_payment_methods WHERE user_id = ? AND provider = 'mercadopago_pix' LIMIT 1`,
    [userId],
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return mapPixPaymentMethodRow(null);
  }

  return mapPixPaymentMethodRow(rows[0]);
};

export const getMercadoPagoCheckoutConfigForUser = async (
  userId: number,
): Promise<MercadoPagoCheckoutConfig> => {
  await ensurePaymentMethodTable();
  const db = getDb();
  const [rows] = await db.query<UserPaymentMethodRow[]>(
    `SELECT * FROM user_payment_methods WHERE user_id = ? AND provider = 'mercadopago_checkout' LIMIT 1`,
    [userId],
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return mapCheckoutPaymentMethodRow(null);
  }

  return mapCheckoutPaymentMethodRow(rows[0]);
};

export const getPaymentMethodSummariesForUser = async (
  userId: number,
): Promise<PaymentMethodSummary[]> => {
  const [pixConfig, checkoutConfig] = await Promise.all([
    getMercadoPagoPixConfigForUser(userId),
    getMercadoPagoCheckoutConfigForUser(userId),
  ]);

  const summaries: PaymentMethodSummary[] = [
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

  return summaries;
};

export const upsertMercadoPagoPixConfig = async (payload: {
  userId: number;
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
  await ensurePaymentMethodTable();
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
      INSERT INTO user_payment_methods (
        user_id,
        provider,
        is_active,
        display_name,
        credentials,
        settings,
        metadata
      ) VALUES (?, 'mercadopago_pix', ?, ?, ?, ?, NULL)
      ON DUPLICATE KEY UPDATE
        is_active = VALUES(is_active),
        display_name = VALUES(display_name),
        credentials = VALUES(credentials),
        settings = VALUES(settings),
        metadata = VALUES(metadata)
    `,
    [
      payload.userId,
      sanitizedAccessToken.length > 0 && payload.isActive ? 1 : 0,
      sanitizedDisplayName,
      credentials,
      settings,
    ],
  );

  return getMercadoPagoPixConfigForUser(payload.userId);
};

export const upsertMercadoPagoCheckoutConfig = async (payload: {
  userId: number;
  isActive: boolean;
  displayName?: string | null;
  accessToken: string;
  publicKey?: string | null;
  notificationUrl?: string | null;
  allowedPaymentTypes?: MercadoPagoCheckoutPaymentType[];
  allowedPaymentMethods?: MercadoPagoCheckoutPaymentMethod[];
}): Promise<MercadoPagoCheckoutConfig> => {
  await ensurePaymentMethodTable();
  const db = getDb();

  const sanitizedAccessToken = sanitizeText(payload.accessToken);
  const sanitizedDisplayName =
    payload.displayName?.trim() || DEFAULT_MERCADO_PAGO_CHECKOUT_DISPLAY_NAME;
  const sanitizedPublicKey = sanitizeOptionalText(payload.publicKey);
  const sanitizedNotificationUrl = sanitizeOptionalText(payload.notificationUrl);

  const paymentTypes = sanitizeCheckoutPaymentTypes(
    payload.allowedPaymentTypes ?? DEFAULT_CHECKOUT_PAYMENT_TYPES,
  );
  const normalizedPaymentTypes =
    paymentTypes.length > 0 ? paymentTypes : Array.from(DEFAULT_CHECKOUT_PAYMENT_TYPES);

  const paymentMethods = sanitizeCheckoutPaymentMethods(
    payload.allowedPaymentMethods ?? DEFAULT_CHECKOUT_PAYMENT_METHODS,
  );
  const normalizedPaymentMethods =
    paymentMethods.length > 0 ? paymentMethods : Array.from(DEFAULT_CHECKOUT_PAYMENT_METHODS);

  const credentials = JSON.stringify({
    accessToken: sanitizedAccessToken,
    publicKey: sanitizedPublicKey,
  });

  const settings = JSON.stringify({
    notificationUrl: sanitizedNotificationUrl,
    allowedPaymentTypes: normalizedPaymentTypes,
    allowedPaymentMethods: normalizedPaymentMethods,
  });

  await db.query<ResultSetHeader>(
    `
      INSERT INTO user_payment_methods (
        user_id,
        provider,
        is_active,
        display_name,
        credentials,
        settings,
        metadata
      ) VALUES (?, 'mercadopago_checkout', ?, ?, ?, ?, NULL)
      ON DUPLICATE KEY UPDATE
        is_active = VALUES(is_active),
        display_name = VALUES(display_name),
        credentials = VALUES(credentials),
        settings = VALUES(settings),
        metadata = VALUES(metadata)
    `,
    [
      payload.userId,
      sanitizedAccessToken.length > 0 && payload.isActive ? 1 : 0,
      sanitizedDisplayName,
      credentials,
      settings,
    ],
  );

  return getMercadoPagoCheckoutConfigForUser(payload.userId);
};

export const createMercadoPagoPixCharge = async (payload: {
  userId: number;
  amount: number;
  customerWhatsapp: string;
  customerName?: string | null;
  config: MercadoPagoPixConfig;
}): Promise<MercadoPagoPixCharge> => {
  await ensurePaymentChargeTable();
  const db = getDb();

  if (!payload.config.isConfigured || !payload.config.accessToken) {
    throw new Error("Mercado Pago Pix não configurado para este usuário.");
  }

  const sanitizedAmount = Number(payload.amount);
  if (!Number.isFinite(sanitizedAmount) || sanitizedAmount <= 0) {
    throw new Error("Valor inválido para geração de cobrança Pix.");
  }

  const expirationMinutes = payload.config.pixExpirationMinutes > 0
    ? payload.config.pixExpirationMinutes
    : DEFAULT_EXPIRATION_MINUTES;
  const expiresAt = Number.isFinite(expirationMinutes)
    ? new Date(Date.now() + expirationMinutes * 60_000)
    : new Date(Date.now() + DEFAULT_EXPIRATION_MINUTES * 60_000);

  const customerWhatsapp = payload.customerWhatsapp.trim();
  const customerName = sanitizeOptionalText(payload.customerName);

  const reference = `storebot:${payload.userId}:${Date.now()}:${Math.floor(Math.random() * 1_000_000)}`;
  const payerEmail = `cliente+${payload.userId}+${Date.now()}@storebot.app`;

  const nameParts = customerName ? customerName.split(" ").filter(Boolean) : [];
  const payerFirstName = nameParts.length > 0 ? nameParts[0] : "Cliente";
  const payerLastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined;

  const pixPayment = await createMercadoPagoPixPayment({
    accessToken: payload.config.accessToken,
    amount: sanitizedAmount,
    description: `${payload.config.displayName} - saldo StoreBot`,
    externalReference: reference,
    payer: {
      email: payerEmail,
      firstName: payerFirstName,
      lastName: payerLastName ?? null,
    },
    notificationUrl: payload.config.notificationUrl,
    expiresAt,
    additionalMetadata: {
      storebot_user_id: payload.userId,
      storebot_customer_whatsapp: customerWhatsapp,
    },
  });

  const chargePublicId = randomUUID();
  const expiresAtDate = pixPayment.dateOfExpiration
    ? new Date(pixPayment.dateOfExpiration)
    : expiresAt;

  const metadataPayload: Record<string, unknown> = {
    createdAt: new Date().toISOString(),
    initialPaymentPayload: pixPayment.raw ?? {},
  };

  await db.query<ResultSetHeader>(
    `
      INSERT INTO user_payment_charges (
        public_id,
        user_id,
        provider,
        provider_payment_id,
        status,
        amount,
        currency,
        qr_code,
        qr_code_base64,
        ticket_url,
        expires_at,
        customer_whatsapp,
        customer_name,
        metadata
      ) VALUES (?, ?, 'mercadopago_pix', ?, ?, ?, 'BRL', ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      chargePublicId,
      payload.userId,
      pixPayment.id,
      pixPayment.status,
      Number(sanitizedAmount.toFixed(2)),
      pixPayment.qrCode,
      pixPayment.qrCodeBase64,
      pixPayment.ticketUrl,
      expiresAtDate && Number.isFinite(expiresAtDate.getTime()) ? expiresAtDate : null,
      customerWhatsapp || null,
      customerName,
      JSON.stringify(metadataPayload),
    ],
  );

  const [rows] = await db.query<UserPaymentChargeRow[]>(
    `SELECT * FROM user_payment_charges WHERE public_id = ? LIMIT 1`,
    [chargePublicId],
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("Não foi possível recuperar a cobrança Pix recém-criada.");
  }

  const charge = mapChargeRow(rows[0]);

  if (charge.provider !== "mercadopago_pix") {
    throw new Error("Cobrança criada com provedor inesperado.");
  }

  return charge as MercadoPagoPixCharge;
};

export const createMercadoPagoCheckoutCharge = async (payload: {
  userId: number;
  amount: number;
  customerWhatsapp: string;
  customerName?: string | null;
  config: MercadoPagoCheckoutConfig;
}): Promise<MercadoPagoCheckoutCharge> => {
  await ensurePaymentChargeTable();
  const db = getDb();

  if (!payload.config.isConfigured || !payload.config.accessToken) {
    throw new Error("Mercado Pago Checkout não configurado para este usuário.");
  }

  const sanitizedAmount = Number(payload.amount);
  if (!Number.isFinite(sanitizedAmount) || sanitizedAmount <= 0) {
    throw new Error("Valor inválido para geração de cobrança no checkout.");
  }

  const customerWhatsapp = payload.customerWhatsapp.trim();
  const customerName = sanitizeOptionalText(payload.customerName);

  const reference = `storebot:${payload.userId}:${Date.now()}:${Math.floor(Math.random() * 1_000_000)}`;
  const payerEmail = `cliente+${payload.userId}+${Date.now()}@storebot.app`;

  const nameParts = customerName ? customerName.split(" ").filter(Boolean) : [];
  const payerFirstName = nameParts.length > 0 ? nameParts[0] : "Cliente";
  const payerLastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined;

  const allowedTypeSet = new Set(payload.config.allowedPaymentTypes);
  const excludedPaymentTypes = CHECKOUT_PAYMENT_TYPES.filter((type) => !allowedTypeSet.has(type));

  const allowedMethodSet = new Set(payload.config.allowedPaymentMethods);
  const excludedPaymentMethods = CHECKOUT_PAYMENT_METHODS.filter((method) => !allowedMethodSet.has(method));

  const preference = await createMercadoPagoCheckoutPreference({
    accessToken: payload.config.accessToken,
    amount: sanitizedAmount,
    title: payload.config.displayName,
    description: `${payload.config.displayName} - saldo StoreBot`,
    externalReference: reference,
    notificationUrl: payload.config.notificationUrl,
    payer: {
      email: payerEmail,
      firstName: payerFirstName,
      lastName: payerLastName ?? null,
    },
    metadata: {
      storebot_user_id: payload.userId,
      storebot_customer_whatsapp: customerWhatsapp,
    },
    excludedPaymentTypes,
    excludedPaymentMethods,
  });

  const chargePublicId = randomUUID();
  const checkoutUrl = preference.initPoint ?? preference.sandboxInitPoint ?? null;

  const metadataPayload: Record<string, unknown> = {
    createdAt: new Date().toISOString(),
    initialPreferencePayload: preference.raw ?? {},
  };

  await db.query<ResultSetHeader>(
    `
      INSERT INTO user_payment_charges (
        public_id,
        user_id,
        provider,
        provider_payment_id,
        status,
        amount,
        currency,
        qr_code,
        qr_code_base64,
        ticket_url,
        expires_at,
        customer_whatsapp,
        customer_name,
        metadata
      ) VALUES (?, ?, 'mercadopago_checkout', ?, 'pending', ?, 'BRL', NULL, NULL, ?, NULL, ?, ?, ?)
    `,
    [
      chargePublicId,
      payload.userId,
      preference.id,
      Number(sanitizedAmount.toFixed(2)),
      checkoutUrl,
      customerWhatsapp || null,
      customerName,
      JSON.stringify(metadataPayload),
    ],
  );

  const charge = await getPaymentChargeByPublicId(chargePublicId);

  if (!charge || charge.provider !== "mercadopago_checkout") {
    throw new Error("Não foi possível recuperar a cobrança de checkout recém-criada.");
  }

  return charge as MercadoPagoCheckoutCharge;
};

export const getPaymentChargeByPublicId = async (
  publicId: string,
): Promise<PaymentCharge | null> => {
  await ensurePaymentChargeTable();
  const db = getDb();
  const trimmed = publicId.trim();

  const [rows] = await db.query<UserPaymentChargeRow[]>(
    `SELECT * FROM user_payment_charges WHERE public_id = ? LIMIT 1`,
    [trimmed],
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return mapChargeRow(rows[0]);
};

export const getPaymentChargeByProviderPaymentId = async (
  providerPaymentId: string,
): Promise<PaymentCharge | null> => {
  await ensurePaymentChargeTable();
  const db = getDb();
  const trimmed = providerPaymentId.trim();

  if (!trimmed) {
    return null;
  }

  const [rows] = await db.query<UserPaymentChargeRow[]>(
    `SELECT * FROM user_payment_charges WHERE provider_payment_id = ? LIMIT 1`,
    [trimmed],
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return mapChargeRow(rows[0]);
};

export const getMercadoPagoPixChargeByPublicId = async (
  publicId: string,
): Promise<MercadoPagoPixCharge | null> => {
  const charge = await getPaymentChargeByPublicId(publicId);
  return charge && charge.provider === "mercadopago_pix" ? (charge as MercadoPagoPixCharge) : null;
};

export const getMercadoPagoPixChargeByProviderPaymentId = async (
  providerPaymentId: string,
): Promise<MercadoPagoPixCharge | null> => {
  const charge = await getPaymentChargeByProviderPaymentId(providerPaymentId);
  return charge && charge.provider === "mercadopago_pix" ? (charge as MercadoPagoPixCharge) : null;
};

type UpdateChargeStatusInput = {
  chargeId: number;
  status: string;
  statusDetail?: string | null;
  rawPayload?: Record<string, unknown> | null;
  creditResult?: {
    success: boolean;
    amount: number;
    balance: number;
    customerId: number | null;
    customerWhatsapp: string | null;
    creditedAt: string;
    reason?: string | null;
  } | null;
};

export const updatePaymentChargeStatus = async (
  input: UpdateChargeStatusInput,
): Promise<PaymentCharge | null> => {
  await ensurePaymentChargeTable();
  const db = getDb();

  const [existingRows] = await db.query<UserPaymentChargeRow[]>(
    `SELECT * FROM user_payment_charges WHERE id = ? LIMIT 1`,
    [input.chargeId],
  );

  if (!Array.isArray(existingRows) || existingRows.length === 0) {
    return null;
  }

  const existingRow = existingRows[0];
  const metadata = parseChargeMetadata(existingRow.metadata) ?? {};

  const history = Array.isArray(metadata.webhookHistory)
    ? (metadata.webhookHistory as unknown[])
    : [];
  history.push({
    receivedAt: new Date().toISOString(),
    status: input.status,
    statusDetail: input.statusDetail ?? null,
    payload: input.rawPayload ?? null,
  });

  const trimmedHistory = history.slice(-20);

  const metadataPayload: Record<string, unknown> = {
    ...metadata,
    lastPaymentStatus: {
      status: input.status,
      updatedAt: new Date().toISOString(),
      statusDetail: input.statusDetail ?? null,
      payload: input.rawPayload ?? null,
    },
    webhookHistory: trimmedHistory,
  };

  if (input.creditResult) {
    metadataPayload.lastCreditResult = input.creditResult;
  }

  await db.query(
    `
      UPDATE user_payment_charges
      SET status = ?, metadata = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [input.status, JSON.stringify(metadataPayload), input.chargeId],
  );

  const [rows] = await db.query<UserPaymentChargeRow[]>(
    `SELECT * FROM user_payment_charges WHERE id = ? LIMIT 1`,
    [input.chargeId],
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return mapChargeRow(rows[0]);
};
