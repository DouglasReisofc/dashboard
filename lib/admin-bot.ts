import path from "path";
import { promises as fs } from "fs";

import { formatCurrency, formatDate, formatDateTime } from "lib/format";
import { getCategoriesForUser, getCategoryByIdForUser } from "lib/catalog";
import { getAllSubscriptionPlans, getUserPlanStatus } from "lib/plans";
import { getAdminSiteSettings } from "lib/admin-site";
import { getCustomersForUser } from "lib/customers";
import type { SessionUser } from "types/auth";
import type { CategorySummary } from "types/catalog";
import type { SubscriptionPlan, UserPlanStatus } from "types/plans";
import type { AdminBotConfig } from "types/admin-bot";
import type { CustomerSummary } from "types/customers";
import type { MetaWebhookCredentials, MetaMessagePayload } from "lib/meta";
import {
  dispatchMetaMessage,
  sendDocumentFromUrl,
  sendInteractiveCtaUrlMessage,
  sendInteractiveCopyCodeMessage,
  sendTextMessage,
} from "lib/meta";
import { createPlanCheckoutPreference, createPlanPixCharge } from "lib/plan-payments";
import { UPLOADS_STORAGE_ROOT } from "lib/uploads";

const APP_BASE_URL = (() => {
  const raw = process.env.APP_URL?.trim();
  if (!raw) {
    return "https://zap2.botadmin.shop";
  }

  try {
    const normalized = raw.endsWith("/") ? raw.slice(0, -1) : raw;
    new URL(normalized);
    return normalized;
  } catch {
    return "https://zap2.botadmin.shop";
  }
})();

const MAX_LIST_ROWS = 10;
const MENU_TEXT_LIMIT = 1024;
const BUTTON_TITLE_LIMIT = 20;
const ADMIN_CATEGORY_ROW_PREFIX = "admin_category_";
const ADMIN_CATEGORY_NEXT_PREFIX = "admin_category_next_";
const ADMIN_CATEGORY_RENAME_PREFIX = "admin_category_rename_";
const ADMIN_CATEGORY_PRICE_PREFIX = "admin_category_price_";
const ADMIN_CATEGORY_SKU_PREFIX = "admin_category_sku_";
const ADMIN_CATEGORY_RENAME_NEXT_PREFIX = "admin_category_rename_next_";
const ADMIN_CATEGORY_PRICE_NEXT_PREFIX = "admin_category_price_next_";
const ADMIN_CATEGORY_SKU_NEXT_PREFIX = "admin_category_sku_next_";
export const ADMIN_PLAN_ROW_PREFIX = "admin_plan_";
const ADMIN_EXPORT_DIR = path.resolve(UPLOADS_STORAGE_ROOT, "admin-bot");

export const ADMIN_MENU_BUTTON_IDS = {
  panel: "admin_menu_panel",
  subscription: "admin_menu_subscription",
  support: "admin_menu_support",
} as const;

export const ADMIN_SUBSCRIPTION_BUTTON_IDS = {
  renew: "admin_subscription_renew",
  change: "admin_subscription_change",
  details: "admin_subscription_details",
  start: "admin_subscription_start",
} as const;

export const ADMIN_PANEL_LIST_IDS = {
  categories: "admin_panel_categories",
  customers: "admin_panel_customers",
  products: "admin_panel_products",
  back: "admin_panel_back",
} as const;

export const ADMIN_CATEGORY_ACTION_LIST_IDS = {
  list: "admin_category_action_list",
  rename: "admin_category_action_rename",
  price: "admin_category_action_price",
  sku: "admin_category_action_sku",
  back: "admin_category_action_back",
} as const;

export const ADMIN_CATEGORY_LIST_BACK_ID = "admin_category_list_back";

export const ADMIN_CATEGORY_BUTTON_IDS = {
  backToActions: "admin_category_back_actions",
} as const;

export const ADMIN_FLOW_BUTTON_IDS = {
  cancel: "admin_flow_cancel",
} as const;

export const ADMIN_CUSTOMER_ACTION_LIST_IDS = {
  list: "admin_customer_action_list",
  edit: "admin_customer_action_edit",
  back: "admin_customer_action_back",
} as const;

export const ADMIN_CUSTOMER_EDIT_OPTION_IDS = {
  balance: "admin_customer_edit_balance",
  name: "admin_customer_edit_name",
  toggleBlock: "admin_customer_edit_toggle_block",
  back: "admin_customer_edit_back",
} as const;

export const ADMIN_CUSTOMER_BUTTON_IDS = {
  backToActions: "admin_customer_back_actions",
} as const;

