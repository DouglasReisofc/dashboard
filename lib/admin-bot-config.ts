import { RowDataPacket } from "mysql2";
import sharp from "sharp";

import type { AdminBotConfig } from "types/admin-bot";
import {
  AdminBotConfigRow,
  ensureAdminBotConfigTable,
  getDb,
} from "./db";
import { deleteUploadedFile, resolveUploadedFileUrl, saveUploadedFile } from "./uploads";

const DEFAULT_ADMIN_BOT_CONFIG: AdminBotConfig = {
  menuText:
    "Olá {{user_first_name}},\n\nBem-vindo ao painel rápido do StoreBot pelo WhatsApp. Use os botões abaixo para navegar pelas funções principais.",
  menuFooterText: "Selecione uma opção para continuar.",
  panelButtonText: "Painel",
  subscriptionButtonText: "Assinatura",
  supportButtonText: "Suporte",
  menuImageUrl: null,
  menuImagePath: null,
  subscriptionHeaderText: "Resumo do plano",
  subscriptionBodyText:
    "Plano: {{plan_name}}\nStatus: {{plan_status}}\nValor: {{plan_price}}\nVencimento: {{plan_renews_at}}",
  subscriptionFooterText: "Escolha uma ação para gerenciar sua assinatura.",
  subscriptionRenewButtonText: "Renovar",
  subscriptionChangeButtonText: "Mudar plano",
  subscriptionDetailsButtonText: "Ver detalhes",
  subscriptionNoPlanHeaderText: "Você ainda não possui um plano ativo.",
  subscriptionNoPlanBodyText:
    "Escolha a melhor opção para iniciar sua assinatura do StoreBot e liberar todos os recursos.",
  subscriptionNoPlanButtonText: "Assinar plano",
  subscriptionPlanListTitle: "Planos disponíveis",
  subscriptionPlanListBody:
    "Selecione um dos planos abaixo para gerar o pagamento imediatamente.",
  subscriptionPlanListButtonText: "Escolher",
  subscriptionPlanListFooterText:
    "Após selecionar um plano enviaremos o link de pagamento automaticamente.",
};

const mapRowToConfig = (row: AdminBotConfigRow | null): AdminBotConfig => {
  if (!row) {
    return DEFAULT_ADMIN_BOT_CONFIG;
  }

  return {
    menuText: row.menu_text ?? DEFAULT_ADMIN_BOT_CONFIG.menuText,
    menuFooterText: row.menu_footer_text ?? DEFAULT_ADMIN_BOT_CONFIG.menuFooterText,
    panelButtonText: row.panel_button_text ?? DEFAULT_ADMIN_BOT_CONFIG.panelButtonText,
    subscriptionButtonText: row.subscription_button_text ?? DEFAULT_ADMIN_BOT_CONFIG.subscriptionButtonText,
    supportButtonText: row.support_button_text ?? DEFAULT_ADMIN_BOT_CONFIG.supportButtonText,
    menuImageUrl: row.menu_image_path ? resolveUploadedFileUrl(row.menu_image_path) : null,
    menuImagePath: row.menu_image_path ?? null,
    subscriptionHeaderText: row.subscription_header_text ?? DEFAULT_ADMIN_BOT_CONFIG.subscriptionHeaderText,
    subscriptionBodyText: row.subscription_body_text ?? DEFAULT_ADMIN_BOT_CONFIG.subscriptionBodyText,
    subscriptionFooterText: row.subscription_footer_text ?? DEFAULT_ADMIN_BOT_CONFIG.subscriptionFooterText,
    subscriptionRenewButtonText:
      row.subscription_renew_button_text ?? DEFAULT_ADMIN_BOT_CONFIG.subscriptionRenewButtonText,
    subscriptionChangeButtonText:
      row.subscription_change_button_text ?? DEFAULT_ADMIN_BOT_CONFIG.subscriptionChangeButtonText,
    subscriptionDetailsButtonText:
      row.subscription_details_button_text ?? DEFAULT_ADMIN_BOT_CONFIG.subscriptionDetailsButtonText,
    subscriptionNoPlanHeaderText:
      row.subscription_no_plan_header_text ?? DEFAULT_ADMIN_BOT_CONFIG.subscriptionNoPlanHeaderText,
    subscriptionNoPlanBodyText:
      row.subscription_no_plan_body_text ?? DEFAULT_ADMIN_BOT_CONFIG.subscriptionNoPlanBodyText,
    subscriptionNoPlanButtonText:
      row.subscription_no_plan_button_text ?? DEFAULT_ADMIN_BOT_CONFIG.subscriptionNoPlanButtonText,
    subscriptionPlanListTitle:
      row.subscription_plan_list_title ?? DEFAULT_ADMIN_BOT_CONFIG.subscriptionPlanListTitle,
    subscriptionPlanListBody:
      row.subscription_plan_list_body ?? DEFAULT_ADMIN_BOT_CONFIG.subscriptionPlanListBody,
    subscriptionPlanListButtonText:
      row.subscription_plan_list_button_text ?? DEFAULT_ADMIN_BOT_CONFIG.subscriptionPlanListButtonText,
    subscriptionPlanListFooterText:
      row.subscription_plan_list_footer_text ?? DEFAULT_ADMIN_BOT_CONFIG.subscriptionPlanListFooterText,
  } satisfies AdminBotConfig;
};

