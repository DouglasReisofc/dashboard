import { ResultSetHeader, RowDataPacket } from "mysql2";

import type { SubscriptionPlan, SubscriptionPlanPayload, UserPlanStatus } from "types/plans";

import {
  SubscriptionPlanRow,
  UserPlanSubscriptionRow,
  ensureSubscriptionPlanTable,
  ensureUserPlanSubscriptionTable,
  getDb,
} from "./db";

export class SubscriptionPlanError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "SubscriptionPlanError";
    this.status = status;
  }
}

const sanitizeText = (value: unknown, maxLength: number): string => {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.length > maxLength) {
    return trimmed.slice(0, maxLength);
  }

  return trimmed;
};

const sanitizeOptionalText = (value: unknown, maxLength: number): string | null => {
  const text = sanitizeText(value, maxLength);
  return text ? text : null;
};

const sanitizePositiveInteger = (value: unknown, label: string, minValue: number): number => {
  const numeric = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(numeric) || Number.isNaN(numeric)) {
    throw new SubscriptionPlanError(`Informe ${label}.`);
  }

  const rounded = Math.floor(Number(numeric));
  if (rounded < minValue) {
    throw new SubscriptionPlanError(`${label} deve ser no mínimo ${minValue}.`);
  }

  return rounded;
};

const sanitizePrice = (value: unknown): number => {
  const numeric = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));

  if (!Number.isFinite(numeric) || Number.isNaN(numeric)) {
    throw new SubscriptionPlanError("Informe o preço do plano.");
  }

  if (numeric < 0) {
    throw new SubscriptionPlanError("O preço não pode ser negativo.");
  }

  return Number(numeric.toFixed(2));
};

const normalizePayload = (payload: SubscriptionPlanPayload): SubscriptionPlanPayload => {
  const name = sanitizeText(payload.name, 120);
  if (!name) {
    throw new SubscriptionPlanError("Informe o nome do plano.");
  }

  const description = sanitizeOptionalText(payload.description, 500);
  const price = sanitizePrice(payload.price);
  const categoryLimit = sanitizePositiveInteger(payload.categoryLimit, "o limite de categorias", 0);
  const durationDays = sanitizePositiveInteger(payload.durationDays, "a duração em dias", 1);
  const isActive = Boolean(payload.isActive);

  return {
    name,
    description,
    price,
    categoryLimit,
    durationDays,
    isActive,
  };
};

const mapPlanRow = (row: SubscriptionPlanRow): SubscriptionPlan => ({
  id: row.id,
  name: row.name,
  description: row.description ?? null,
  price: Number.parseFloat(row.price),
  categoryLimit: row.category_limit,
  durationDays: row.duration_days,
  isActive: row.is_active === 1,
  createdAt: row.created_at instanceof Date
    ? row.created_at.toISOString()
    : new Date(row.created_at).toISOString(),
  updatedAt: row.updated_at instanceof Date
    ? row.updated_at.toISOString()
    : new Date(row.updated_at).toISOString(),
});

export const getAllSubscriptionPlans = async (): Promise<SubscriptionPlan[]> => {
  await ensureSubscriptionPlanTable();
  const db = getDb();
  const [rows] = await db.query<(SubscriptionPlanRow & RowDataPacket)[]>(
    `SELECT * FROM subscription_plans ORDER BY price ASC, name ASC`,
  );

  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.map((row) => mapPlanRow(row));
};

export const createSubscriptionPlan = async (
  payload: SubscriptionPlanPayload,
): Promise<SubscriptionPlan> => {
  const normalized = normalizePayload(payload);
  await ensureSubscriptionPlanTable();
  const db = getDb();

  const [result] = await db.query<ResultSetHeader>(
    `
      INSERT INTO subscription_plans (
        name,
        description,
        price,
        category_limit,
        duration_days,
        is_active
      ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      normalized.name,
      normalized.description,
      normalized.price,
      normalized.categoryLimit,
      normalized.durationDays,
      normalized.isActive ? 1 : 0,
    ],
  );

  const insertedId = result.insertId;

  const [rows] = await db.query<(SubscriptionPlanRow & RowDataPacket)[]>(
    `SELECT * FROM subscription_plans WHERE id = ? LIMIT 1`,
    [insertedId],
  );

  const planRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!planRow) {
    throw new SubscriptionPlanError("Não foi possível carregar o plano após a criação.", 500);
  }

  return mapPlanRow(planRow);
};

export const updateSubscriptionPlan = async (
  planId: number,
  payload: SubscriptionPlanPayload,
): Promise<SubscriptionPlan> => {
  if (!Number.isFinite(planId) || planId <= 0) {
    throw new SubscriptionPlanError("Plano inválido.", 404);
  }

  const normalized = normalizePayload(payload);
  await ensureSubscriptionPlanTable();
  const db = getDb();

  const [result] = await db.query<ResultSetHeader>(
    `
      UPDATE subscription_plans
      SET
        name = ?,
        description = ?,
        price = ?,
        category_limit = ?,
        duration_days = ?,
        is_active = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [
      normalized.name,
      normalized.description,
      normalized.price,
      normalized.categoryLimit,
      normalized.durationDays,
      normalized.isActive ? 1 : 0,
      planId,
    ],
  );

  if (result.affectedRows === 0) {
    throw new SubscriptionPlanError("Plano não encontrado.", 404);
  }

  const [rows] = await db.query<(SubscriptionPlanRow & RowDataPacket)[]>(
    `SELECT * FROM subscription_plans WHERE id = ? LIMIT 1`,
    [planId],
  );

  const planRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!planRow) {
    throw new SubscriptionPlanError("Não foi possível carregar o plano atualizado.", 500);
  }

  return mapPlanRow(planRow);
};