const truncate = (value: string, limit: number) => {
  if (value.length <= limit) {
    return value;
  }

  if (limit <= 1) {
    return value.slice(0, limit);
  }

  return `${value.slice(0, limit - 1)}…`;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const replaceTokens = (template: string, replacements: Record<string, string>) => {
  return Object.entries(replacements).reduce((text, [token, replacement]) => {
    if (!token) {
      return text;
    }

    const pattern = new RegExp(escapeRegExp(token), "gi");
    return text.replace(pattern, replacement);
  }, template);
};

export const sendAdminMainMenu = async (options: {
  webhook: MetaWebhookCredentials;
  to: string;
  user: SessionUser;
  config: AdminBotConfig;
}) => {
  const { webhook, to, user, config } = options;

  const firstName = user.name.trim().split(/\s+/)[0] ?? user.name;
  const menuMessage = truncate(
    replaceTokens(config.menuText, {
      "{{user_first_name}}": firstName,
      "{{user_name}}": user.name,
    }),
    MENU_TEXT_LIMIT,
  );

  const buttons = [
    {
      type: "reply" as const,
      reply: {
        id: ADMIN_MENU_BUTTON_IDS.panel,
        title: truncate(config.panelButtonText, BUTTON_TITLE_LIMIT),
      },
    },
    {
      type: "reply" as const,
      reply: {
        id: ADMIN_MENU_BUTTON_IDS.subscription,
        title: truncate(config.subscriptionButtonText, BUTTON_TITLE_LIMIT),
      },
    },
    {
      type: "reply" as const,
      reply: {
        id: ADMIN_MENU_BUTTON_IDS.support,
        title: truncate(config.supportButtonText, BUTTON_TITLE_LIMIT),
      },
    },
  ];

  const interactive: Record<string, unknown> = {
    type: "button",
    body: {
      text: menuMessage,
    },
    action: {
      buttons,
    },
  };

  const footer = config.menuFooterText?.trim();
  if (footer) {
    interactive.footer = {
      text: truncate(footer, 60),
    };
  }

  // Prefer absolute link built from stored path; fallback to configured URL
  let headerImageLink: string | null = null;
  if (config.menuImagePath) {
    const normalized = config.menuImagePath.replace(/^\/+/, "");
    headerImageLink = `${APP_BASE_URL}/${normalized}`;
  } else if (config.menuImageUrl && !config.menuImageUrl.includes("undefined")) {
    headerImageLink = config.menuImageUrl;
  }

  if (headerImageLink) {
    interactive.header = {
      type: "image",
      image: {
        link: headerImageLink,
      },
    };
  }

  const payload: MetaMessagePayload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive,
  };

  await dispatchMetaMessage(webhook, payload, {
    successLog: `Menu administrativo enviado para ${to}`,
    failureLog: `Falha ao enviar menu administrativo para ${to}`,
  });
};

export const sendAdminPanelMenu = async (options: {
  webhook: MetaWebhookCredentials;
  to: string;
}) => {
  const { webhook, to } = options;

  const payload: MetaMessagePayload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      header: {
        type: "text",
        text: "Painel administrativo",
      },
      body: {
        text: "Escolha o que deseja gerenciar agora.",
      },
      action: {
        button: "Abrir opções",
        sections: [
          {
            title: "Painel",
            rows: [
              {
                id: ADMIN_PANEL_LIST_IDS.categories,
                title: "Gerenciar categorias",
                description: "Atualize nomes, valores e SKUs.",
              },
              {
                id: ADMIN_PANEL_LIST_IDS.customers,
                title: "Gerenciar clientes",
                description: "Consulte e organize seus clientes.",
              },
              {
                id: ADMIN_PANEL_LIST_IDS.products,
                title: "Gerenciar produtos",
                description: "Veja e edite seus produtos cadastrados.",
              },
              {
                id: ADMIN_PANEL_LIST_IDS.back,
                title: "Voltar",
                description: "Retornar ao menu principal.",
              },
            ].map((row) => ({
              id: row.id,
              title: truncate(row.title, 24),
              description: row.description ? truncate(row.description, 60) : undefined,
            })),
          },
        ],
      },
    },
  };

  await dispatchMetaMessage(webhook, payload, {
    successLog: `Menu do painel administrativo enviado para ${to}`,
    failureLog: `Falha ao enviar menu do painel administrativo para ${to}`,
  });
};

export const sendAdminCategoryActionsMenu = async (options: {
  webhook: MetaWebhookCredentials;
  to: string;
}) => {
  const { webhook, to } = options;

  const payload: MetaMessagePayload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      header: {
        type: "text",
        text: "Categorias",
      },
      body: {
        text: "Qual ação deseja executar nas categorias?",
      },
      action: {
        button: "Escolher",
        sections: [
          {
            title: "Gerenciar categorias",
            rows: [
              {
                id: ADMIN_CATEGORY_ACTION_LIST_IDS.list,
                title: "Listar categorias",
                description: "Visualize suas categorias atuais.",
              },
              {
                id: ADMIN_CATEGORY_ACTION_LIST_IDS.rename,
                title: "Alterar nome",
                description: "Atualize o nome de uma categoria.",
              },
              {
                id: ADMIN_CATEGORY_ACTION_LIST_IDS.price,
                title: "Alterar valor",
                description: "Defina um novo preço padrão.",
              },
              {
                id: ADMIN_CATEGORY_ACTION_LIST_IDS.sku,
                title: "Alterar SKU",
                description: "Edite o SKU vinculado.",
              },
              {
                id: ADMIN_CATEGORY_ACTION_LIST_IDS.back,
                title: "Voltar",
                description: "Retornar ao painel administrativo.",
              },
            ].map((row) => ({
              id: row.id,
              title: truncate(row.title, 24),
              description: row.description ? truncate(row.description, 60) : undefined,
            })),
          },
        ],
      },
    },
  };

  await dispatchMetaMessage(webhook, payload, {
    successLog: `Menu de ações de categorias enviado para ${to}`,
    failureLog: `Falha ao enviar menu de ações de categorias para ${to}`,
  });
};

const buildCategoryRows = (
  categories: CategorySummary[],
  options?: { rowPrefix?: string },
) =>
  categories.map((category) => {
    const statusLabel = category.isActive ? "Ativa" : "Inativa";
    const priceLabel = formatCurrency(category.price);
    const description = truncate(`${statusLabel} · ${priceLabel}`, 60);
    const prefix = options?.rowPrefix ?? ADMIN_CATEGORY_ROW_PREFIX;

    return {
      id: `${prefix}${category.id}`,
      title: truncate(category.name || "Categoria", 24),
      description,
    };
  });

