import { NextResponse } from "next/server";
import crypto from "crypto";
import path from "path";
import { promises as fs } from "fs";
import sharp from "sharp";

import { getCurrentUser } from "lib/auth";
import { getDb } from "lib/db";
import {
  getMinutesLeftIn24hWindow,
  recordSupportMessage,
  buildSupportThreadSummary,
  serializeSupportMessage,
} from "lib/support";
import {
  sendMediaMessage,
  sendTextMessage,
  sendInteractiveReplyButtonsMessage,
  sendInteractiveCtaUrlMessage,
  getAppBaseUrl,
} from "lib/meta";
import { resolveUploadedFileUrl, UPLOADS_STORAGE_ROOT } from "lib/uploads";
import { emitSupportMessageEvent, emitSupportThreadUpdate } from "lib/realtime";

type InteractiveButton = {
  id: string;
  title: string;
};

const inferMediaType = (inputType: string, fallback: string):
  | "image"
  | "video"
  | "audio"
  | "document"
  | "sticker" => {
  const normalized = inputType.toLowerCase();
  if (normalized.startsWith("image")) return "image";
  if (normalized.startsWith("video")) return "video";
  if (normalized.startsWith("audio")) return "audio";
  if (normalized === "sticker") return "sticker";
  if (normalized === "document") return "document";
  if (fallback === "image/webp") return "image";
  if (fallback.startsWith("image/")) return "image";
  if (fallback.startsWith("video/")) return "video";
  if (fallback.startsWith("audio/")) return "audio";
  return "document";
};

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return NextResponse.json(
        { message: "Conteúdo inválido. Envie os dados via multipart/form-data." },
        { status: 400 },
      );
    }

    const formData = await request.formData();
    const to = (formData.get("to") || "").toString().trim();
    if (!to) {
      return NextResponse.json({ message: "Informe o destinatário." }, { status: 400 });
    }

    const mode = (formData.get("mode") || "text").toString();
    const text = (formData.get("text") || "").toString().trim();

    if (mode === "text" && !text) {
      return NextResponse.json({ message: "Digite a mensagem de texto." }, { status: 400 });
    }

    const { within24h } = await getMinutesLeftIn24hWindow(user.id, to);
    if (!within24h) {
      return NextResponse.json(
        { message: "A janela de 24 horas expirou. Peça ao cliente que envie uma nova mensagem." },
        { status: 409 },
      );
    }

    const db = getDb();
    const [webhookRows] = await db.query<
      Array<{ phone_number_id: string | null; access_token: string | null }>
    >(
      "SELECT phone_number_id, access_token FROM user_webhooks WHERE user_id = ? LIMIT 1",
      [user.id],
    );
    const webhookRow = Array.isArray(webhookRows) && webhookRows.length ? webhookRows[0] : null;
    const phoneNumberId = webhookRow?.phone_number_id?.trim() || "";
    const accessToken = webhookRow?.access_token?.trim() || "";
    if (!phoneNumberId || !accessToken) {
      return NextResponse.json(
        { message: "Configure o Phone Number ID e Access Token na aba Webhook." },
        { status: 400 },
      );
    }

    const webhook = { phone_number_id: phoneNumberId, access_token: accessToken };

    if (mode === "media") {
      const file = formData.get("file");
      if (!(file instanceof File) || file.size === 0) {
        return NextResponse.json({ message: "Envie um arquivo válido." }, { status: 400 });
      }
      const explicitType = (formData.get("mediaType") || "").toString();
      const mediaType = inferMediaType(explicitType, file.type);
      const caption = (formData.get("caption") || "").toString().trim() || null;

      if (mediaType === "image" && !file.type.startsWith("image/")) {
        return NextResponse.json({ message: "Envie um arquivo de imagem válido." }, { status: 400 });
      }

      const baseBuffer = Buffer.from(await file.arrayBuffer());
      let workingBuffer = baseBuffer;
      let mimeType = typeof file.type === "string" && file.type.trim() ? file.type.trim() : "";
      let effectiveMediaType = mediaType;
      let filename = file.name && file.name.trim() ? file.name.trim() : `media-${Date.now()}`;

      if (mediaType === "image") {
        if (mimeType === "image/webp") {
          workingBuffer = await sharp(workingBuffer).jpeg({ quality: 88 }).toBuffer();
          mimeType = "image/jpeg";
          filename = filename.replace(/\.webp$/i, ".jpg");
        } else if (mimeType && !mimeType.startsWith("image/")) {
          return NextResponse.json({ message: "Formato de imagem não suportado." }, { status: 400 });
        }
      }

      if (mediaType === "sticker" && mimeType !== "image/webp") {
        effectiveMediaType = "image";
      }

      const storageRoot = path.resolve(UPLOADS_STORAGE_ROOT, "support");
      await fs.mkdir(storageRoot, { recursive: true });
      const extension = (() => {
        const ext = path.extname(filename).toLowerCase();
        if (ext) {
          return ext;
        }
        if (mimeType === "image/jpeg") return ".jpg";
        if (mimeType === "image/png") return ".png";
        if (mimeType === "image/webp") return ".webp";
        if (mimeType === "application/pdf") return ".pdf";
        return "";
      })();
      const uniqueName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${extension}`;
      const absoluteDiskPath = path.join(storageRoot, uniqueName);
      await fs.writeFile(absoluteDiskPath, workingBuffer);

      const relativePath = path.posix.join("uploads", "support", uniqueName);
      const publicPath = resolveUploadedFileUrl(relativePath).replace(/^\/+/, "");
      const baseUrl = getAppBaseUrl();
      const absoluteUrl = new URL(publicPath, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
      try {
        await sendMediaMessage({
          webhook,
          to,
          mediaType: effectiveMediaType,
          mediaUrl: absoluteUrl,
          caption,
          filename: effectiveMediaType === "document" ? filename : undefined,
        });

        const { message, thread } = await recordSupportMessage({
          userId: user.id,
          whatsappId: to,
          direction: "outbound",
          messageType: effectiveMediaType,
          text: caption,
          payload: {
            mediaType: effectiveMediaType,
            mimeType,
            filename: uniqueName,
            storagePath: relativePath,
            mediaUrl: absoluteUrl,
            caption,
          },
        });

        const serializedMessage = serializeSupportMessage(message);
        const summary = await buildSupportThreadSummary(user.id, thread);
        emitSupportMessageEvent({
          userId: user.id,
          whatsappId: thread.whatsappId,
          message: serializedMessage,
        });
        emitSupportThreadUpdate({ userId: user.id, thread: summary });

        return NextResponse.json({ ok: true, message: serializedMessage, thread: summary });
      } catch (error) {
        await fs.unlink(absoluteDiskPath).catch(() => {});
        throw error;
      }
    }

    if (mode === "interactive") {
      const interactiveType = (formData.get("interactiveType") || "").toString();
      if (interactiveType === "buttons") {
        const bodyText = (formData.get("bodyText") || "").toString();
        const footerText = (formData.get("footerText") || "").toString();
        const headerText = (formData.get("headerText") || "").toString();
        const buttonsRaw = formData.get("buttons");
        let buttons: InteractiveButton[] = [];
        try {
          buttons = JSON.parse((buttonsRaw || "[]").toString()) as InteractiveButton[];
        } catch {
          buttons = [];
        }

        if (!buttons.length) {
          return NextResponse.json({ message: "Informe ao menos um botão." }, { status: 400 });
        }

        await sendInteractiveReplyButtonsMessage({
          webhook,
          to,
          bodyText,
          buttons,
          footerText,
          headerText,
        });

        const { message, thread } = await recordSupportMessage({
          userId: user.id,
          whatsappId: to,
          direction: "outbound",
          messageType: "interactive",
          text: bodyText,
          payload: {
            interactiveType,
            buttons,
            footerText,
            headerText,
          },
        });

        const serializedMessage = serializeSupportMessage(message);
        const summary = await buildSupportThreadSummary(user.id, thread);
        emitSupportMessageEvent({
          userId: user.id,
          whatsappId: thread.whatsappId,
          message: serializedMessage,
        });
        emitSupportThreadUpdate({ userId: user.id, thread: summary });

        return NextResponse.json({ ok: true, message: serializedMessage, thread: summary });
      }

      if (interactiveType === "cta_url") {
        const bodyText = (formData.get("bodyText") || "").toString();
        const footerText = (formData.get("footerText") || "").toString();
        const buttonText = (formData.get("buttonText") || "").toString();
        const buttonUrl = (formData.get("buttonUrl") || "").toString();
        const headerText = (formData.get("headerText") || "").toString();
        await sendInteractiveCtaUrlMessage({
          webhook,
          to,
          bodyText,
          buttonText,
          buttonUrl,
          headerText,
          footerText,
        });

        const { message, thread } = await recordSupportMessage({
          userId: user.id,
          whatsappId: to,
          direction: "outbound",
          messageType: "interactive",
          text: bodyText,
          payload: {
            interactiveType,
            buttonText,
            buttonUrl,
            footerText,
            headerText,
          },
        });

        const serializedMessage = serializeSupportMessage(message);
        const summary = await buildSupportThreadSummary(user.id, thread);
        emitSupportMessageEvent({
          userId: user.id,
          whatsappId: thread.whatsappId,
          message: serializedMessage,
        });
        emitSupportThreadUpdate({ userId: user.id, thread: summary });

        return NextResponse.json({ ok: true, message: serializedMessage, thread: summary });
      }

      return NextResponse.json({ message: "Tipo interativo inválido." }, { status: 400 });
    }

    // default text
    await sendTextMessage({ webhook, to, text });

    const { message, thread } = await recordSupportMessage({
      userId: user.id,
      whatsappId: to,
      direction: "outbound",
      messageType: "text",
      text,
    });
    const serializedMessage = serializeSupportMessage(message);
    const summary = await buildSupportThreadSummary(user.id, thread);
    emitSupportMessageEvent({
      userId: user.id,
      whatsappId: thread.whatsappId,
      message: serializedMessage,
    });
    emitSupportThreadUpdate({ userId: user.id, thread: summary });

    return NextResponse.json({ ok: true, message: serializedMessage, thread: summary });
  } catch (error) {
    console.error("Failed to send support message", error);
    return NextResponse.json({ message: "Erro ao enviar mensagem." }, { status: 500 });
  }
}
