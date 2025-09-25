import { RowDataPacket } from "mysql2";

import type { AdminSiteSettings, AdminSiteSettingsPayload } from "types/admin-site";

import {
  AdminSiteSettingsRow,
  ensureAdminSiteSettingsTable,
  getDb,
} from "./db";
import { deleteUploadedFile, resolveUploadedFileUrl, saveUploadedFile } from "./uploads";

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
  logoUrl: null,
  supportEmail: null,
  supportPhone: null,
  heroTitle: null,
  heroSubtitle: null,
  heroButtonLabel: null,
  heroButtonUrl: null,
  seoTitle: null,
  seoDescription: null,
  seoImageUrl: null,
  footerText: null,
  updatedAt: null,
};

const MAX_LOGO_SIZE = 5 * 1024 * 1024;
const MAX_SEO_IMAGE_SIZE = 3 * 1024 * 1024;
const LOGO_ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);
const SEO_IMAGE_ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

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

const validateImageFile = (
  file: File,
  maxSize: number,
  allowedMime: Set<string>,
  maxLabel: string,
  formatsHint: string,
) => {
  if (!(file instanceof File)) {
    throw new AdminSiteSettingsError("Arquivo de imagem inválido.");
  }

  if (file.size > maxSize) {
    throw new AdminSiteSettingsError(`Envie imagens de até ${maxLabel}.`);
  }

  if (!allowedMime.has(file.type)) {
    throw new AdminSiteSettingsError(`Envie imagens nos formatos ${formatsHint}.`);
  }
};

const mapRowToSettings = (row: AdminSiteSettingsRow | null): AdminSiteSettings => {
  if (!row) {
    return DEFAULT_SETTINGS;
  }

  return {
    siteName: row.site_name || DEFAULT_SETTINGS.siteName,
    tagline: row.tagline ?? null,
    logoUrl: row.logo_path ? resolveUploadedFileUrl(row.logo_path) : null,
    supportEmail: row.support_email ?? null,
    supportPhone: row.support_phone ?? null,
    heroTitle: row.hero_title ?? null,
    heroSubtitle: row.hero_subtitle ?? null,
    heroButtonLabel: row.hero_button_label ?? null,
    heroButtonUrl: row.hero_button_url ?? null,
    seoTitle: row.seo_title ?? null,
    seoDescription: row.seo_description ?? null,
    seoImageUrl: row.seo_image_path ? resolveUploadedFileUrl(row.seo_image_path) : null,
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

const extractFormPayload = (formData: FormData) => {
  const getOptional = (key: string): string | null => {
    const value = formData.get(key);
    return typeof value === "string" ? value : null;
  };

  const getRequired = (key: string): string => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };

  const logoEntry = formData.get("logo");
  const seoImageEntry = formData.get("seoImage");

  return {
    payload: {
      siteName: getRequired("siteName"),
      tagline: getOptional("tagline"),
      supportEmail: getOptional("supportEmail"),
      supportPhone: getOptional("supportPhone"),
      heroTitle: getOptional("heroTitle"),
      heroSubtitle: getOptional("heroSubtitle"),
      heroButtonLabel: getOptional("heroButtonLabel"),
      heroButtonUrl: getOptional("heroButtonUrl"),
      seoTitle: getOptional("seoTitle"),
      seoDescription: getOptional("seoDescription"),
      footerText: getOptional("footerText"),
    },
    removeLogo: String(formData.get("removeLogo")).toLowerCase() === "true",
    removeSeoImage: String(formData.get("removeSeoImage")).toLowerCase() === "true",
    logoFile: logoEntry instanceof File ? logoEntry : null,
    seoImageFile: seoImageEntry instanceof File ? seoImageEntry : null,
  };
};

export const saveAdminSiteSettingsFromForm = async (
  formData: FormData,
): Promise<AdminSiteSettings> => {
  await ensureAdminSiteSettingsTable();

  const db = getDb();
  const [rows] = await db.query<(AdminSiteSettingsRow & RowDataPacket)[]>(
    "SELECT * FROM admin_site_settings WHERE id = 1 LIMIT 1",
  );
  const existing = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

  const { payload, removeLogo, removeSeoImage, logoFile, seoImageFile } = extractFormPayload(formData);
  const normalized = normalizePayload(payload);

  let nextLogoPath = existing?.logo_path ?? null;
  let nextSeoImagePath = existing?.seo_image_path ?? null;
  let logoToDelete: string | null = null;
  let seoImageToDelete: string | null = null;

  if (removeLogo && nextLogoPath) {
    logoToDelete = nextLogoPath;
    nextLogoPath = null;
  }

  if (removeSeoImage && nextSeoImagePath) {
    seoImageToDelete = nextSeoImagePath;
    nextSeoImagePath = null;
  }

  if (logoFile && logoFile.size > 0) {
    validateImageFile(logoFile, MAX_LOGO_SIZE, LOGO_ALLOWED_MIME, "5 MB", "PNG, JPG, WEBP ou SVG");
    const stored = await saveUploadedFile(logoFile, "admin/site");
    if (!removeLogo && existing?.logo_path) {
      logoToDelete = existing.logo_path;
    }
    nextLogoPath = stored;
  }

  if (seoImageFile && seoImageFile.size > 0) {
    validateImageFile(seoImageFile, MAX_SEO_IMAGE_SIZE, SEO_IMAGE_ALLOWED_MIME, "3 MB", "PNG, JPG ou WEBP");
    const stored = await saveUploadedFile(seoImageFile, "admin/seo");
    if (!removeSeoImage && existing?.seo_image_path) {
      seoImageToDelete = existing.seo_image_path;
    }
    nextSeoImagePath = stored;
  }

  await db.query(
    `
      UPDATE admin_site_settings
      SET
        site_name = ?,
        tagline = ?,
        logo_path = ?,
        seo_image_path = ?,
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
      nextLogoPath,
      nextSeoImagePath,
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

  if (logoToDelete) {
    await deleteUploadedFile(logoToDelete);
  }

  if (seoImageToDelete) {
    await deleteUploadedFile(seoImageToDelete);
  }

  return getAdminSiteSettings();
};