const buildCategoryListPayload = (
  to: string,
  categories: CategorySummary[],
  page: number,
  options?: {
    rowPrefix?: string;
    headerText?: string;
    bodyText?: string;
    buttonText?: string;
    extraRows?: { id: string; title: string; description?: string }[];
    nextPrefix?: string;
  },
) => {
  const extraRows = options?.extraRows ?? [];
  const itemsPerPage = Math.max(1, MAX_LIST_ROWS - extraRows.length);
  const totalPages = Math.max(1, Math.ceil(categories.length / itemsPerPage));
  const sanitizedPage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (sanitizedPage - 1) * itemsPerPage;
  let rowsForPage = categories.slice(startIndex, startIndex + itemsPerPage);
  const hasMore = categories.length > sanitizedPage * itemsPerPage;

  if (hasMore && rowsForPage.length >= itemsPerPage) {
    rowsForPage = rowsForPage.slice(0, Math.max(0, itemsPerPage - 1));
  }

  const rows = buildCategoryRows(rowsForPage, { rowPrefix: options?.rowPrefix });

  if (hasMore) {
    const nextPage = sanitizedPage + 1;
    rows.push({
      id: `${options?.nextPrefix ?? ADMIN_CATEGORY_NEXT_PREFIX}${nextPage}`,
      title: truncate(`Próxima página (${nextPage}/${totalPages})`, 24),
      description: "Ver mais categorias",
    });
  }

  if (extraRows.length > 0) {
    rows.push(...extraRows.map((row) => ({
      id: row.id,
      title: truncate(row.title, 24),
      ...(row.description
        ? { description: truncate(row.description, 60) }
        : {}),
    })));
  }

  const headerText = options?.headerText ?? `Gerenciar categorias (${categories.length})`;
  const bodyText = options?.bodyText ?? "Selecione uma categoria para visualizar detalhes.";
  const buttonText = options?.buttonText ?? "Escolher";

  const payload: MetaMessagePayload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      header: {
        type: "text",
        text: truncate(headerText, 60),
      },
      body: {
        text: truncate(bodyText, 1024),
      },
      ...(hasMore
        ? {
            footer: {
              text: "Role até o fim para acessar a próxima página.",
            },
          }
        : {}),
      action: {
        button: truncate(buttonText, BUTTON_TITLE_LIMIT),
        sections: [
          {
            title: truncate("Categorias", 60),
            rows,
          },
        ],
      },
    },
  };

  return { payload, page: sanitizedPage, totalPages };
};

export const sendAdminCategoryList = async (options: {
  webhook: MetaWebhookCredentials;
  to: string;
  userId: number;
  page: number;
}) => {
  const { webhook, to, userId, page } = options;
  const categories = await getCategoriesForUser(userId);

  if (!categories.length) {
    await sendTextMessage({
      webhook,
      to,
      text: "Nenhuma categoria ativa encontrada. Configure suas categorias pelo painel web para começar a vender.",
    });
    return { page: 1, totalPages: 1 };
  }

  const { payload, page: sanitizedPage, totalPages } = buildCategoryListPayload(to, categories, page);

  await dispatchMetaMessage(webhook, payload, {
    successLog: `Lista administrativa de categorias enviada para ${to}`,
    failureLog: `Falha ao enviar lista administrativa de categorias para ${to}`,
  });

  return { page: sanitizedPage, totalPages };
};

const buildCategorySummaryLines = (category: CategorySummary) => {
  const lines = [
    `Categoria: ${category.name}`,
    `Status: ${category.isActive ? "Ativa" : "Inativa"}`,
    `Preço padrão: ${formatCurrency(category.price)}`,
    `SKU: ${category.sku || "—"}`,
    `Produtos cadastrados: ${category.productCount}`,
    `Atualizado em: ${formatDateTime(category.updatedAt)}`,
  ];

  if (category.description?.trim()) {
    lines.push("", "Descrição:", category.description.trim());
  }

  return lines;
};

const CATEGORY_SELECTION_CONFIG: Record<
  "rename" | "price" | "sku",
  {
    rowPrefix: string;
    header: string;
    body: string;
    button: string;
    nextPrefix: string;
  }
> = {
  rename: {
    rowPrefix: ADMIN_CATEGORY_RENAME_PREFIX,
    header: "Alterar nome",
    body: "Escolha a categoria que deseja renomear.",
    button: "Selecionar",
    nextPrefix: ADMIN_CATEGORY_RENAME_NEXT_PREFIX,
  },
  price: {
    rowPrefix: ADMIN_CATEGORY_PRICE_PREFIX,
    header: "Alterar valor",
    body: "Selecione a categoria para definir um novo valor padrão.",
    button: "Selecionar",
    nextPrefix: ADMIN_CATEGORY_PRICE_NEXT_PREFIX,
  },
  sku: {
    rowPrefix: ADMIN_CATEGORY_SKU_PREFIX,
    header: "Alterar SKU",
    body: "Escolha a categoria para atualizar o SKU.",
    button: "Selecionar",
    nextPrefix: ADMIN_CATEGORY_SKU_NEXT_PREFIX,
  },
};

export const sendAdminCategorySelectionList = async (options: {
  webhook: MetaWebhookCredentials;
  to: string;
  userId: number;
  mode: keyof typeof CATEGORY_SELECTION_CONFIG;
  page?: number;
}) => {
  const { webhook, to, userId, mode } = options;
  const page = options.page ?? 1;
  const categories = await getCategoriesForUser(userId);

  if (!categories.length) {
    await sendTextMessage({
      webhook,
      to,
      text: "Nenhuma categoria ativa encontrada. Cadastre novas categorias pelo painel web para continuar.",
    });
    return { page: 1, totalPages: 1 };
  }

  const config = CATEGORY_SELECTION_CONFIG[mode];
  const { payload, page: sanitizedPage, totalPages } = buildCategoryListPayload(
    to,
    categories,
    page,
    {
      rowPrefix: config.rowPrefix,
      headerText: `${config.header} (${categories.length})`,
      bodyText: config.body,
      buttonText: config.button,
      extraRows: [
        {
          id: ADMIN_CATEGORY_LIST_BACK_ID,
          title: "Voltar",
          description: "Retornar ao menu anterior.",
        },
      ],
      nextPrefix: config.nextPrefix,
    },
  );

  await dispatchMetaMessage(webhook, payload, {
    successLog: `Lista de seleção de categorias (${mode}) enviada para ${to}`,
    failureLog: `Falha ao enviar lista de seleção de categorias (${mode}) para ${to}`,
  });

  return { page: sanitizedPage, totalPages };
};

