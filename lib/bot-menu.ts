import { formatCurrency } from "./format";

export const defaultMenuVariables = [
  "{{nome_cliente}}",
  "{{numero_cliente}}",
  "{{saldo_cliente}}",
  "{{id_categoria}}",
] as const;

const categoryTemplateTokens = [
  "{{nome_categoria}}",
  "{{preco_categoria}}",
  "{{descricao_categoria}}",
] as const;

const paginationTemplateTokens = [
  "{{pagina_atual}}",
  "{{total_paginas}}",
  "{{categorias_total}}",
  "{{categorias_pagina}}",
  "{{proxima_pagina}}",
  "{{possui_proxima_pagina}}",
] as const;

const DEFAULT_TEMPLATE_TOKENS = Array.from(
  new Set([
    ...defaultMenuVariables,
    ...categoryTemplateTokens,
    ...paginationTemplateTokens,
  ]),
);

export const defaultMenuText = [
  "Olá {{nome_cliente}},",
  "",
  "É um prazer atendê-lo pelo nosso canal oficial StoreBot.",
  "",
  "Saldo disponível: {{saldo_cliente}}",
  "Número do WhatsApp: {{numero_cliente}}",
  "",
  "Escolha uma das opções abaixo para continuar e aproveitar nossas ofertas digitais.",
].join("\n");

export const defaultMenuFooterText = "Selecione uma das opções para continuar seu atendimento.";

export const defaultMenuButtonLabels = {
  buy: "Comprar contas",
  addBalance: "Adicionar saldo",
  support: "Suporte",
} as const;

export const defaultCategoryListHeaderText = "Comprar contas";
export const defaultCategoryListBodyText =
  "Selecione a categoria desejada ({{pagina_atual}}/{{total_paginas}}).";
export const defaultCategoryListFooterText =
  "Selecione a categoria desejada para continuar sua compra.";
export const defaultCategoryListFooterMoreText =
  "Role até o fim e toque em \"Próxima lista\" para visualizar mais categorias.";
export const defaultCategoryListButtonText = "Ver categorias";
export const defaultCategoryListSectionTitle = "Página {{pagina_atual}}/{{total_paginas}}";
export const defaultCategoryListNextTitle = "Próxima lista ▶️";
export const defaultCategoryListNextDescription =
  "Ver mais categorias ({{proxima_pagina}}/{{total_paginas}})";
export const defaultCategoryListEmptyText =
  "No momento não encontramos categorias ativas para compras. Aguarde novas ofertas ou fale com o suporte.";

export const defaultCategoryDetailBodyText =
  "{{nome_categoria}}\nValor: {{preco_categoria}}\n\n{{descricao_categoria}}";
export const defaultCategoryDetailFooterText =
  "Toque em Comprar para receber o produto escolhido.";
export const defaultCategoryDetailButtonText = "Comprar";
export const defaultCategoryDetailFileCaption = "{{nome_categoria}} - dados complementares";

export const defaultAddBalanceReplyText =
  "Para adicionar saldo, informe o valor desejado e aguarde o envio das instruções de pagamento por este canal.";
export const defaultSupportReplyText =
  "Nossa equipe de suporte foi acionada. Descreva sua necessidade para que possamos auxiliá-lo imediatamente.";

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type BotTemplateContext = {
  contactName?: string | null;
  contactNumber?: string | null;
  contactBalance?: number | null;
  categoryId?: string | null;
  categoryName?: string | null;
  categoryPrice?: number | null;
  categoryDescription?: string | null;
  page?: number | null;
  totalPages?: number | null;
  categoriesCount?: number | null;
  categoriesOnPage?: number | null;
  nextPage?: number | null;
  hasMore?: boolean | null;
};

