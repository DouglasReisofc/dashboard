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

type ButtonDefinition = {
  id: string;
  title: string;
};

const DEFAULT_MENU_BUTTONS: ButtonDefinition[] = [
  { id: "storebot_ver_catalogo", title: "Ver catálogo" },
  { id: "storebot_ver_categorias", title: "Ver categorias" },
  { id: "storebot_falar_atendente", title: "Falar com atendente" },
];

const MAX_BODY_LENGTH = 1024;

const buildInteractiveMenuPayload = (
  to: string,
  text: string,
  mediaUrl?: string | null,
) => {
  const trimmedText = text.trim();
  const bodyText = trimmedText.length > MAX_BODY_LENGTH
    ? `${trimmedText.slice(0, MAX_BODY_LENGTH - 1)}…`
    : trimmedText;

  const buttonsPayload = DEFAULT_MENU_BUTTONS.map((button) => ({
    type: "reply" as const,
    reply: {
      id: button.id,
      title: button.title,
    },
  }));

  const interactive: Record<string, unknown> = {
    type: "button",
    body: {
      text: bodyText,
    },
    footer: {
      text: "Selecione uma opção para continuar.",
    },
    action: {
      buttons: buttonsPayload,
    },
  };

  if (mediaUrl) {
    interactive.header = {
      type: "image",
      image: {
        link: mediaUrl,
      },
    };
  }

  return {
    messaging_product: "whatsapp" as const,
    to,
    type: "interactive" as const,
    interactive,
  };
};

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

  const payload = buildInteractiveMenuPayload(
    to,
    text,
    imagePath ? resolveMediaUrl(imagePath) : null,
  );

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