export const sendAdminCategoryDetails = async (options: {
  webhook: MetaWebhookCredentials;
  to: string;
  userId: number;
  categoryId: number;
}) => {
  const { webhook, to, userId, categoryId } = options;
  const category = await getCategoryByIdForUser(userId, categoryId);

  if (!category) {
    await sendTextMessage({
      webhook,
      to,
      text: "Não encontramos essa categoria. Atualize a lista e tente novamente.",
    });
    return;
  }

  const lines = [
    ...buildCategorySummaryLines(category),
    "",
    `Gerencie pelo painel: ${APP_BASE_URL}/dashboard/user/categories`,
  ];

  await sendTextMessage({
    webhook,
    to,
    text: lines.join("\n"),
  });
};

const CATEGORY_PROMPT_CONFIG: Record<
  keyof typeof CATEGORY_SELECTION_CONFIG,
  {
    header: string;
    message: (category: CategorySummary) => string[];
  }
> = {
  rename: {
    header: "Atualizar nome",
    message: (category) => [
      `Categoria selecionada: ${category.name}`,
      `Preço atual: ${formatCurrency(category.price)}`,
      "",
      "Envie agora o novo nome para essa categoria.",
      "Se preferir cancelar, toque no botão abaixo.",
    ],
  },
  price: {
    header: "Atualizar valor",
    message: (category) => [
      `Categoria selecionada: ${category.name}`,
      `Preço atual: ${formatCurrency(category.price)}`,
      "",
      "Envie o novo valor no formato 49,90 ou 49.90.",
      "Para cancelar, toque no botão abaixo.",
    ],
  },
  sku: {
    header: "Atualizar SKU",
    message: (category) => [
      `Categoria selecionada: ${category.name}`,
      `SKU atual: ${category.sku || "—"}`,
      "",
      "Envie o novo SKU (máx. 32 caracteres alfanuméricos).",
      "Use o botão abaixo para cancelar caso necessário.",
    ],
  },
};

export const sendAdminCategoryInputPrompt = async (options: {
  webhook: MetaWebhookCredentials;
  to: string;
  category: CategorySummary;
  mode: keyof typeof CATEGORY_SELECTION_CONFIG;
}) => {
  const { webhook, to, category, mode } = options;
  const config = CATEGORY_PROMPT_CONFIG[mode];
  const text = truncate(config.message(category).join("\n"), MENU_TEXT_LIMIT);

  const payload: MetaMessagePayload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      header: {
        type: "text",
        text: config.header,
      },
      body: {
        text,
      },
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: ADMIN_FLOW_BUTTON_IDS.cancel,
              title: "Cancelar",
            },
          },
        ],
      },
    },
  };

  await dispatchMetaMessage(webhook, payload, {
    successLog: `Prompt de atualização (${mode}) enviado para ${to}`,
    failureLog: `Falha ao enviar prompt de atualização (${mode}) para ${to}`,
  });
};

export const sendAdminCategoryUpdateConfirmation = async (options: {
  webhook: MetaWebhookCredentials;
  to: string;
  category: CategorySummary;
  message?: string;
}) => {
  const { webhook, to, category } = options;
  const lines = [
    options.message ?? "Categoria atualizada com sucesso!",
    "",
    ...buildCategorySummaryLines(category),
  ];

  const payload: MetaMessagePayload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      header: {
        type: "text",
        text: "Resumo da categoria",
      },
      body: {
        text: truncate(lines.join("\n"), MENU_TEXT_LIMIT),
      },
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: ADMIN_CATEGORY_BUTTON_IDS.backToActions,
              title: "Voltar",
            },
          },
        ],
      },
    },
  };

  await dispatchMetaMessage(webhook, payload, {
    successLog: `Confirmação de atualização de categoria enviada para ${to}`,
    failureLog: `Falha ao enviar confirmação de atualização de categoria para ${to}`,
  });
};

const ensureAdminExportDirectory = async () => {
  await fs.mkdir(ADMIN_EXPORT_DIR, { recursive: true });
  return ADMIN_EXPORT_DIR;
};

const escapeCsvValue = (value: string | number | boolean | null | undefined) => {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = typeof value === "string" ? value : String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
};

const createCustomerCsvFile = async (
  userId: number,
  customers: CustomerSummary[],
) => {
  await ensureAdminExportDirectory();
  const filename = `clientes-${userId}-${Date.now()}.csv`;
  const absolutePath = path.join(ADMIN_EXPORT_DIR, filename);
  const header = [
    "ID",
    "Telefone",
    "Nome",
    "Perfil",
    "Saldo",
    "Bloqueado",
    "Última interação",
    "Criado em",
    "Atualizado em",
  ].join(",");

  const lines = customers.map((customer) => {
    const balance = customer.balance.toFixed(2);
    const lastInteraction = customer.lastInteraction
      ? formatDateTime(customer.lastInteraction)
      : "";
    return [
      customer.id,
      customer.phoneNumber,
      customer.displayName ?? "",
      customer.profileName ?? "",
      balance,
      customer.isBlocked ? "Sim" : "Não",
      lastInteraction,
      formatDateTime(customer.createdAt),
      formatDateTime(customer.updatedAt),
    ].map(escapeCsvValue).join(",");
  });

  const csvContent = [header, ...lines].join("\n");
  await fs.writeFile(absolutePath, csvContent, "utf8");

  const publicPath = path.posix.join("uploads", "admin-bot", filename);
  const fileUrl = `${APP_BASE_URL}/${publicPath}`;

  return { absolutePath, fileUrl, filename };
};

