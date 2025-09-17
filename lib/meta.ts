import type { UserWebhookRow } from "./db";
import { formatCurrency } from "./format";

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

export const MENU_BUTTON_IDS = {
  buy: "storebot_menu_buy",
  addBalance: "storebot_menu_add_balance",
  support: "storebot_menu_support",
} as const;

export const CATEGORY_LIST_ROW_PREFIX = "storebot_category_";
export const CATEGORY_LIST_NEXT_PREFIX = "storebot_list_next_";

type ButtonDefinition = {
  id: string;
  title: string;
};

const DEFAULT_MENU_BUTTONS: ButtonDefinition[] = [
  { id: MENU_BUTTON_IDS.buy, title: "Comprar contas" },
  { id: MENU_BUTTON_IDS.addBalance, title: "Adicionar saldo" },
  { id: MENU_BUTTON_IDS.support, title: "Suporte" },
];

const MAX_BODY_LENGTH = 1024;
const MAX_LIST_ROWS = 10;

type MetaMessagePayload = {
  messaging_product: "whatsapp";
  to: string;
} & Record<string, unknown>;

const postMetaMessage = async (
  webhook: UserWebhookRow,
  payload: MetaMessagePayload,
  context: { successLog: string; failureLog: string },
) => {
  if (!webhook.access_token || !webhook.phone_number_id) {
    console.warn(
      `[Meta Webhook] ${context.failureLog}: webhook sem phone_number_id ou access_token configurado`,
    );
    return false;
  }

  const version = getMetaApiVersion();
  const url = `https://graph.facebook.com/${version}/${webhook.phone_number_id}/messages`;

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
        `[Meta Webhook] ${context.failureLog}: ${response.status} ${response.statusText}`,
        errorText,
      );
      return false;
    }

    console.info(`[Meta Webhook] ${context.successLog}`);
    return true;
  } catch (error) {
    console.error(`[Meta Webhook] ${context.failureLog}`, error);
    return false;
  }
};

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
      text: "Selecione uma das opções para continuar seu atendimento.",
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

type CategoryListEntry = {
  id: number;
  name: string;
  price: number;
};

const buildCategoryListPayload = (
  to: string,
  categories: CategoryListEntry[],
  page: number,
) => {
  const totalPages = Math.max(1, Math.ceil(categories.length / MAX_LIST_ROWS));
  const sanitizedPage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (sanitizedPage - 1) * MAX_LIST_ROWS;
  const remaining = categories.length - startIndex;
  const hasMore = remaining > MAX_LIST_ROWS;
  const maxRowsForPage = hasMore ? MAX_LIST_ROWS - 1 : MAX_LIST_ROWS;
  const pageEntries = categories.slice(startIndex, startIndex + maxRowsForPage);

  const rows = pageEntries.map((category) => ({
    id: `${CATEGORY_LIST_ROW_PREFIX}${category.id}`,
    title: category.name,
    description: formatCurrency(category.price),
  }));

  if (hasMore) {
    rows.push({
      id: `${CATEGORY_LIST_NEXT_PREFIX}${sanitizedPage + 1}`,
      title: "Próxima lista ▶️",
      description: `Ver mais categorias (${sanitizedPage + 1}/${totalPages})`,
    });
  }

  const footerText = hasMore
    ? "Role até o fim e toque em \"Próxima lista\" para visualizar mais categorias."
    : "Selecione a categoria desejada para continuar sua compra.";

  return {
    payload: {
      messaging_product: "whatsapp" as const,
      to,
      type: "interactive" as const,
      interactive: {
        type: "list" as const,
        header: {
          type: "text" as const,
          text: "Comprar contas",
        },
        body: {
          text: `Selecione a categoria desejada (${sanitizedPage}/${totalPages}).`,
        },
        footer: {
          text: footerText,
        },
        action: {
          button: "Ver categorias",
          sections: [
            {
              title: `Página ${sanitizedPage}/${totalPages}`,
              rows,
            },
          ],
        },
      },
    },
    page: sanitizedPage,
    totalPages,
  };
};

export const sendBotMenuReply = async (options: {
  webhook: UserWebhookRow;
  to: string;
  text: string;
  imagePath?: string | null;
}) => {
  const { webhook, to, text, imagePath } = options;

  if (!text.trim()) {
    console.warn("[Meta Webhook] Mensagem de menu vazia, nada será enviada");
    return;
  }

  const payload = buildInteractiveMenuPayload(
    to,
    text,
    imagePath ? resolveMediaUrl(imagePath) : null,
  );

  await postMetaMessage(webhook, payload, {
    successLog: `Menu automático enviado para ${to}`,
    failureLog: `Falha ao enviar menu automático para ${to}`,
  });
};

export const sendCategoryListReply = async (options: {
  webhook: UserWebhookRow;
  to: string;
  categories: CategoryListEntry[];
  page: number;
}) => {
  const { webhook, to, categories, page } = options;

  if (!Array.isArray(categories) || categories.length === 0) {
    console.warn("[Meta Webhook] Nenhuma categoria ativa disponível para enviar na lista");
    return;
  }

  const { payload, page: sanitizedPage, totalPages } = buildCategoryListPayload(
    to,
    categories,
    page,
  );

  await postMetaMessage(webhook, payload, {
    successLog: `Lista de categorias enviada para ${to} (${sanitizedPage}/${totalPages})`,
    failureLog: `Falha ao enviar lista de categorias para ${to}`,
  });
};

export const sendTextMessage = async (options: {
  webhook: UserWebhookRow;
  to: string;
  text: string;
}) => {
  const { webhook, to, text } = options;
  const trimmedText = text.trim();

  if (!trimmedText) {
    console.warn("[Meta Webhook] Mensagem de texto vazia ignorada");
    return;
  }

  const payload: MetaMessagePayload = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: {
      preview_url: false,
      body: trimmedText,
    },
  };

  await postMetaMessage(webhook, payload, {
    successLog: `Mensagem de texto enviada para ${to}`,
    failureLog: `Falha ao enviar mensagem de texto para ${to}`,
  });
};
