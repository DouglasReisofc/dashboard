import { ResultSetHeader } from "mysql2";

import type { PlanCheckoutResponse, SubscriptionPlan } from "types/plans";
import type {
  MercadoPagoCheckoutPaymentMethod,
  MercadoPagoCheckoutPaymentType,
} from "types/payments";

import {
  UserPlanPaymentRow,
  ensureUserPlanPaymentTable,
  getDb,
} from "lib/db";
import {
  getAdminMercadoPagoCheckoutConfig,
  getAdminMercadoPagoPixConfig,
} from "lib/admin-payments";
import {
  createMercadoPagoCheckoutPreference,
  createMercadoPagoPixPayment,
} from "lib/mercadopago";

const buildPlanDescription = (plan: SubscriptionPlan) =>
  `Assinatura do plano ${plan.name}`;

const sanitizeMetadata = (metadata: Record<string, unknown> | null | undefined) =>
  metadata ? JSON.stringify(metadata).slice(0, 6000) : null;

export const recordPlanPayment = async (payload: {
  userId: number;
  planId: number;
  provider: string;
  providerPaymentId: string;
  status: string;
  statusDetail?: string | null;
  amount: number;
  metadata?: Record<string, unknown> | null;
  subscriptionId?: number | null;
}) => {
  await ensureUserPlanPaymentTable();
  const db = getDb();

  await db.query<ResultSetHeader>(
    `
      INSERT INTO user_plan_payments (
        user_id,
        plan_id,
        subscription_id,
        provider,
        provider_payment_id,
        status,
        status_detail,
        amount,
        currency,
        metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'BRL', ?)
      ON DUPLICATE KEY UPDATE
        status = VALUES(status),
        status_detail = VALUES(status_detail),
        amount = VALUES(amount),
        metadata = VALUES(metadata),
        subscription_id = COALESCE(VALUES(subscription_id), subscription_id),
        updated_at = CURRENT_TIMESTAMP
    `,
    [
      payload.userId,
      payload.planId,
      payload.subscriptionId ?? null,
      payload.provider,
      payload.providerPaymentId,
      payload.status,
      payload.statusDetail ?? null,
      payload.amount,
      sanitizeMetadata(payload.metadata ?? null),
    ],
  );
};

export const createPlanPixCharge = async ({
  userId,
  userName,
  userEmail,
  plan,
}: {
  userId: number;
  userName: string;
  userEmail: string;
  plan: SubscriptionPlan;
}): Promise<PlanCheckoutResponse> => {
  const pixConfig = await getAdminMercadoPagoPixConfig();

  if (!pixConfig.isConfigured || !pixConfig.accessToken) {
    throw new Error("O Pix do administrador não está configurado.");
  }

  const payerNameParts = userName.split(" ").filter((part) => part.trim().length > 0);
  const payerFirstName = payerNameParts[0] ?? "Cliente";
  const payerLastName = payerNameParts.length > 1 ? payerNameParts.slice(1).join(" ") : null;

  const reference = `plan:${userId}:${plan.id}:${Date.now()}`;
  const expiresInMinutes = pixConfig.pixExpirationMinutes > 0 ? pixConfig.pixExpirationMinutes : 30;
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60_000);

  const pixPayment = await createMercadoPagoPixPayment({
    accessToken: pixConfig.accessToken,
    amount: plan.price,
    description: buildPlanDescription(plan),
    externalReference: reference,
    payer: {
      email: userEmail,
      firstName: payerFirstName,
      lastName: payerLastName,
    },
    notificationUrl: pixConfig.notificationUrl,
    expiresAt,
    additionalMetadata: {
      storebot_plan_user_id: userId,
      storebot_plan_id: plan.id,
    },
  });

  await recordPlanPayment({
    userId,
    planId: plan.id,
    provider: "mercadopago_pix",
    providerPaymentId: String(pixPayment.id),
    status: pixPayment.status,
    statusDetail: pixPayment.statusDetail ?? null,
    amount: plan.price,
    metadata: {
      publicId: pixPayment.id,
      externalReference: reference,
      type: "plan",
    },
  });

  const expiresAtIso = pixPayment.dateOfExpiration
    ? new Date(pixPayment.dateOfExpiration).toISOString()
    : expiresAt.toISOString();

  return {
    paymentId: String(pixPayment.id),
    providerPaymentId: String(pixPayment.id),
    provider: "mercadopago_pix",
    amount: plan.price,
    ticketUrl: pixPayment.ticketUrl ?? null,
    qrCode: pixPayment.qrCode ?? null,
    qrCodeBase64: pixPayment.qrCodeBase64 ?? null,
    expiresAt: expiresAtIso,
  } satisfies PlanCheckoutResponse;
};