const resolveReplacement = (token: string, context: BotTemplateContext): string => {
  const normalized = token.trim().toLowerCase();

  switch (normalized) {
    case "{{nome_cliente}}": {
      const name = context.contactName?.toString().trim();
      return name && name.length > 0 ? name : "Cliente";
    }
    case "{{numero_cliente}}": {
      const number = context.contactNumber?.toString().trim();
      return number ?? "";
    }
    case "{{saldo_cliente}}": {
      const numericBalance = typeof context.contactBalance === "number"
        ? context.contactBalance
        : Number(context.contactBalance ?? 0);

      return formatCurrency(Number.isFinite(numericBalance) ? numericBalance : 0);
    }
    case "{{id_categoria}}":
      return context.categoryId?.toString().trim() ?? "";
    case "{{nome_categoria}}":
      return context.categoryName?.toString().trim() ?? "";
    case "{{preco_categoria}}": {
      const numericPrice = typeof context.categoryPrice === "number"
        ? context.categoryPrice
        : Number(context.categoryPrice ?? 0);
      return formatCurrency(Number.isFinite(numericPrice) ? numericPrice : 0);
    }
    case "{{descricao_categoria}}":
      return context.categoryDescription?.toString().trim() ?? "";
    case "{{pagina_atual}}": {
      const pageNumber = Number.isFinite(context.page) && context.page !== null
        ? Number(context.page)
        : 1;
      return pageNumber.toString();
    }
    case "{{total_paginas}}": {
      const totalPages = Number.isFinite(context.totalPages) && context.totalPages !== null
        ? Number(context.totalPages)
        : 1;
      return totalPages.toString();
    }
    case "{{categorias_total}}": {
      const total = Number.isFinite(context.categoriesCount) && context.categoriesCount !== null
        ? Number(context.categoriesCount)
        : 0;
      return total.toString();
    }
    case "{{categorias_pagina}}": {
      const total = Number.isFinite(context.categoriesOnPage) && context.categoriesOnPage !== null
        ? Number(context.categoriesOnPage)
        : 0;
      return total.toString();
    }
    case "{{proxima_pagina}}": {
      const next = Number.isFinite(context.nextPage) && context.nextPage !== null
        ? Number(context.nextPage)
        : Number.isFinite(context.page) && context.page !== null
          ? Number(context.page)
          : 1;
      return next.toString();
    }
    case "{{possui_proxima_pagina}}":
      return context.hasMore ? "Sim" : "Não";
    default:
      return "";
  }
};

type RenderOptions = {
  allowEmpty?: boolean;
  trimResult?: boolean;
};

const renderTemplateValue = (
  template: string | null | undefined,
  fallback: string,
  context: BotTemplateContext,
  customTokens: readonly string[] | undefined,
  options?: RenderOptions,
): string => {
  const allowEmpty = options?.allowEmpty ?? false;
  const trimResult = options?.trimResult ?? true;

  const source = typeof template === "string"
    ? template
    : fallback;

  const shouldUseFallback =
    (typeof template !== "string" || (template.trim().length === 0 && !allowEmpty)) && fallback.trim().length > 0;

  const templateToRender = shouldUseFallback ? fallback : source;

  const tokens = Array.from(
    new Set([
      ...DEFAULT_TEMPLATE_TOKENS,
      ...(Array.isArray(customTokens) ? customTokens : []),
    ]
      .map((token) => token.trim())
      .filter((token) => token.length > 0)),
  );

  const rendered = tokens.reduce((currentText, token) => {
    const replacement = resolveReplacement(token, context);
    if (replacement === undefined) {
      return currentText;
    }

    const pattern = new RegExp(escapeRegExp(token), "gi");
    return currentText.replace(pattern, replacement);
  }, templateToRender);

  if (!trimResult) {
    return rendered;
  }

  const trimmed = rendered.trim();

  if (!trimmed && !allowEmpty) {
    return fallback.trim();
  }

  return trimmed;
};

export const renderMainMenuTemplate = (
  config: { menuText: string; menuFooterText: string | null; menuButtonBuyText: string; menuButtonAddBalanceText: string; menuButtonSupportText: string; imagePath: string | null; variables: string[] } | null,
  context: BotTemplateContext,
) => {
  const variables = config?.variables ?? [];

  const body = renderTemplateValue(
    config?.menuText,
    defaultMenuText,
    context,
    variables,
    { allowEmpty: false, trimResult: false },
  ).trim();

  const footerRaw = renderTemplateValue(
    config?.menuFooterText ?? null,
    defaultMenuFooterText,
    context,
    variables,
    { allowEmpty: true },
  );

  const footer = footerRaw.trim().length > 0 ? footerRaw.trim() : null;

  return {
    body,
    footer,
    buttons: {
      buy: config?.menuButtonBuyText?.trim() || defaultMenuButtonLabels.buy,
      addBalance: config?.menuButtonAddBalanceText?.trim() || defaultMenuButtonLabels.addBalance,
      support: config?.menuButtonSupportText?.trim() || defaultMenuButtonLabels.support,
    },
    imagePath: config?.imagePath ?? null,
  };
};

