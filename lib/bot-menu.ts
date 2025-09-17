export const defaultMenuVariables = [
  "{{nome_cliente}}",
  "{{numero_cliente}}",
  "{{id_categoria}}",
] as const;

export const defaultMenuText = `Olá {{nome_cliente}}! 👋\n\nConfira nosso menu principal:\n1️⃣ - Ver novidades digitais\n2️⃣ - Listar categorias disponíveis\n3️⃣ - Falar com o suporte humano`;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type BotMenuContext = {
  contactName?: string | null;
  contactNumber?: string | null;
  categoryId?: string | null;
};

const resolveReplacement = (token: string, context: BotMenuContext): string => {
  const normalized = token.trim().toLowerCase();

  switch (normalized) {
    case "{{nome_cliente}}":
      return context.contactName?.trim() || "Cliente";
    case "{{numero_cliente}}":
      return context.contactNumber?.trim() || "";
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
  const variables = Array.isArray(rawVariables) && rawVariables.length > 0
    ? rawVariables
    : [...defaultMenuVariables];

  return variables.reduce((currentText, token) => {
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