const buildCustomerSummaryLines = (customer: CustomerSummary) => {
  const lines = [
    `Cliente: ${customer.displayName || customer.profileName || customer.phoneNumber}`,
    `Telefone: ${customer.phoneNumber}`,
    `Saldo: ${formatCurrency(customer.balance)}`,
    `Status: ${customer.isBlocked ? "Banido" : "Ativo"}`,
    `Última interação: ${customer.lastInteraction ? formatDateTime(customer.lastInteraction) : "—"}`,
  ];

  return lines;
};

export const sendAdminCustomerActionsMenu = async (options: {
  webhook: MetaWebhookCredentials;
  to: string;
}) => {
  const { webhook, to } = options;

  const payload: MetaMessagePayload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      header: {
        type: "text",
        text: "Clientes",
      },
      body: {
        text: "Escolha o que deseja fazer com os clientes.",
      },
      action: {
        button: "Abrir opções",
        sections: [
          {
            title: "Gerenciar clientes",
            rows: [
              {
                id: ADMIN_CUSTOMER_ACTION_LIST_IDS.list,
                title: "Listar clientes",
                description: "Receba um CSV com todos os clientes.",
              },
              {
                id: ADMIN_CUSTOMER_ACTION_LIST_IDS.edit,
                title: "Editar cliente",
                description: "Alterar saldo, nome ou status de um cliente.",
              },
              {
                id: ADMIN_CUSTOMER_ACTION_LIST_IDS.back,
                title: "Voltar",
                description: "Retornar ao painel administrativo.",
              },
            ].map((row) => ({
              id: row.id,
              title: truncate(row.title, 24),
              description: row.description ? truncate(row.description, 60) : undefined,
            })),
          },
        ],
      },
    },
  };

  await dispatchMetaMessage(webhook, payload, {
    successLog: `Menu de clientes enviado para ${to}`,
    failureLog: `Falha ao enviar menu de clientes para ${to}`,
  });
};

export const sendAdminCustomerCsv = async (options: {
  webhook: MetaWebhookCredentials;
  to: string;
  userId: number;
}) => {
  const { webhook, to, userId } = options;
  const customers = await getCustomersForUser(userId);

  if (!customers.length) {
    await sendTextMessage({
      webhook,
      to,
      text: "Nenhum cliente encontrado. Assim que novos clientes interagirem com o seu bot, eles aparecerão aqui.",
    });
    return { count: 0 };
  }

  const { fileUrl, filename } = await createCustomerCsvFile(userId, customers);

  await sendDocumentFromUrl({
    webhook,
    to,
    documentUrl: fileUrl,
    filename,
    caption: `📄 Lista de clientes (${customers.length})`,
  });

  return { count: customers.length };
};

export const sendAdminCustomerLookupPrompt = async (options: {
  webhook: MetaWebhookCredentials;
  to: string;
}) => {
  const { webhook, to } = options;

  const payload: MetaMessagePayload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      header: {
        type: "text",
        text: "Editar cliente",
      },
      body: {
        text: "Envie o número do cliente no formato +5511999998888 ou 11999998888.",
      },
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: ADMIN_FLOW_BUTTON_IDS.cancel,
              title: "Cancelar",
            },
          },
        ],
      },
    },
  };

  await dispatchMetaMessage(webhook, payload, {
    successLog: `Prompt de busca de cliente enviado para ${to}`,
    failureLog: `Falha ao enviar prompt de busca de cliente para ${to}`,
  });
};

export const sendAdminCustomerEditMenu = async (options: {
  webhook: MetaWebhookCredentials;
  to: string;
  customer: CustomerSummary;
}) => {
  const { webhook, to, customer } = options;
  const lines = buildCustomerSummaryLines(customer);

  const payload: MetaMessagePayload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      header: {
        type: "text",
        text: "Editar cliente",
      },
      body: {
        text: truncate(lines.join("\n"), MENU_TEXT_LIMIT),
      },
      action: {
        button: "Selecionar ação",
        sections: [
          {
            title: "Ações disponíveis",
            rows: [
              {
                id: ADMIN_CUSTOMER_EDIT_OPTION_IDS.balance,
                title: "Ajustar saldo",
                description: "Use formatos +10 ou -5 para aplicar o ajuste.",
              },
              {
                id: ADMIN_CUSTOMER_EDIT_OPTION_IDS.name,
                title: "Alterar nome",
                description: "Defina um novo nome de exibição.",
              },
              {
                id: ADMIN_CUSTOMER_EDIT_OPTION_IDS.toggleBlock,
                title: customer.isBlocked ? "Desbanir cliente" : "Banir cliente",
                description: customer.isBlocked
                  ? "Permitir interações novamente."
                  : "Impedir novas interações.",
              },
              {
                id: ADMIN_CUSTOMER_EDIT_OPTION_IDS.back,
                title: "Voltar",
                description: "Retornar ao menu de clientes.",
              },
            ].map((row) => ({
              id: row.id,
              title: truncate(row.title, 24),
              description: row.description ? truncate(row.description, 60) : undefined,
            })),
          },
        ],
      },
    },
  };

  await dispatchMetaMessage(webhook, payload, {
    successLog: `Menu de edição de cliente enviado para ${to}`,
    failureLog: `Falha ao enviar menu de edição de cliente para ${to}`,
  });
};