export const deleteSubscriptionPlan = async (planId: number): Promise<void> => {
  if (!Number.isFinite(planId) || planId <= 0) {
    throw new SubscriptionPlanError("Plano inválido.", 404);
  }

  await ensureSubscriptionPlanTable();
  const db = getDb();

  const [result] = await db.query<ResultSetHeader>(
    `DELETE FROM subscription_plans WHERE id = ?`,
    [planId],
  );

  if (result.affectedRows === 0) {
    throw new SubscriptionPlanError("Plano não encontrado.", 404);
  }
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const addDays = (date: Date, days: number): Date => new Date(date.getTime() + days * DAY_IN_MS);

const mapSubscriptionPlan = (row: SubscriptionPlanRow | null): SubscriptionPlan | null => {
  if (!row) {
    return null;
  }

  return mapPlanRow(row);
};

export const getSubscriptionPlanById = async (
  planId: number,
): Promise<SubscriptionPlan | null> => {
  if (!Number.isFinite(planId) || planId <= 0) {
    return null;
  }

  await ensureSubscriptionPlanTable();
  const db = getDb();

  const [rows] = await db.query<(SubscriptionPlanRow & RowDataPacket)[]>(
    `SELECT * FROM subscription_plans WHERE id = ? LIMIT 1`,
    [planId],
  );

  const planRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  return mapSubscriptionPlan(planRow);
};

const mapSubscriptionRow = (
  row: UserPlanSubscriptionRow | null,
  planRow: SubscriptionPlanRow | null,
): UserPlanStatus => {
  if (!row || !planRow) {
    return {
      planId: null,
      plan: null,
      status: "inactive",
      currentPeriodStart: null,
      currentPeriodEnd: null,
      daysRemaining: null,
    } satisfies UserPlanStatus;
  }

  const plan = mapPlanRow(planRow);
  const startIso = row.current_period_start ? row.current_period_start.toISOString() : null;
  const endIso = row.current_period_end ? row.current_period_end.toISOString() : null;

  let status = row.status as UserPlanStatus["status"];
  let daysRemaining: number | null = null;

  if (row.current_period_end) {
    const endDate = new Date(row.current_period_end);
    const now = new Date();

    if (endDate.getTime() >= now.getTime()) {
      const diff = Math.ceil((endDate.getTime() - now.getTime()) / DAY_IN_MS);
      daysRemaining = Math.max(diff, 0);
      if (status === "pending") {
        status = "active";
      }
    } else {
      status = "expired";
      daysRemaining = 0;
    }
  } else if (status === "pending") {
    status = "pending";
  }

  return {
    planId: plan.id,
    plan,
    status,
    currentPeriodStart: startIso,
    currentPeriodEnd: endIso,
    daysRemaining,
  } satisfies UserPlanStatus;
};

export const getUserPlanStatus = async (userId: number): Promise<UserPlanStatus> => {
  await ensureUserPlanSubscriptionTable();
  const db = getDb();

  const [rows] = await db.query<
    (UserPlanSubscriptionRow &
      RowDataPacket & {
        plan_ref_id: number | null;
        plan_name: string | null;
        plan_description: string | null;
        plan_price: string | null;
        plan_category_limit: number | null;
        plan_duration_days: number | null;
        plan_is_active: number | null;
        plan_created_at: Date | string | null;
        plan_updated_at: Date | string | null;
      })
  >(
    `
      SELECT
        ups.*,
        p.id AS plan_ref_id,
        p.name AS plan_name,
        p.description AS plan_description,
        p.price AS plan_price,
        p.category_limit AS plan_category_limit,
        p.duration_days AS plan_duration_days,
        p.is_active AS plan_is_active,
        p.created_at AS plan_created_at,
        p.updated_at AS plan_updated_at
      FROM user_plan_subscriptions ups
      LEFT JOIN subscription_plans p ON p.id = ups.plan_id
      WHERE ups.user_id = ?
      LIMIT 1
    `,
    [userId],
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      planId: null,
      plan: null,
      status: "inactive",
      currentPeriodStart: null,
      currentPeriodEnd: null,
      daysRemaining: null,
    } satisfies UserPlanStatus;
  }

  const row = rows[0];

  let planRow: SubscriptionPlanRow | null = null;
  if (row.plan_ref_id) {
    planRow = {
      id: row.plan_ref_id,
      name: row.plan_name ?? "",
      description: row.plan_description,
      price: row.plan_price ?? "0",
      category_limit: row.plan_category_limit ?? 0,
      duration_days: row.plan_duration_days ?? 30,
      is_active: row.plan_is_active ?? 0,
      created_at: row.plan_created_at instanceof Date
        ? row.plan_created_at
        : new Date(row.plan_created_at ?? new Date()),
      updated_at: row.plan_updated_at instanceof Date
        ? row.plan_updated_at
        : new Date(row.plan_updated_at ?? new Date()),
    };
  }

  const status = mapSubscriptionRow(row, planRow);

  if (status.status === "expired" && row.status !== "expired") {
    await db.query(
      `
        UPDATE user_plan_subscriptions
        SET status = 'expired', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [row.id],
    );
  }

  return status;
};

export const assertUserHasActivePlan = async (
  userId: number,
): Promise<{ status: UserPlanStatus; plan: SubscriptionPlan }> => {
  const status = await getUserPlanStatus(userId);

  if (!status.plan || status.status !== "active" || !status.currentPeriodEnd) {
    throw new SubscriptionPlanError(
      "Você precisa de um plano ativo para utilizar esta funcionalidade.",
      402,
    );
  }

  return { status, plan: status.plan };
};

export const activateUserPlan = async (
  userId: number,
  planId: number,
): Promise<{ status: UserPlanStatus; subscriptionId: number | null }> => {
  const plan = await getSubscriptionPlanById(planId);
  if (!plan) {
    throw new SubscriptionPlanError("Plano não encontrado.", 404);
  }

  if (!plan.isActive) {
    throw new SubscriptionPlanError("Este plano está inativo no momento.");
  }

  await ensureUserPlanSubscriptionTable();
  const db = getDb();

  const [rows] = await db.query<UserPlanSubscriptionRow[]>(
    `SELECT * FROM user_plan_subscriptions WHERE user_id = ? LIMIT 1`,
    [userId],
  );

  const now = new Date();
  let periodStart = now;
  let periodEnd = addDays(now, plan.durationDays);
  const status: UserPlanSubscriptionRow["status"] = "active";

  let subscriptionId: number | null = null;

  if (rows.length > 0) {
    const existing = rows[0];
    subscriptionId = existing.id;
    const existingEnd = existing.current_period_end ? new Date(existing.current_period_end) : null;

    if (existing.plan_id === planId && existingEnd && existingEnd.getTime() > now.getTime()) {
      periodStart = existing.current_period_start ? new Date(existing.current_period_start) : now;
      periodEnd = addDays(existingEnd, plan.durationDays);
    } else {
      periodStart = now;
      periodEnd = addDays(now, plan.durationDays);
    }

    await db.query(
      `
        UPDATE user_plan_subscriptions
        SET
          plan_id = ?,
          status = ?,
          current_period_start = ?,
          current_period_end = ?,
          cancelled_at = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [planId, status, periodStart, periodEnd, existing.id],
    );
  } else {
    const [insertResult] = await db.query<ResultSetHeader>(
      `
        INSERT INTO user_plan_subscriptions (
          user_id,
          plan_id,
          status,
          current_period_start,
          current_period_end
        ) VALUES (?, ?, ?, ?, ?)
      `,
      [userId, planId, status, periodStart, periodEnd],
    );
    subscriptionId = insertResult.insertId;
  }

  const statusSnapshot = await getUserPlanStatus(userId);
  return { status: statusSnapshot, subscriptionId };
};

export const validatePlanCategoryLimit = (
  plan: SubscriptionPlan,
  currentCategories: number,
) => {
  if (plan.categoryLimit > 0 && currentCategories >= plan.categoryLimit) {
    throw new SubscriptionPlanError(
      `Seu plano permite até ${plan.categoryLimit} categorias. Remova alguma ou atualize o plano para continuar.`,
      402,
    );
  }
};
