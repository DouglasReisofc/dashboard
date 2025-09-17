import { formatCurrency } from "./format";

export const defaultMenuVariables = [
  "{{nome_cliente}}",
  "{{numero_cliente}}",
  "{{saldo_cliente}}",
  "{{id_categoria}}",
] as const;

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

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type BotMenuContext = {
  contactName?: string | null;
  contactNumber?: string | null;
  contactBalance?: number | null;
  categoryId?: string | null;
};

const resolveReplacement = (token: string, context: BotMenuContext): string => {
  const normalized = token.trim().toLowerCase();

  switch (normalized) {
    case "{{nome_cliente}}":
      return context.contactName?.trim() || "Cliente";
    case "{{numero_cliente}}":
      return context.contactNumber?.trim() || "";
    case "{{saldo_cliente}}": {
      const numericBalance = typeof context.contactBalance === "number"
        ? context.contactBalance
        : Number(context.contactBalance ?? 0);

      return formatCurrency(Number.isFinite(numericBalance) ? numericBalance : 0);
    }
    case "{{id_categoria}}":
      return context.categoryId?.trim() || "";
    default:
      return "";
  }
};

export const renderBotMenuText = (
  rawMenuText: string | null | undefined,
  rawVariables: readonly string[] | string[] | null | undefined,
  context: BotMenuContext,
): string => {
  const menuText = (rawMenuText ?? defaultMenuText).trim();
  const customTokens = Array.isArray(rawVariables)
    ? rawVariables.filter((token): token is string => typeof token === "string")
    : [];

  const uniqueTokens = Array.from(new Set([
    ...defaultMenuVariables,
    ...customTokens,
  ]));

  return uniqueTokens.reduce((currentText, token) => {
    if (typeof token !== "string" || token.trim().length === 0) {
      return currentText;
    }

    const replacement = resolveReplacement(token, context);
    if (replacement === undefined) {
      return currentText;
    }

    const pattern = new RegExp(escapeRegExp(token), "gi");
    return currentText.replace(pattern, replacement);
  }, menuText);
};