export const sendAdminCustomerBalancePrompt = async (options: {
  webhook: MetaWebhookCredentials;
  to: string;
  customer: CustomerSummary;
}) => {
  const { webhook, to, customer } = options;

  const payload: MetaMessagePayload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      header: {
        type: "text",
        text: "Ajustar saldo",
      },
      body: {
        text: `Saldo atual: ${formatCurrency(customer.balance)}\nEnvie o valor no formato +10 ou -5. Use 0 para não alterar.`,
      },
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: ADMIN_FLOW_BUTTON_IDS.cancel,
              title: "Cancelar",
            },
          },
        ],
      },
    },
  };

  await dispatchMetaMessage(webhook, payload, {
    successLog: `Prompt de ajuste de saldo enviado para ${to}`,
    failureLog: `Falha ao enviar prompt de ajuste de saldo para ${to}`,
  });
};

export const sendAdminCustomerNamePrompt = async (options: {
  webhook: MetaWebhookCredentials;
  to: string;
  customer: CustomerSummary;
}) => {
  const { webhook, to, customer } = options;

  const payload: MetaMessagePayload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      header: {
        type: "text",
        text: "Alterar nome",
      },
      body: {
        text: `Nome atual: ${customer.displayName || customer.profileName || "—"}\nEnvie o novo nome com pelo menos 2 caracteres.`,
      },
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: ADMIN_FLOW_BUTTON_IDS.cancel,
              title: "Cancelar",
            },
          },
        ],
      },
    },
  };

  await dispatchMetaMessage(webhook, payload, {
    successLog: `Prompt de alteração de nome enviado para ${to}`,
    failureLog: `Falha ao enviar prompt de alteração de nome para ${to}`,
  });
};

export const sendAdminCustomerUpdateConfirmation = async (options: {
  webhook: MetaWebhookCredentials;
  to: string;
  customer: CustomerSummary;
  message: string;
}) => {
  const { webhook, to, customer, message } = options;
  const lines = [message, "", ...buildCustomerSummaryLines(customer)];

  const payload: MetaMessagePayload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      header: {
        type: "text",
        text: "Cliente atualizado",
      },
      body: {
        text: truncate(lines.join("\n"), MENU_TEXT_LIMIT),
      },
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: ADMIN_CUSTOMER_BUTTON_IDS.backToActions,
              title: "Voltar",
            },
          },
        ],
      },
    },
  };

  await dispatchMetaMessage(webhook, payload, {
    successLog: `Confirmação de atualização de cliente enviada para ${to}`,
    failureLog: `Falha ao enviar confirmação de atualização de cliente para ${to}`,
  });
};

export const sendAdminSubscriptionSummary = async (options: {
  webhook: MetaWebhookCredentials;
  to: string;
  userId: number;
}) => {
  const { webhook, to, userId } = options;
  const status = await getUserPlanStatus(userId);

  if (!status.plan) {
    await sendTextMessage({
      webhook,
      to,
      text: [
        "Você ainda não possui um plano ativo.",
        "Acesse o painel em Loja > Meu plano para escolher a melhor opção para o seu negócio.",
        `${APP_BASE_URL}/dashboard/user/plano`,
      ].join("\n"),
    });
    return;
  }

  const lines = [
    `Plano: ${status.plan.name}`,
    `Valor: ${formatCurrency(status.plan.price)}`,
    `Limite de categorias: ${status.plan.categoryLimit}`,
    `Status: ${status.status === "active" ? "Ativo" : status.status === "expired" ? "Expirado" : status.status === "pending" ? "Pagamento pendente" : "Inativo"}`,
  ];

  if (status.currentPeriodStart) {
    lines.push(`Início do ciclo: ${formatDate(status.currentPeriodStart)}`);
  }

  if (status.currentPeriodEnd) {
    lines.push(`Fim do ciclo: ${formatDate(status.currentPeriodEnd)}`);
  }

  if (status.daysRemaining !== null) {
    lines.push(`Dias restantes: ${status.daysRemaining}`);
  }

  lines.push("", `Gerencie seu plano: ${APP_BASE_URL}/dashboard/user/plano`);

  await sendTextMessage({
    webhook,
    to,
    text: lines.join("\n"),
  });
};

const buildPlanStatusLabel = (status: UserPlanStatus["status"]) => {
  switch (status) {
    case "active":
      return "Ativo";
    case "pending":
      return "Pagamento pendente";
    case "expired":
      return "Expirado";
    default:
      return "Inativo";
  }
};

const buildPlanReplacements = (status: UserPlanStatus) => {
  const plan = status.plan;
  return {
    "{{plan_name}}": plan?.name ?? "—",
    "{{plan_status}}": buildPlanStatusLabel(status.status),
    "{{plan_price}}": plan ? formatCurrency(plan.price) : "—",
    "{{plan_category_limit}}": plan ? String(plan.categoryLimit) : "—",
    "{{plan_renews_at}}": status.currentPeriodEnd ? formatDate(status.currentPeriodEnd) : "—",
    "{{plan_started_at}}": status.currentPeriodStart ? formatDate(status.currentPeriodStart) : "—",
    "{{plan_days_remaining}}":
      status.daysRemaining !== null ? `${status.daysRemaining}` : "—",
  };
};

const buildPlanButtons = (config: AdminBotConfig) => [
  {
    type: "reply" as const,
    reply: {
      id: ADMIN_SUBSCRIPTION_BUTTON_IDS.renew,
      title: truncate(config.subscriptionRenewButtonText, BUTTON_TITLE_LIMIT),
    },
  },
  {
    type: "reply" as const,
    reply: {
      id: ADMIN_SUBSCRIPTION_BUTTON_IDS.change,
      title: truncate(config.subscriptionChangeButtonText, BUTTON_TITLE_LIMIT),
    },
  },
  {
    type: "reply" as const,
    reply: {
      id: ADMIN_SUBSCRIPTION_BUTTON_IDS.details,
      title: truncate(config.subscriptionDetailsButtonText, BUTTON_TITLE_LIMIT),
    },
  },
];

