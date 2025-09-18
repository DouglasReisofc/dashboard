import { RowDataPacket } from "mysql2";

import type { AdminSiteSettings, AdminSiteSettingsPayload } from "types/admin-site";

import {
  AdminSiteSettingsRow,
  ensureAdminSiteSettingsTable,
  getDb,
} from "./db";

export class AdminSiteSettingsError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AdminSiteSettingsError";
    this.status = status;
  }
}

const DEFAULT_SETTINGS: AdminSiteSettings = {
  siteName: "StoreBot",
  tagline: null,
  supportEmail: null,
  supportPhone: null,
  heroTitle: null,
  heroSubtitle: null,
  heroButtonLabel: null,
  heroButtonUrl: null,
  seoTitle: null,
  seoDescription: null,
  footerText: null,
  updatedAt: null,
};

const sanitizeText = (value: unknown, maxLength: number): string => {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.slice(0, maxLength);
};

const sanitizeOptionalText = (value: unknown, maxLength: number): string | null => {
  const sanitized = sanitizeText(value, maxLength);
  return sanitized ? sanitized : null;
};

const sanitizeRequiredText = (
  value: unknown,
  maxLength: number,
  label: string,
): string => {
  const sanitized = sanitizeText(value, maxLength);
  if (!sanitized) {
    throw new AdminSiteSettingsError(`Informe ${label}.`);
  }

  return sanitized;
};

const sanitizeEmail = (value: unknown): string | null => {
  const sanitized = sanitizeOptionalText(value, 160);
  if (!sanitized) {
    return null;
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(sanitized)) {
    throw new AdminSiteSettingsError("Informe um e-mail válido.");
  }

  return sanitized;
};

const sanitizePhone = (value: unknown): string | null => {
  const sanitized = sanitizeOptionalText(value, 40);
  if (!sanitized) {
    return null;
  }

  const digits = sanitized.replace(/\D/g, "");
  if (digits.length < 8) {
    throw new AdminSiteSettingsError("Informe um telefone válido com DDD.");
  }

  return sanitized;
};

const sanitizeUrl = (value: unknown): string | null => {
  const sanitized = sanitizeOptionalText(value, 300);
  if (!sanitized) {
    return null;
  }

  try {
    const url = new URL(sanitized);
    if (!/^https?:$/i.test(url.protocol)) {
      throw new Error("Invalid protocol");
    }
  } catch {
    throw new AdminSiteSettingsError("Informe uma URL válida iniciando com http ou https.");
  }

  return sanitized;
};

const mapRowToSettings = (row: AdminSiteSettingsRow | null): AdminSiteSettings => {
  if (!row) {
    return DEFAULT_SETTINGS;
  }

  return {
    siteName: row.site_name || DEFAULT_SETTINGS.siteName,
    tagline: row.tagline ?? null,
    supportEmail: row.support_email ?? null,
    supportPhone: row.support_phone ?? null,
    heroTitle: row.hero_title ?? null,
    heroSubtitle: row.hero_subtitle ?? null,
    heroButtonLabel: row.hero_button_label ?? null,
    heroButtonUrl: row.hero_button_url ?? null,
    seoTitle: row.seo_title ?? null,
    seoDescription: row.seo_description ?? null,
    footerText: row.footer_text ?? null,
    updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
  };
};

export const getAdminSiteSettings = async (): Promise<AdminSiteSettings> => {
  await ensureAdminSiteSettingsTable();

  const db = getDb();
  const [rows] = await db.query<(AdminSiteSettingsRow & RowDataPacket)[]>(
    "SELECT * FROM admin_site_settings WHERE id = 1 LIMIT 1",
  );

  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  return mapRowToSettings(row);
};

const normalizePayload = (payload: AdminSiteSettingsPayload): AdminSiteSettingsPayload => {
  const siteName = sanitizeRequiredText(payload.siteName, 120, "o nome do site");
  const tagline = sanitizeOptionalText(payload.tagline, 160);
  const supportEmail = sanitizeEmail(payload.supportEmail);
  const supportPhone = sanitizePhone(payload.supportPhone);
  const heroTitle = sanitizeOptionalText(payload.heroTitle, 160);
  const heroSubtitle = sanitizeOptionalText(payload.heroSubtitle, 240);
  const heroButtonLabel = sanitizeOptionalText(payload.heroButtonLabel, 60);
  const heroButtonUrl = sanitizeUrl(payload.heroButtonUrl);
  const seoTitle = sanitizeOptionalText(payload.seoTitle, 160);
  const seoDescription = sanitizeOptionalText(payload.seoDescription, 320);
  const footerText = sanitizeOptionalText(payload.footerText, 600);

  if (heroButtonUrl && !heroButtonLabel) {
    throw new AdminSiteSettingsError("Informe o texto do botão principal.");
  }

  if (heroButtonLabel && !heroButtonUrl) {
    throw new AdminSiteSettingsError("Informe a URL que será aberta pelo botão principal.");
  }

  return {
    siteName,
    tagline,
    supportEmail,
    supportPhone,
    heroTitle,
    heroSubtitle,
    heroButtonLabel,
    heroButtonUrl,
    seoTitle,
    seoDescription,
    footerText,
  };
};

const parsePayload = (input: unknown): AdminSiteSettingsPayload => {
  if (!input || typeof input !== "object") {
    throw new AdminSiteSettingsError("Payload inválido.");
  }

  const value = input as Partial<AdminSiteSettingsPayload>;

  return {
    siteName: value.siteName ?? "",
    tagline: value.tagline ?? null,
    supportEmail: value.supportEmail ?? null,
    supportPhone: value.supportPhone ?? null,
    heroTitle: value.heroTitle ?? null,
    heroSubtitle: value.heroSubtitle ?? null,
    heroButtonLabel: value.heroButtonLabel ?? null,
    heroButtonUrl: value.heroButtonUrl ?? null,
    seoTitle: value.seoTitle ?? null,
    seoDescription: value.seoDescription ?? null,
    footerText: value.footerText ?? null,
  };
};

export const saveAdminSiteSettings = async (
  payload: AdminSiteSettingsPayload,
): Promise<AdminSiteSettings> => {
  await ensureAdminSiteSettingsTable();

  const normalized = normalizePayload(payload);
  const db = getDb();

  await db.query(
    `
      UPDATE admin_site_settings
      SET
        site_name = ?,
        tagline = ?,
        support_email = ?,
        support_phone = ?,
        hero_title = ?,
        hero_subtitle = ?,
        hero_button_label = ?,
        hero_button_url = ?,
        seo_title = ?,
        seo_description = ?,
        footer_text = ?
      WHERE id = 1
    `,
    [
      normalized.siteName,
      normalized.tagline,
      normalized.supportEmail,
      normalized.supportPhone,
      normalized.heroTitle,
      normalized.heroSubtitle,
      normalized.heroButtonLabel,
      normalized.heroButtonUrl,
      normalized.seoTitle,
      normalized.seoDescription,
      normalized.footerText,
    ],
  );

  return getAdminSiteSettings();
};

export const saveAdminSiteSettingsFromUnknown = async (
  payload: unknown,
): Promise<AdminSiteSettings> => {
  const parsed = parsePayload(payload);
  return saveAdminSiteSettings(parsed);
};