export const renderCategoryListTemplate = (
  config: {
    categoryListHeaderText: string;
    categoryListBodyText: string;
    categoryListFooterText: string;
    categoryListFooterMoreText: string;
    categoryListButtonText: string;
    categoryListSectionTitle: string;
    categoryListNextTitle: string;
    categoryListNextDescription: string;
    categoryListEmptyText: string;
    variables: string[];
  } | null,
  context: BotTemplateContext,
) => {
  const variables = config?.variables ?? [];

  const header = renderTemplateValue(
    config?.categoryListHeaderText,
    defaultCategoryListHeaderText,
    context,
    variables,
    { allowEmpty: false },
  );

  const body = renderTemplateValue(
    config?.categoryListBodyText,
    defaultCategoryListBodyText,
    context,
    variables,
    { allowEmpty: false },
  );

  const footer = renderTemplateValue(
    config?.categoryListFooterText,
    defaultCategoryListFooterText,
    context,
    variables,
    { allowEmpty: true },
  );

  const footerMore = renderTemplateValue(
    config?.categoryListFooterMoreText,
    defaultCategoryListFooterMoreText,
    context,
    variables,
    { allowEmpty: true },
  );

  const button = renderTemplateValue(
    config?.categoryListButtonText,
    defaultCategoryListButtonText,
    context,
    variables,
    { allowEmpty: false },
  );

  const sectionTitle = renderTemplateValue(
    config?.categoryListSectionTitle,
    defaultCategoryListSectionTitle,
    context,
    variables,
    { allowEmpty: false },
  );

  const nextTitle = renderTemplateValue(
    config?.categoryListNextTitle,
    defaultCategoryListNextTitle,
    context,
    variables,
    { allowEmpty: false },
  );

  const nextDescription = renderTemplateValue(
    config?.categoryListNextDescription,
    defaultCategoryListNextDescription,
    context,
    variables,
    { allowEmpty: false },
  );

  const emptyText = renderTemplateValue(
    config?.categoryListEmptyText,
    defaultCategoryListEmptyText,
    context,
    variables,
    { allowEmpty: false },
  );

  return {
    header,
    body,
    footer: footer.trim().length > 0 ? footer.trim() : null,
    footerMore: footerMore.trim().length > 0 ? footerMore.trim() : null,
    button,
    sectionTitle,
    nextTitle,
    nextDescription,
    emptyText,
  };
};

export const renderCategoryDetailTemplate = (
  config: {
    categoryDetailBodyText: string;
    categoryDetailFooterText: string;
    categoryDetailButtonText: string;
    categoryDetailFileCaption: string | null;
    variables: string[];
  } | null,
  context: BotTemplateContext,
) => {
  const variables = config?.variables ?? [];

  const body = renderTemplateValue(
    config?.categoryDetailBodyText,
    defaultCategoryDetailBodyText,
    context,
    variables,
    { allowEmpty: false },
  );

  const footer = renderTemplateValue(
    config?.categoryDetailFooterText,
    defaultCategoryDetailFooterText,
    context,
    variables,
    { allowEmpty: true },
  );

  const button = renderTemplateValue(
    config?.categoryDetailButtonText,
    defaultCategoryDetailButtonText,
    context,
    variables,
    { allowEmpty: false },
  );

  const captionRaw = renderTemplateValue(
    config?.categoryDetailFileCaption ?? null,
    defaultCategoryDetailFileCaption,
    context,
    variables,
    { allowEmpty: true, trimResult: false },
  );

  const caption = captionRaw.trim().length > 0 ? captionRaw.trim() : null;

  return {
    body,
    footer: footer.trim().length > 0 ? footer.trim() : null,
    button,
    fileCaption: caption,
  };
};

export const renderNoCategoryMessage = (
  config: { categoryListEmptyText: string; variables: string[] } | null,
  context: BotTemplateContext,
) => renderTemplateValue(
  config?.categoryListEmptyText,
  defaultCategoryListEmptyText,
  context,
  config?.variables,
  { allowEmpty: false },
);

export const renderAddBalanceReply = (
  config: { addBalanceReplyText: string; variables: string[] } | null,
  context: BotTemplateContext,
) => renderTemplateValue(
  config?.addBalanceReplyText,
  defaultAddBalanceReplyText,
  context,
  config?.variables,
  { allowEmpty: false },
);

export const renderSupportReply = (
  config: { supportReplyText: string; variables: string[] } | null,
  context: BotTemplateContext,
) => renderTemplateValue(
  config?.supportReplyText,
  defaultSupportReplyText,
  context,
  config?.variables,
  { allowEmpty: false },
);