export const sendAdminSubscriptionMenu = async (options: {
  webhook: MetaWebhookCredentials;
  to: string;
  user: SessionUser;
  config: AdminBotConfig;
}) => {
  const { webhook, to, user, config } = options;
  const status = await getUserPlanStatus(user.id);

  if (!status.plan) {
    const header = truncate(config.subscriptionNoPlanHeaderText, 60);
    const body = truncate(
      replaceTokens(config.subscriptionNoPlanBodyText, buildPlanReplacements(status)),
      MENU_TEXT_LIMIT,
    );

    const interactive: Record<string, unknown> = {
      type: "button",
      body: { text: body },
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: ADMIN_SUBSCRIPTION_BUTTON_IDS.start,
              title: truncate(config.subscriptionNoPlanButtonText, BUTTON_TITLE_LIMIT),
            },
          },
        ],
      },
    };

    if (header) {
      interactive.header = {
        type: "text",
        text: header,
      };
    }

    await dispatchMetaMessage(webhook, {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive,
    }, {
      successLog: `Menu de assinatura (sem plano) enviado para ${to}`,
      failureLog: `Falha ao enviar menu de assinatura (sem plano) para ${to}`,
    });

    return;
  }

  const replacements = buildPlanReplacements(status);
  const headerText = truncate(replaceTokens(config.subscriptionHeaderText, replacements), 60);
  const bodyText = truncate(replaceTokens(config.subscriptionBodyText, replacements), MENU_TEXT_LIMIT);
  const footerText = config.subscriptionFooterText?.trim();

  const interactive: Record<string, unknown> = {
    type: "button",
    body: { text: bodyText },
    action: { buttons: buildPlanButtons(config) },
  };

  if (headerText) {
    interactive.header = {
      type: "text",
      text: headerText,
    };
  }

  if (footerText) {
    interactive.footer = {
      text: truncate(footerText, 60),
    };
  }

  await dispatchMetaMessage(webhook, {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive,
  }, {
    successLog: `Menu de assinatura enviado para ${to}`,
    failureLog: `Falha ao enviar menu de assinatura para ${to}`,
  });
};

export const sendAdminPlanDetails = async (options: {
  webhook: MetaWebhookCredentials;
  to: string;
  status: UserPlanStatus;
  config: AdminBotConfig;
}) => {
  const { webhook, to, status, config } = options;

  if (!status.plan) {
    await sendTextMessage({
      webhook,
      to,
      text: replaceTokens(config.subscriptionNoPlanBodyText, buildPlanReplacements(status)),
    });
    return;
  }

  const replacements = buildPlanReplacements(status);
  const lines = [
    replaceTokens(config.subscriptionHeaderText, replacements),
    "",
    replaceTokens(config.subscriptionBodyText, replacements),
    "",
    `Link do painel: ${APP_BASE_URL}/dashboard/user/plano`,
  ];

  await sendTextMessage({
    webhook,
    to,
    text: lines.filter((line) => line.trim().length > 0).join("\n"),
  });
};

export const sendAdminPlanList = async (options: {
  webhook: MetaWebhookCredentials;
  to: string;
  config: AdminBotConfig;
}) => {
  const { webhook, to, config } = options;
  const plans = (await getAllSubscriptionPlans()).filter((plan) => plan.isActive);

  if (!plans.length) {
    await sendTextMessage({
      webhook,
      to,
      text: "Nenhum plano ativo foi encontrado. Cadastre os planos no painel antes de continuar.",
    });
    return;
  }

  const rows = plans.map((plan) => ({
    id: `${ADMIN_PLAN_ROW_PREFIX}${plan.id}`,
    title: truncate(plan.name, 24),
    description: truncate(`${formatCurrency(plan.price)} · ${plan.categoryLimit} categorias`, 60),
  }));

  const interactive: Record<string, unknown> = {
    type: "list",
    header: {
      type: "text",
      text: truncate(config.subscriptionPlanListTitle, 60),
    },
    body: {
      text: truncate(config.subscriptionPlanListBody, MENU_TEXT_LIMIT),
    },
    action: {
      button: truncate(config.subscriptionPlanListButtonText, BUTTON_TITLE_LIMIT),
      sections: [
        {
          title: truncate(config.subscriptionPlanListTitle, 60),
          rows,
        },
      ],
    },
  };

  const footer = config.subscriptionPlanListFooterText?.trim();
  if (footer) {
    interactive.footer = {
      text: truncate(footer, 60),
    };
  }

  await dispatchMetaMessage(webhook, {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive,
  }, {
    successLog: `Lista de planos enviada para ${to}`,
    failureLog: `Falha ao enviar lista de planos para ${to}`,
  });
};

const buildPlanPaymentSummary = (plan: SubscriptionPlan) =>
  [
    `Plano: ${plan.name}`,
    `Valor: ${formatCurrency(plan.price)}`,
  ].join("\n");

