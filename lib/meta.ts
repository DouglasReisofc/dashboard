import type { UserWebhookRow } from "./db";

const getAppBaseUrl = () => {
  const rawUrl = process.env.APP_URL?.trim();
  if (!rawUrl) {
    return "http://localhost:4478";
  }

  return rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
};

const resolveMediaUrl = (relativePath: string) => {
  const normalized = relativePath.replace(/^\/+/, "");
  return `${getAppBaseUrl()}/${normalized}`;
};

const getMetaApiVersion = () => process.env.META_API_VERSION?.trim() || "v19.0";

const buildTextPayload = (to: string, text: string) => ({
  messaging_product: "whatsapp",
  to,
  type: "text" as const,
  text: {
    preview_url: false,
    body: text,
  },
});

const buildImagePayload = (to: string, mediaUrl: string, caption: string) => ({
  messaging_product: "whatsapp",
  to,
  type: "image" as const,
  image: {
    link: mediaUrl,
    caption,
  },
});

export const sendBotMenuReply = async (options: {
  webhook: UserWebhookRow;
  to: string;
  text: string;
  imagePath?: string | null;
}) => {
  const { webhook, to, text, imagePath } = options;

  if (!webhook.access_token || !webhook.phone_number_id) {
    console.warn(
      "[Meta Webhook] Ignorando envio de menu: webhook sem phone_number_id ou access_token configurado",
    );
    return;
  }

  if (!text.trim()) {
    console.warn("[Meta Webhook] Mensagem de menu vazia, nada será enviado");
    return;
  }

  const version = getMetaApiVersion();
  const url = `https://graph.facebook.com/${version}/${webhook.phone_number_id}/messages`;

  const payload = imagePath
    ? buildImagePayload(to, resolveMediaUrl(imagePath), text)
    : buildTextPayload(to, text);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${webhook.access_token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(
        `[Meta Webhook] Falha ao enviar menu para ${to}: ${response.status} ${response.statusText}`,
        errorText,
      );
      return;
    }

    console.info(`[Meta Webhook] Menu automático enviado para ${to}`);
  } catch (error) {
    console.error("[Meta Webhook] Erro ao enviar menu automático", error);
  }
};