const sanitizeText = (value: FormDataEntryValue | null, maxLength: number, fallback = "") => {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  if (trimmed.length > maxLength) {
    return trimmed.slice(0, maxLength);
  }

  return trimmed;
};

const sanitizeOptionalText = (value: FormDataEntryValue | null, maxLength: number) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
};

const sanitizeLongText = (value: FormDataEntryValue | null, fallback: string) => {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed;
};

const ensureMenuImageFile = async (file: File): Promise<File> => {
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Arquivo de imagem inválido.");
  }

  const mime = (file.type || "").toLowerCase();
  if (mime === "image/png" || mime === "image/jpeg") {
    return file;
  }

  if (mime === "image/webp") {
    const baseName = file.name.replace(/\.[^.]+$/, "") || "menu-image";
    const buffer = Buffer.from(await file.arrayBuffer());
    const converted = await sharp(buffer).jpeg({ quality: 90 }).toBuffer();
    return new File([converted], `${baseName}.jpg`, { type: "image/jpeg" });
  }

  throw new Error("Formato de imagem não suportado. Use PNG ou JPG.");
};

export const getAdminBotConfig = async (): Promise<AdminBotConfig> => {
  await ensureAdminBotConfigTable();
  const db = getDb();

  const [rows] = await db.query<(AdminBotConfigRow & RowDataPacket)[]>(
    `SELECT * FROM admin_bot_config WHERE id = 1 LIMIT 1`,
  );

  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  return mapRowToConfig(row);
};