export const createPlanCheckoutPreference = async ({
  userId,
  userName,
  userEmail,
  plan,
}: {
  userId: number;
  userName: string;
  userEmail: string;
  plan: SubscriptionPlan;
}): Promise<PlanCheckoutResponse> => {
  const checkoutConfig = await getAdminMercadoPagoCheckoutConfig();

  if (!checkoutConfig.isConfigured || !checkoutConfig.accessToken) {
    throw new Error("O checkout do administrador não está configurado.");
  }

  const reference = `plan:${userId}:${plan.id}:${Date.now()}`;
  const payerNameParts = userName.split(" ").filter((part) => part.trim().length > 0);
  const payerFirstName = payerNameParts[0] ?? "Cliente";
  const payerLastName = payerNameParts.length > 1 ? payerNameParts.slice(1).join(" ") : null;

  const ALL_PAYMENT_TYPES: readonly MercadoPagoCheckoutPaymentType[] = [
    "credit_card",
    "debit_card",
    "ticket",
    "bank_transfer",
    "atm",
    "account_money",
  ];
  const ALL_PAYMENT_METHODS: readonly MercadoPagoCheckoutPaymentMethod[] = ["pix"];

  const excludedPaymentTypes = ALL_PAYMENT_TYPES.filter(
    (type) => !checkoutConfig.allowedPaymentTypes.includes(type),
  );

  const excludedPaymentMethods = ALL_PAYMENT_METHODS.filter(
    (method) => !checkoutConfig.allowedPaymentMethods.includes(method),
  );

  const preference = await createMercadoPagoCheckoutPreference({
    accessToken: checkoutConfig.accessToken,
    amount: plan.price,
    title: plan.name,
    description: buildPlanDescription(plan),
    externalReference: reference,
    notificationUrl: checkoutConfig.notificationUrl,
    payer: {
      email: userEmail,
      firstName: payerFirstName,
      lastName: payerLastName,
    },
    metadata: {
      storebot_plan_user_id: userId,
      storebot_plan_id: plan.id,
    },
    excludedPaymentMethods,
    excludedPaymentTypes,
  });

  await recordPlanPayment({
    userId,
    planId: plan.id,
    provider: "mercadopago_checkout",
    providerPaymentId: String(preference.id),
    status: "pending",
    statusDetail: null,
    amount: plan.price,
    metadata: {
      preferenceId: preference.id,
      initPoint: preference.initPoint,
      sandboxInitPoint: preference.sandboxInitPoint,
      externalReference: reference,
      type: "plan",
    },
  });

  return {
    paymentId: String(preference.id),
    providerPaymentId: String(preference.id),
    provider: "mercadopago_checkout",
    amount: plan.price,
    ticketUrl: preference.initPoint ?? preference.sandboxInitPoint ?? null,
    qrCode: null,
    qrCodeBase64: null,
    expiresAt: null,
  } satisfies PlanCheckoutResponse;
};

export const getPlanPaymentByProviderPaymentId = async (
  providerPaymentId: string,
): Promise<UserPlanPaymentRow | null> => {
  await ensureUserPlanPaymentTable();
  const db = getDb();

  const [rows] = await db.query<UserPlanPaymentRow[]>(
    `SELECT * FROM user_plan_payments WHERE provider_payment_id = ? LIMIT 1`,
    [providerPaymentId],
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return rows[0];
};

export const updatePlanPaymentStatus = async (
  providerPaymentId: string,
  status: string,
  statusDetail: string | null,
  metadata?: Record<string, unknown> | null,
  subscriptionId?: number | null,
): Promise<UserPlanPaymentRow | null> => {
  await ensureUserPlanPaymentTable();
  const db = getDb();

  await db.query(
    `
      UPDATE user_plan_payments
      SET
        status = ?,
        status_detail = ?,
        metadata = COALESCE(?, metadata),
        subscription_id = COALESCE(?, subscription_id),
        updated_at = CURRENT_TIMESTAMP
      WHERE provider_payment_id = ?
    `,
    [status, statusDetail ?? null, sanitizeMetadata(metadata ?? null), subscriptionId ?? null, providerPaymentId],
  );

  const [rows] = await db.query<UserPlanPaymentRow[]>(
    `SELECT * FROM user_plan_payments WHERE provider_payment_id = ? LIMIT 1`,
    [providerPaymentId],
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return rows[0];
};