export const sendAdminPlanPayment = async (options: {
  webhook: MetaWebhookCredentials;
  to: string;
  user: SessionUser;
  plan: SubscriptionPlan;
}) => {
  const { webhook, to, user, plan } = options;

  const summary = buildPlanPaymentSummary(plan);

  const tryPix = async () => {
    try {
      const charge = await createPlanPixCharge({
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        plan,
      });

      const expirationText = charge.expiresAt ? formatDateTime(charge.expiresAt) : null;
      const bodyLines = [
        "💳 Pagamento Pix",
        summary,
        expirationText ? `Expira em: ${expirationText}` : null,
        "Use o botão abaixo para abrir o QR Code e finalizar o pagamento.",
      ].filter((line): line is string => typeof line === "string" && line.trim().length > 0);

      const bodyText = bodyLines.join("\n\n");

      if (charge.ticketUrl) {
        await sendInteractiveCtaUrlMessage({
          webhook,
          to,
          bodyText,
          buttonText: "Abrir pagamento Pix",
          buttonUrl: charge.ticketUrl,
          headerText: "Pagamento Pix",
        });
      } else {
        await sendTextMessage({ webhook, to, text: bodyText });
      }

      if (charge.qrCode) {
        await sendTextMessage({
          webhook,
          to,
          text: charge.qrCode,
        });

        await sendInteractiveCopyCodeMessage({
          webhook,
          to,
          bodyText: "Copiar código Pix",
          buttonText: "Copiar código Pix",
          code: charge.qrCode,
        });
      }

      return true;
    } catch (error) {
      console.error("Falha ao gerar cobrança Pix do plano", error);
      return false;
    }
  };

  const tryCheckout = async () => {
    try {
      const checkout = await createPlanCheckoutPreference({
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        plan,
      });

      if (checkout.ticketUrl) {
        await sendInteractiveCtaUrlMessage({
          webhook,
          to,
          bodyText: `💳 Pagamento online\n\n${summary}\n\nToque no botão abaixo para abrir o checkout seguro e concluir o pagamento.`,
          buttonText: "Abrir checkout",
          buttonUrl: checkout.ticketUrl,
          headerText: "Pagamento online",
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error("Falha ao gerar checkout do plano", error);
      return false;
    }
  };

  const pixDelivered = await tryPix();
  if (pixDelivered) {
    return;
  }

  const checkoutDelivered = await tryCheckout();
  if (checkoutDelivered) {
    return;
  }

  await sendTextMessage({
    webhook,
    to,
    text: "Não foi possível gerar o pagamento automaticamente. Tente novamente mais tarde ou entre em contato com a equipe StoreBot.",
  });
};

export const sendAdminSupportMessage = async (options: {
  webhook: MetaWebhookCredentials;
  to: string;
}) => {
  const { webhook, to } = options;
  const siteSettings = await getAdminSiteSettings();

  const lines = [
    "Nossa equipe já foi avisada. Conte com a StoreBot para resolver seu atendimento!",
  ];

  if (siteSettings.supportEmail) {
    lines.push(`E-mail: ${siteSettings.supportEmail}`);
  }

  if (siteSettings.supportPhone) {
    lines.push(`WhatsApp: ${siteSettings.supportPhone}`);
  }

  lines.push("",
    "Caso prefira, envie detalhes agora mesmo e continuaremos a falar por aqui.");

  await sendTextMessage({
    webhook,
    to,
    text: lines.join("\n"),
  });
};

export const sendAdminRegistrationMissingMessage = async (options: {
  webhook: MetaWebhookCredentials;
  to: string;
}) => {
  const { webhook, to } = options;

  const message = [
    "Não encontramos uma conta ativa vinculada a este número de WhatsApp.",
    "Cadastre-se no StoreBot ou atualize o número nas configurações do seu perfil para usar o bot administrativo.",
    `${APP_BASE_URL}/sign-in`,
  ].join("\n");

  await sendTextMessage({
    webhook,
    to,
    text: message,
  });
};

export const sendAdminUnknownOptionMessage = async (options: {
  webhook: MetaWebhookCredentials;
  to: string;
}) => {
  const { webhook, to } = options;

  await sendTextMessage({
    webhook,
    to,
    text: "Não entendi sua solicitação. Use os botões para escolher uma das opções disponíveis.",
  });
};

export const parseAdminCategoryRowId = (rawId: string) => {
  if (rawId.startsWith(ADMIN_CATEGORY_ROW_PREFIX)) {
    const numeric = Number.parseInt(rawId.slice(ADMIN_CATEGORY_ROW_PREFIX.length), 10);
    return Number.isFinite(numeric) ? numeric : null;
  }

  return null;
};

export const parseAdminCategoryNextPage = (rawId: string) => {
  if (rawId.startsWith(ADMIN_CATEGORY_NEXT_PREFIX)) {
    const numeric = Number.parseInt(rawId.slice(ADMIN_CATEGORY_NEXT_PREFIX.length), 10);
    return Number.isFinite(numeric) ? numeric : null;
  }

  return null;
};

export const parseAdminCategoryRenameNextPage = (rawId: string) =>
  parsePrefixedCategoryId(rawId, ADMIN_CATEGORY_RENAME_NEXT_PREFIX);

export const parseAdminCategoryPriceNextPage = (rawId: string) =>
  parsePrefixedCategoryId(rawId, ADMIN_CATEGORY_PRICE_NEXT_PREFIX);

export const parseAdminCategorySkuNextPage = (rawId: string) =>
  parsePrefixedCategoryId(rawId, ADMIN_CATEGORY_SKU_NEXT_PREFIX);

const parsePrefixedCategoryId = (rawId: string, prefix: string) => {
  if (rawId.startsWith(prefix)) {
    const numeric = Number.parseInt(rawId.slice(prefix.length), 10);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
};

export const parseAdminCategoryRenameRowId = (rawId: string) =>
  parsePrefixedCategoryId(rawId, ADMIN_CATEGORY_RENAME_PREFIX);

export const parseAdminCategoryPriceRowId = (rawId: string) =>
  parsePrefixedCategoryId(rawId, ADMIN_CATEGORY_PRICE_PREFIX);

export const parseAdminCategorySkuRowId = (rawId: string) =>
  parsePrefixedCategoryId(rawId, ADMIN_CATEGORY_SKU_PREFIX);

export const parseAdminPlanRowId = (rawId: string) => {
  if (rawId.startsWith(ADMIN_PLAN_ROW_PREFIX)) {
    const numeric = Number.parseInt(rawId.slice(ADMIN_PLAN_ROW_PREFIX.length), 10);
    return Number.isFinite(numeric) ? numeric : null;
  }

  return null;
};