export const saveAdminBotConfigFromForm = async (formData: FormData): Promise<AdminBotConfig> => {
  await ensureAdminBotConfigTable();
  const db = getDb();

  const [rows] = await db.query<(AdminBotConfigRow & RowDataPacket)[]>(
    `SELECT * FROM admin_bot_config WHERE id = 1 LIMIT 1`,
  );
  const existing = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

  const menuText = sanitizeLongText(formData.get("menuText"), DEFAULT_ADMIN_BOT_CONFIG.menuText);
  const menuFooterText = sanitizeOptionalText(formData.get("menuFooterText"), 255);
  const panelButtonText = sanitizeText(
    formData.get("panelButtonText"),
    60,
    DEFAULT_ADMIN_BOT_CONFIG.panelButtonText,
  );
  const subscriptionButtonText = sanitizeText(
    formData.get("subscriptionButtonText"),
    60,
    DEFAULT_ADMIN_BOT_CONFIG.subscriptionButtonText,
  );
  const supportButtonText = sanitizeText(
    formData.get("supportButtonText"),
    60,
    DEFAULT_ADMIN_BOT_CONFIG.supportButtonText,
  );

  const subscriptionHeaderText = sanitizeText(
    formData.get("subscriptionHeaderText"),
    160,
    DEFAULT_ADMIN_BOT_CONFIG.subscriptionHeaderText,
  );
  const subscriptionBodyText = sanitizeLongText(
    formData.get("subscriptionBodyText"),
    DEFAULT_ADMIN_BOT_CONFIG.subscriptionBodyText,
  );
  const subscriptionFooterText = sanitizeOptionalText(formData.get("subscriptionFooterText"), 255);
  const subscriptionRenewButtonText = sanitizeText(
    formData.get("subscriptionRenewButtonText"),
    60,
    DEFAULT_ADMIN_BOT_CONFIG.subscriptionRenewButtonText,
  );
  const subscriptionChangeButtonText = sanitizeText(
    formData.get("subscriptionChangeButtonText"),
    60,
    DEFAULT_ADMIN_BOT_CONFIG.subscriptionChangeButtonText,
  );
  const subscriptionDetailsButtonText = sanitizeText(
    formData.get("subscriptionDetailsButtonText"),
    60,
    DEFAULT_ADMIN_BOT_CONFIG.subscriptionDetailsButtonText,
  );

  const subscriptionNoPlanHeaderText = sanitizeText(
    formData.get("subscriptionNoPlanHeaderText"),
    160,
    DEFAULT_ADMIN_BOT_CONFIG.subscriptionNoPlanHeaderText,
  );
  const subscriptionNoPlanBodyText = sanitizeLongText(
    formData.get("subscriptionNoPlanBodyText"),
    DEFAULT_ADMIN_BOT_CONFIG.subscriptionNoPlanBodyText,
  );
  const subscriptionNoPlanButtonText = sanitizeText(
    formData.get("subscriptionNoPlanButtonText"),
    60,
    DEFAULT_ADMIN_BOT_CONFIG.subscriptionNoPlanButtonText,
  );

  const subscriptionPlanListTitle = sanitizeText(
    formData.get("subscriptionPlanListTitle"),
    60,
    DEFAULT_ADMIN_BOT_CONFIG.subscriptionPlanListTitle,
  );
  const subscriptionPlanListBody = sanitizeLongText(
    formData.get("subscriptionPlanListBody"),
    DEFAULT_ADMIN_BOT_CONFIG.subscriptionPlanListBody,
  );
  const subscriptionPlanListButtonText = sanitizeText(
    formData.get("subscriptionPlanListButtonText"),
    60,
    DEFAULT_ADMIN_BOT_CONFIG.subscriptionPlanListButtonText,
  );
  const subscriptionPlanListFooterText = sanitizeOptionalText(
    formData.get("subscriptionPlanListFooterText"),
    255,
  );

  const removeImage = String(formData.get("removeMenuImage") ?? "").toLowerCase() === "true";
  const rawImage = formData.get("menuImage");
  const imageFile = rawImage instanceof File ? await ensureMenuImageFile(rawImage) : null;

  let nextImagePath = existing?.menu_image_path ?? null;
  let imageToDelete: string | null = null;

  if (removeImage && nextImagePath) {
    imageToDelete = nextImagePath;
    nextImagePath = null;
  }

  if (imageFile && imageFile.size > 0) {
    const storedPath = await saveUploadedFile(imageFile, "admin/bot", { convertToWebp: false });
    if (!removeImage && existing?.menu_image_path) {
      imageToDelete = existing.menu_image_path;
    }
    nextImagePath = storedPath;
  }

  await db.query(
    `
      UPDATE admin_bot_config
      SET
        menu_text = ?,
        menu_footer_text = ?,
        panel_button_text = ?,
        subscription_button_text = ?,
        support_button_text = ?,
        menu_image_path = ?,
        subscription_header_text = ?,
        subscription_body_text = ?,
        subscription_footer_text = ?,
        subscription_renew_button_text = ?,
        subscription_change_button_text = ?,
        subscription_details_button_text = ?,
        subscription_no_plan_header_text = ?,
        subscription_no_plan_body_text = ?,
        subscription_no_plan_button_text = ?,
        subscription_plan_list_title = ?,
        subscription_plan_list_body = ?,
        subscription_plan_list_button_text = ?,
        subscription_plan_list_footer_text = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `,
    [
      menuText,
      menuFooterText,
      panelButtonText,
      subscriptionButtonText,
      supportButtonText,
      nextImagePath,
      subscriptionHeaderText,
      subscriptionBodyText,
      subscriptionFooterText,
      subscriptionRenewButtonText,
      subscriptionChangeButtonText,
      subscriptionDetailsButtonText,
      subscriptionNoPlanHeaderText,
      subscriptionNoPlanBodyText,
      subscriptionNoPlanButtonText,
      subscriptionPlanListTitle,
      subscriptionPlanListBody,
      subscriptionPlanListButtonText,
      subscriptionPlanListFooterText,
    ],
  );

  if (imageToDelete && imageToDelete !== nextImagePath) {
    await deleteUploadedFile(imageToDelete).catch((error) => {
      console.error("Failed to remove previous admin bot image", error);
    });
  }

  return getAdminBotConfig();
};

export const getDefaultAdminBotConfig = (): AdminBotConfig => DEFAULT_ADMIN_BOT_CONFIG;
