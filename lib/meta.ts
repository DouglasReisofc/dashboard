import path from "path";

import type { CategorySummary, ProductSummary } from "types/catalog";
import type { BotMenuConfig } from "types/bot";
import type { PaymentConfirmationMessageConfig } from "types/payments";
import type { UserWebhookRow } from "./db";
import { formatCurrency } from "./format";
import {
  BotTemplateContext,
  defaultCategoryDetailButtonText,
  defaultCategoryListBodyText,
  defaultCategoryListButtonText,
  defaultCategoryListHeaderText,
  defaultCategoryListNextDescription,
  defaultCategoryListNextTitle,
  defaultCategoryListSectionTitle,
  defaultMenuButtonLabels,
  renderCategoryDetailTemplate,
  renderCategoryListTemplate,
  renderMainMenuTemplate,
} from "./bot-menu";
import {
  META_INTERACTIVE_BODY_LIMIT,
  META_INTERACTIVE_BUTTON_LIMIT,
  META_INTERACTIVE_FOOTER_LIMIT,
  META_INTERACTIVE_HEADER_LIMIT,
  META_INTERACTIVE_ROW_DESCRIPTION_LIMIT,
  META_INTERACTIVE_ROW_TITLE_LIMIT,
  META_INTERACTIVE_SECTION_TITLE_LIMIT,
  META_MEDIA_CAPTION_LIMIT,
} from "./meta-limits";

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

const DEFAULT_META_API_VERSION = "v19.0";

export const getMetaApiVersion = () => {
  const raw = process.env.META_API_VERSION?.trim();

  if (!raw) {
    return DEFAULT_META_API_VERSION;
  }

  const normalized = raw.startsWith("v") ? raw : `v${raw}`;

  if (/^v\d+(\.\d+)?$/.test(normalized)) {
    return normalized;
  }

  console.warn(
    `[Meta] META_API_VERSION inválida "${raw}". Usando ${DEFAULT_META_API_VERSION} por padrão.`,
  );

  return DEFAULT_META_API_VERSION;
};

export const MENU_BUTTON_IDS = {
  buy: "storebot_menu_buy",
  addBalance: "storebot_menu_add_balance",
  support: "storebot_menu_support",
} as const;

export const CATEGORY_LIST_ROW_PREFIX = "storebot_category_";
export const CATEGORY_LIST_NEXT_PREFIX = "storebot_list_next_";
export const CATEGORY_PURCHASE_BUTTON_PREFIX = "storebot_buy_category_";
export const ADD_BALANCE_OPTION_PREFIX = "storebot_add_balance_";
export const PAYMENT_METHOD_OPTION_PREFIX = "storebot_payment_method_";

type ButtonDefinition = {
  id: string;
  title: string;
};

const MAX_LIST_ROWS = 10;

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const CONFIRMATION_BUTTON_FALLBACK = "Ir para o menu";

const sanitizeInteractiveText = (text: string, limit = META_INTERACTIVE_BODY_LIMIT) => {
  const trimmed = text.trim();

  if (!trimmed) {
    return "";
  }

  if (limit <= 0) {
    return "";
  }

  return trimmed.length > limit
    ? `${trimmed.slice(0, Math.max(1, limit) - 1)}…`
    : trimmed;
};

const sanitizeInteractiveLabel = (text: string, maxLength: number) => {
  const trimmed = text.trim();

  if (!trimmed) {
    return "";
  }

  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
};

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

  const trimmedRecipient = typeof payload.to === "string" ? payload.to.trim() : "";

  if (!trimmedRecipient) {
    console.warn(`[Meta Webhook] ${context.failureLog}: destinatário inválido`, payload);
    return false;
  }

  const requestPayload: MetaMessagePayload = {
    ...payload,
    messaging_product: "whatsapp",
    to: trimmedRecipient,
  };

  const version = getMetaApiVersion();
  const url = `https://graph.facebook.com/${version}/${webhook.phone_number_id}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${webhook.access_token}`,
      },
      body: JSON.stringify(requestPayload),
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
  options: {
    mediaUrl?: string | null;
    footerText?: string | null;
    buttons: ButtonDefinition[];
  },
) => {
  const trimmedText = text.trim();
  const bodyText = trimmedText.length > META_INTERACTIVE_BODY_LIMIT
    ? `${trimmedText.slice(0, META_INTERACTIVE_BODY_LIMIT - 1)}…`
    : trimmedText;

  const buttonsPayload = options.buttons.map((button) => {
    const fallbackTitle = (() => {
      switch (button.id) {
        case MENU_BUTTON_IDS.addBalance:
          return defaultMenuButtonLabels.addBalance;
        case MENU_BUTTON_IDS.support:
          return defaultMenuButtonLabels.support;
        default:
          return defaultMenuButtonLabels.buy;
      }
    })();

    const sanitizedTitle =
      sanitizeInteractiveLabel(button.title, META_INTERACTIVE_BUTTON_LIMIT) ||
      sanitizeInteractiveLabel(fallbackTitle, META_INTERACTIVE_BUTTON_LIMIT) ||
      "Opção";

    return {
      type: "reply" as const,
      reply: {
        id: button.id,
        title: sanitizedTitle,
      },
    };
  });

  const interactive: Record<string, unknown> = {
    type: "button",
    body: {
      text: bodyText,
    },
    action: {
      buttons: buttonsPayload,
    },
  };

  const sanitizedFooter = options.footerText
    ? sanitizeInteractiveText(options.footerText, META_INTERACTIVE_FOOTER_LIMIT)
    : "";

  if (sanitizedFooter) {
    interactive.footer = {
      text: sanitizedFooter,
    };
  }

  if (options.mediaUrl) {
    interactive.header = {
      type: "image",
      image: {
        link: options.mediaUrl,
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

type AddBalanceOption = {
  id: string;
  title: string;
  description?: string | null;
};

const buildCategoryListPayload = (
  to: string,
  categories: CategoryListEntry[],
  page: number,
  config: BotMenuConfig | null | undefined,
  context: BotTemplateContext,
) => {
  const totalPages = Math.max(1, Math.ceil(categories.length / MAX_LIST_ROWS));
  const sanitizedPage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (sanitizedPage - 1) * MAX_LIST_ROWS;
  const remaining = categories.length - startIndex;
  const hasMore = remaining > MAX_LIST_ROWS;
  const maxRowsForPage = hasMore ? MAX_LIST_ROWS - 1 : MAX_LIST_ROWS;
  const pageEntries = categories.slice(startIndex, startIndex + maxRowsForPage);

  const listContext: BotTemplateContext = {
    ...context,
  };

  const template = renderCategoryListTemplate(
    config
      ? {
          categoryListHeaderText: config.categoryListHeaderText,
          categoryListBodyText: config.categoryListBodyText,
          categoryListFooterText: config.categoryListFooterText,
          categoryListFooterMoreText: config.categoryListFooterMoreText,
          categoryListButtonText: config.categoryListButtonText,
          categoryListSectionTitle: config.categoryListSectionTitle,
          categoryListNextTitle: config.categoryListNextTitle,
          categoryListNextDescription: config.categoryListNextDescription,
          categoryListEmptyText: config.categoryListEmptyText,
          variables: config.variables,
        }
      : null,
    listContext,
  );

  const rows = pageEntries.map((category) => ({
    id: `${CATEGORY_LIST_ROW_PREFIX}${category.id}`,
    title:
      sanitizeInteractiveLabel(category.name, META_INTERACTIVE_ROW_TITLE_LIMIT) ||
      sanitizeInteractiveLabel("Categoria", META_INTERACTIVE_ROW_TITLE_LIMIT),
    description: sanitizeInteractiveLabel(
      formatCurrency(category.price),
      META_INTERACTIVE_ROW_DESCRIPTION_LIMIT,
    ),
  }));

  if (hasMore) {
    rows.push({
      id: `${CATEGORY_LIST_NEXT_PREFIX}${sanitizedPage + 1}`,
      title:
        sanitizeInteractiveLabel(template.nextTitle, META_INTERACTIVE_ROW_TITLE_LIMIT) ||
        sanitizeInteractiveLabel(defaultCategoryListNextTitle, META_INTERACTIVE_ROW_TITLE_LIMIT),
      description:
        sanitizeInteractiveLabel(template.nextDescription, META_INTERACTIVE_ROW_DESCRIPTION_LIMIT) ||
        sanitizeInteractiveLabel(defaultCategoryListNextDescription, META_INTERACTIVE_ROW_DESCRIPTION_LIMIT),
    });
  }

  const footerTextRaw = hasMore ? template.footerMore ?? template.footer : template.footer;
  const footerText = footerTextRaw
    ? sanitizeInteractiveText(footerTextRaw, META_INTERACTIVE_FOOTER_LIMIT)
    : "";

  const headerText =
    sanitizeInteractiveText(template.header, META_INTERACTIVE_HEADER_LIMIT) ||
    sanitizeInteractiveText(defaultCategoryListHeaderText, META_INTERACTIVE_HEADER_LIMIT);

  const bodyText =
    sanitizeInteractiveText(template.body) ||
    sanitizeInteractiveText(defaultCategoryListBodyText);

  const buttonText =
    sanitizeInteractiveLabel(template.button, META_INTERACTIVE_BUTTON_LIMIT) ||
    sanitizeInteractiveLabel(defaultCategoryListButtonText, META_INTERACTIVE_BUTTON_LIMIT);

  const sectionTitle =
    sanitizeInteractiveLabel(template.sectionTitle, META_INTERACTIVE_SECTION_TITLE_LIMIT) ||
    sanitizeInteractiveLabel(defaultCategoryListSectionTitle, META_INTERACTIVE_SECTION_TITLE_LIMIT);

  return {
    payload: {
      messaging_product: "whatsapp" as const,
      to,
      type: "interactive" as const,
      interactive: {
        type: "list" as const,
        header: {
          type: "text" as const,
          text: headerText,
        },
        body: {
          text: bodyText,
        },
        ...(footerText
          ? {
              footer: {
                text: footerText,
              },
            }
          : {}),
        action: {
          button: buttonText,
          sections: [
            {
              title: sectionTitle,
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

const buildAddBalanceListPayload = (
  to: string,
  options: {
    header: string;
    body: string;
    footer?: string | null;
    buttonLabel: string;
    sectionTitle: string;
    rows: AddBalanceOption[];
  },
) => {
  const interactive: Record<string, unknown> = {
    type: "list",
    header: {
      type: "text",
      text: options.header.slice(0, META_INTERACTIVE_HEADER_LIMIT),
    },
    body: {
      text: options.body.slice(0, META_INTERACTIVE_BODY_LIMIT),
    },
    action: {
      button: options.buttonLabel.slice(0, META_INTERACTIVE_BUTTON_LIMIT),
      sections: [
        {
          title: options.sectionTitle.slice(0, META_INTERACTIVE_SECTION_TITLE_LIMIT),
          rows: options.rows.slice(0, MAX_LIST_ROWS).map((row) => ({
            id: row.id,
            title: row.title.slice(0, META_INTERACTIVE_ROW_TITLE_LIMIT),
            description: row.description?.slice(0, META_INTERACTIVE_ROW_DESCRIPTION_LIMIT) ?? undefined,
          })),
        },
      ],
    },
  };

  if (options.footer && options.footer.trim().length > 0) {
    interactive.footer = {
      text: options.footer.trim().slice(0, META_INTERACTIVE_FOOTER_LIMIT),
    };
  }

  return {
    messaging_product: "whatsapp" as const,
    to,
    type: "interactive" as const,
    interactive,
  };
};

const buildCategoryDetailPayload = (
  to: string,
  category: CategorySummary,
  config: BotMenuConfig | null | undefined,
  context: BotTemplateContext,
) => {
  const detailContext: BotTemplateContext = {
    ...context,
    categoryId: category.id.toString(),
    categoryName: category.name,
    categoryPrice: category.price,
    categoryDescription: category.description ?? "",
  };

  const template = renderCategoryDetailTemplate(
    config
      ? {
          categoryDetailBodyText: config.categoryDetailBodyText,
          categoryDetailFooterText: config.categoryDetailFooterText,
          categoryDetailButtonText: config.categoryDetailButtonText,
          categoryDetailFileCaption: config.categoryDetailFileCaption,
          variables: config.variables,
        }
      : null,
    detailContext,
  );

  const bodyText = template.body.length > META_INTERACTIVE_BODY_LIMIT
    ? `${template.body.slice(0, META_INTERACTIVE_BODY_LIMIT - 1)}…`
    : template.body;

  const sanitizedButton =
    sanitizeInteractiveLabel(template.button, META_INTERACTIVE_BUTTON_LIMIT) ||
    sanitizeInteractiveLabel(defaultCategoryDetailButtonText, META_INTERACTIVE_BUTTON_LIMIT);

  const interactive: Record<string, unknown> = {
    type: "button",
    body: {
      text: bodyText,
    },
    action: {
      buttons: [
        {
          type: "reply" as const,
          reply: {
            id: `${CATEGORY_PURCHASE_BUTTON_PREFIX}${category.id}`,
            title: sanitizedButton,
          },
        },
      ],
    },
  };

  const sanitizedFooter = template.footer
    ? sanitizeInteractiveText(template.footer, META_INTERACTIVE_FOOTER_LIMIT)
    : "";

  if (sanitizedFooter) {
    interactive.footer = {
      text: sanitizedFooter,
    };
  }

  if (category.imagePath) {
    interactive.header = {
      type: "image",
      image: {
        link: resolveMediaUrl(category.imagePath),
      },
    };
  }

  return {
    payload: {
      messaging_product: "whatsapp" as const,
      to,
      type: "interactive" as const,
      interactive,
    } satisfies MetaMessagePayload,
    template,
  };
};

export const sendBotMenuReply = async (options: {
  webhook: UserWebhookRow;
  to: string;
  config: BotMenuConfig | null | undefined;
  context: BotTemplateContext;
}) => {
  const { webhook, to, config, context } = options;

  const template = renderMainMenuTemplate(
    config
      ? {
          menuText: config.menuText,
          menuFooterText: config.menuFooterText,
          menuButtonBuyText: config.menuButtonBuyText,
          menuButtonAddBalanceText: config.menuButtonAddBalanceText,
          menuButtonSupportText: config.menuButtonSupportText,
          imagePath: config.imagePath,
          variables: config.variables,
        }
      : null,
    context,
  );

  if (!template.body.trim()) {
    console.warn("[Meta Webhook] Mensagem de menu vazia, nada será enviada");
    return template;
  }

  const buttons: ButtonDefinition[] = [
    { id: MENU_BUTTON_IDS.buy, title: template.buttons.buy || defaultMenuButtonLabels.buy },
    { id: MENU_BUTTON_IDS.addBalance, title: template.buttons.addBalance || defaultMenuButtonLabels.addBalance },
    { id: MENU_BUTTON_IDS.support, title: template.buttons.support || defaultMenuButtonLabels.support },
  ];

  const payload = buildInteractiveMenuPayload(to, template.body, {
    mediaUrl: template.imagePath ? resolveMediaUrl(template.imagePath) : null,
    footerText: template.footer ?? null,
    buttons,
  });

  await postMetaMessage(webhook, payload, {
    successLog: `Menu automático enviado para ${to}`,
    failureLog: `Falha ao enviar menu automático para ${to}`,
  });

  return template;
};

export const sendCategoryListReply = async (options: {
  webhook: UserWebhookRow;
  to: string;
  categories: CategoryListEntry[];
  page: number;
  config: BotMenuConfig | null | undefined;
  context: BotTemplateContext;
}) => {
  const { webhook, to, categories, page, config, context } = options;

  if (!Array.isArray(categories) || categories.length === 0) {
    console.warn("[Meta Webhook] Nenhuma categoria ativa disponível para enviar na lista");
    return null;
  }

  const { payload, page: sanitizedPage, totalPages } = buildCategoryListPayload(
    to,
    categories,
    page,
    config,
    context,
  );

  await postMetaMessage(webhook, payload, {
    successLog: `Lista de categorias enviada para ${to} (${sanitizedPage}/${totalPages})`,
    failureLog: `Falha ao enviar lista de categorias para ${to}`,
  });

  return { page: sanitizedPage, totalPages };
};

export const sendCategoryDetailReply = async (options: {
  webhook: UserWebhookRow;
  to: string;
  category: CategorySummary;
  config: BotMenuConfig | null | undefined;
  context: BotTemplateContext;
}) => {
  const { webhook, to, category, config, context } = options;

  const { payload, template } = buildCategoryDetailPayload(to, category, config, context);

  await postMetaMessage(webhook, payload, {
    successLog: `Detalhes da categoria ${category.id} enviados para ${to}`,
    failureLog: `Falha ao enviar detalhes da categoria ${category.id} para ${to}`,
  });

  return template;
};

export const sendAddBalanceOptions = async (options: {
  webhook: UserWebhookRow;
  to: string;
  header: string;
  body: string;
  footer?: string | null;
  buttonLabel: string;
  sectionTitle: string;
  rows: AddBalanceOption[];
}) => {
  const { webhook, to, header, body, footer, buttonLabel, sectionTitle, rows } = options;

  if (!rows.length) {
    console.warn("[Meta Webhook] Lista de Pix vazia ignorada");
    return false;
  }

  const payload = buildAddBalanceListPayload(to, {
    header,
    body,
    footer,
    buttonLabel,
    sectionTitle,
    rows,
  });

  return postMetaMessage(webhook, payload, {
    successLog: `Lista de valores Pix enviada para ${to}`,
    failureLog: `Falha ao enviar lista de valores Pix para ${to}`,
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

export const sendInteractiveCtaUrlMessage = async (options: {
  webhook: UserWebhookRow;
  to: string;
  bodyText: string;
  buttonText: string;
  buttonUrl: string;
  headerImageUrl?: string | null;
  headerText?: string | null;
  footerText?: string | null;
}) => {
  const {
    webhook,
    to,
    bodyText,
    buttonText,
    buttonUrl,
    headerImageUrl,
    headerText,
    footerText,
  } = options;

  const sanitizedBody = sanitizeInteractiveText(bodyText);
  const sanitizedButtonText = sanitizeInteractiveLabel(buttonText, META_INTERACTIVE_BUTTON_LIMIT);
  const sanitizedUrl = buttonUrl.trim();

  if (!sanitizedBody) {
    console.warn("[Meta Webhook] Mensagem CTA URL sem corpo ignorada");
    return;
  }

  if (!sanitizedButtonText) {
    console.warn("[Meta Webhook] Mensagem CTA URL sem texto do botão ignorada");
    return;
  }

  if (!sanitizedUrl) {
    console.warn("[Meta Webhook] Mensagem CTA URL sem link ignorada");
    return;
  }

  const interactive: Record<string, unknown> = {
    type: "cta_url",
    body: {
      text: sanitizedBody,
    },
    action: {
      name: "cta_url",
      parameters: {
        display_text: sanitizedButtonText,
        url: sanitizedUrl,
      },
    },
  };

  const sanitizedFooter = sanitizeInteractiveText(footerText ?? "", META_INTERACTIVE_FOOTER_LIMIT);
  if (sanitizedFooter) {
    interactive.footer = {
      text: sanitizedFooter,
    };
  }

  const sanitizedHeaderImage = headerImageUrl?.trim();
  if (sanitizedHeaderImage) {
    interactive.header = {
      type: "image",
      image: {
        link: sanitizedHeaderImage,
      },
    };
  } else {
    const sanitizedHeaderText = sanitizeInteractiveText(headerText ?? "", META_INTERACTIVE_HEADER_LIMIT);
    if (sanitizedHeaderText) {
      interactive.header = {
        type: "text",
        text: sanitizedHeaderText,
      };
    }
  }

  const payload: MetaMessagePayload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive,
  };

  await postMetaMessage(webhook, payload, {
    successLog: `Mensagem CTA URL enviada para ${to}`,
    failureLog: `Falha ao enviar mensagem CTA URL para ${to}`,
  });
};

export const sendInteractiveCopyCodeMessage = async (options: {
  webhook: UserWebhookRow;
  to: string;
  bodyText: string;
  buttonText: string;
  code: string;
  footerText?: string | null;
}) => {
  const { webhook, to, bodyText, buttonText, code, footerText } = options;

  const sanitizedBody = sanitizeInteractiveText(bodyText);
  const sanitizedButtonText = sanitizeInteractiveLabel(buttonText, META_INTERACTIVE_BUTTON_LIMIT);
  const sanitizedCode = code.trim();

  if (!sanitizedBody) {
    console.warn("[Meta Webhook] Mensagem CTA copiar sem corpo ignorada");
    return;
  }

  if (!sanitizedButtonText) {
    console.warn("[Meta Webhook] Mensagem CTA copiar sem texto do botão ignorada");
    return;
  }

  if (!sanitizedCode) {
    console.warn("[Meta Webhook] Mensagem CTA copiar sem código ignorada");
    return;
  }

  const interactive: Record<string, unknown> = {
    type: "button",
    body: {
      text: sanitizedBody,
    },
    action: {
      buttons: [
        {
          type: "copy_code",
          text: sanitizedButtonText,
          copy_code: {
            code: sanitizedCode,
          },
        },
      ],
    },
  };

  const sanitizedFooter = sanitizeInteractiveText(footerText ?? "", META_INTERACTIVE_FOOTER_LIMIT);
  if (sanitizedFooter) {
    interactive.footer = {
      text: sanitizedFooter,
    };
  }

  const payload: MetaMessagePayload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive,
  };

  await postMetaMessage(webhook, payload, {
    successLog: `Mensagem CTA copiar enviada para ${to}`,
    failureLog: `Falha ao enviar mensagem CTA copiar para ${to}`,
  });
};

const applyPaymentConfirmationTemplate = (
  template: string,
  context: { amount: number; balance: number },
) => {
  const amountLabel = formatCurrency(context.amount);
  const balanceLabel = formatCurrency(context.balance);

  return template
    .replace(/\{\{\s*valor\s*\}\}/gi, amountLabel)
    .replace(/\{\{\s*saldo\s*\}\}/gi, balanceLabel)
    .trim();
};

export const sendPaymentConfirmationMessage = async (options: {
  webhook: UserWebhookRow;
  to: string;
  config: PaymentConfirmationMessageConfig;
  amount: number;
  balance: number;
}) => {
  const { webhook, to, config, amount, balance } = options;

  const messageTemplate = typeof config.messageText === "string" ? config.messageText : "";
  const renderedMessage = applyPaymentConfirmationTemplate(messageTemplate, { amount, balance });
  const sanitizedBody = sanitizeInteractiveText(renderedMessage);

  if (!sanitizedBody) {
    console.warn("[Meta Webhook] Mensagem de confirmação vazia ignorada");
    return;
  }

  const buttonLabel = typeof config.buttonLabel === "string" ? config.buttonLabel : "";
  const sanitizedButtonLabel = sanitizeInteractiveLabel(buttonLabel, META_INTERACTIVE_BUTTON_LIMIT)
    || sanitizeInteractiveLabel(CONFIRMATION_BUTTON_FALLBACK, META_INTERACTIVE_BUTTON_LIMIT)
    || sanitizeInteractiveLabel(defaultMenuButtonLabels.buy, META_INTERACTIVE_BUTTON_LIMIT);

  if (!sanitizedButtonLabel) {
    console.warn("[Meta Webhook] Texto do botão de confirmação inválido, mensagem não enviada");
    return;
  }

  const headerImage = typeof config.mediaUrl === "string" ? config.mediaUrl.trim() : "";

  const payload = buildInteractiveMenuPayload(to, sanitizedBody, {
    mediaUrl: headerImage || undefined,
    buttons: [
      {
        id: MENU_BUTTON_IDS.buy,
        title: sanitizedButtonLabel,
      },
    ],
  });

  await postMetaMessage(webhook, payload, {
    successLog: `Mensagem de confirmação de pagamento enviada para ${to}`,
    failureLog: `Falha ao enviar mensagem de confirmação de pagamento para ${to}`,
  });
};

export const sendImageFromUrl = async (options: {
  webhook: UserWebhookRow;
  to: string;
  imageUrl: string;
  caption?: string | null;
}) => {
  const { webhook, to, imageUrl, caption } = options;
  const trimmedUrl = imageUrl.trim();

  if (!trimmedUrl) {
    console.warn("[Meta Webhook] URL da imagem vazia ignorada");
    return;
  }

  const payload: MetaMessagePayload = {
    messaging_product: "whatsapp",
    to,
    type: "image",
    image: {
      link: trimmedUrl,
      caption: caption?.trim()?.slice(0, META_MEDIA_CAPTION_LIMIT) ?? undefined,
    },
  };

  await postMetaMessage(webhook, payload, {
    successLog: `Imagem enviada para ${to}`,
    failureLog: `Falha ao enviar imagem para ${to}`,
  });
};

export const sendProductFile = async (options: {
  webhook: UserWebhookRow;
  to: string;
  product: ProductSummary;
  caption?: string;
}) => {
  const { webhook, to, product, caption } = options;

  if (!product.filePath) {
    return;
  }

  const extension = path.extname(product.filePath).toLowerCase();
  const isImage = IMAGE_EXTENSIONS.has(extension);
  const mediaUrl = resolveMediaUrl(product.filePath);
  const trimmedCaption = caption?.trim();
  const safeCaption = trimmedCaption
    ? (trimmedCaption.length > META_MEDIA_CAPTION_LIMIT
      ? `${trimmedCaption.slice(0, META_MEDIA_CAPTION_LIMIT - 1)}…`
      : trimmedCaption)
    : undefined;

  const mediaPayload: Record<string, unknown> = {
    link: mediaUrl,
  };

  if (safeCaption) {
    mediaPayload.caption = safeCaption;
  }

  if (!isImage) {
    mediaPayload.filename = path.basename(product.filePath);
  }

  const payload: MetaMessagePayload = {
    messaging_product: "whatsapp",
    to,
    type: isImage ? "image" : "document",
    [isImage ? "image" : "document"]: mediaPayload,
  };

  await postMetaMessage(webhook, payload, {
    successLog: `Arquivo do produto ${product.id} enviado para ${to}`,
    failureLog: `Falha ao enviar arquivo do produto ${product.id} para ${to}`,
  });
};
