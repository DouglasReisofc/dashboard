import { NextResponse } from "next/server";

import { getBotMenuConfigForUser } from "lib/bot-config";
import { renderBotMenuText } from "lib/bot-menu";
import { getCategoriesForUser } from "lib/catalog";
import { findCustomerByWhatsappForUser, upsertCustomerInteraction } from "lib/customers";
import { formatCurrency } from "lib/format";
import {
  CATEGORY_LIST_NEXT_PREFIX,
  CATEGORY_LIST_ROW_PREFIX,
  MENU_BUTTON_IDS,
  sendBotMenuReply,
  sendCategoryListReply,
  sendTextMessage,
} from "lib/meta";
import { getWebhookByPublicId, recordWebhookEvent } from "lib/webhooks";
import type { CategorySummary } from "types/catalog";

type ChangeValue = {
  messaging_product?: string;
  metadata?: { phone_number_id?: string | null };
  contacts?: Array<{
    wa_id?: string;
    profile?: { name?: string } | null;
  }>;
  messages?: Array<{
    from?: string;
    type?: string;
  } & Record<string, unknown>>;
  statuses?: Array<{ status?: string }>;
};

const findIncomingMessage = (value: ChangeValue) => {
  if (!Array.isArray(value.messages)) {
    return null;
  }

  return (
    value.messages.find((message) => typeof message?.from === "string") ?? null
  );
};

const resolveContactName = (value: ChangeValue, waId: string) => {
  if (!Array.isArray(value.contacts)) {
    return null;
  }

  const contact = value.contacts.find((entry) => entry?.wa_id === waId);
  return contact?.profile?.name ?? null;
};

const parseTimestamp = (raw: unknown): number | null => {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }

  if (typeof raw === "string" && raw.trim()) {
    const parsed = Number.parseInt(raw.trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const replyWithBotMenu = async (
  webhook: Awaited<ReturnType<typeof getWebhookByPublicId>>,
  value: ChangeValue,
) => {
  if (!webhook) {
    return;
  }

  const incomingMessage = findIncomingMessage(value);

  if (!incomingMessage || typeof incomingMessage.from !== "string") {
    return;
  }

  const recipient = incomingMessage.from;

  if (recipient === value.metadata?.phone_number_id) {
    return;
  }

  const messageType = typeof incomingMessage.type === "string"
    ? incomingMessage.type.toLowerCase()
    : "";
  const ignoredTypes = new Set(["system", "unknown"]);
  if (messageType && ignoredTypes.has(messageType)) {
    return;
  }

  const contactName = resolveContactName(value, recipient);
  const timestampSeconds = parseTimestamp((incomingMessage as Record<string, unknown>).timestamp);

  try {
    await upsertCustomerInteraction({
      userId: webhook.user_id,
      whatsappId: recipient,
      phoneNumber: recipient,
      profileName: contactName,
      messageTimestamp: timestampSeconds,
    });
  } catch (customerError) {
    console.error("[Meta Webhook] Não foi possível registrar o cliente", customerError);
  }

  let customerBalance = 0;
  try {
    const customer = await findCustomerByWhatsappForUser(webhook.user_id, recipient);
    if (customer) {
      customerBalance = customer.balance;
    }
  } catch (balanceError) {
    console.error("[Meta Webhook] Não foi possível recuperar o saldo do cliente", balanceError);
  }

  let cachedCategories: CategorySummary[] | null = null;
  let botConfigPromise: Promise<Awaited<ReturnType<typeof getBotMenuConfigForUser>>> | null = null;

  const loadActiveCategories = async (): Promise<CategorySummary[]> => {
    if (cachedCategories !== null) {
      return cachedCategories;
    }

    try {
      const categories = await getCategoriesForUser(webhook.user_id);
      cachedCategories = categories.filter((category) => category.isActive);
    } catch (categoryError) {
      console.error("[Meta Webhook] Não foi possível carregar categorias para o menu", categoryError);
      cachedCategories = [];
    }

    return cachedCategories;
  };

  const mapCategoriesToEntries = (categories: CategorySummary[]) => categories.map((category) => ({
    id: Number(category.id),
    name: category.name,
    price: Number(category.price),
  }));

  const noCategoryMessage = "No momento não encontramos categorias ativas para compras. Aguarde novas ofertas ou fale com o suporte.";

  const resolveBotConfig = async () => {
    if (!botConfigPromise) {
      botConfigPromise = getBotMenuConfigForUser(webhook.user_id);
    }

    return botConfigPromise;
  };

  const sendMainMenu = async () => {
    const botConfig = await resolveBotConfig();
    const menuText = renderBotMenuText(botConfig?.menuText, botConfig?.variables, {
      contactName,
      contactNumber: recipient,
      contactBalance: customerBalance,
      categoryId: null,
    });

    await sendBotMenuReply({
      webhook,
      to: recipient,
      text: menuText,
      imagePath: botConfig?.imagePath ?? null,
    });
  };

  const messageRecord = incomingMessage as Record<string, unknown>;
  const interactivePayload = messageRecord.interactive as Record<string, unknown> | undefined;

  let buttonReplyId: string | null = null;
  let listReplyId: string | null = null;

  if (interactivePayload && typeof interactivePayload === "object") {
    const rawInteractiveType = (interactivePayload as { type?: unknown }).type;
    const interactiveType = typeof rawInteractiveType === "string" ? rawInteractiveType : null;

    if (interactiveType === "button_reply") {
      const reply = (interactivePayload as { button_reply?: { id?: string; payload?: string } }).button_reply;
      const rawId = reply?.id ?? reply?.payload ?? null;
      if (typeof rawId === "string" && rawId.trim()) {
        buttonReplyId = rawId.trim();
      }
    } else if (interactiveType === "list_reply") {
      const reply = (interactivePayload as { list_reply?: { id?: string } }).list_reply;
      const rawId = reply?.id ?? null;
      if (typeof rawId === "string" && rawId.trim()) {
        listReplyId = rawId.trim();
      }
    }
  }

  if (!buttonReplyId) {
    if (messageType === "button") {
      const buttonInfo = messageRecord.button as { payload?: string; text?: string } | undefined;
      const rawId = buttonInfo?.payload ?? buttonInfo?.text ?? null;
      if (typeof rawId === "string" && rawId.trim()) {
        buttonReplyId = rawId.trim();
      }
    } else if (messageType === "interactive" && interactivePayload && typeof interactivePayload === "object") {
      const reply = (interactivePayload as { button_reply?: { id?: string; payload?: string } }).button_reply;
      const rawId = reply?.id ?? reply?.payload ?? null;
      if (typeof rawId === "string" && rawId.trim()) {
        buttonReplyId = rawId.trim();
      }
    }
  }

  if (listReplyId) {
    if (listReplyId.startsWith(CATEGORY_LIST_NEXT_PREFIX)) {
      const nextPageRaw = listReplyId.slice(CATEGORY_LIST_NEXT_PREFIX.length);
      const nextPage = Number.parseInt(nextPageRaw, 10);
      const categories = await loadActiveCategories();

      if (categories.length === 0) {
        await sendTextMessage({
          webhook,
          to: recipient,
          text: noCategoryMessage,
        });
        await sendMainMenu();
        return;
      }

      await sendCategoryListReply({
        webhook,
        to: recipient,
        categories: mapCategoriesToEntries(categories),
        page: Number.isFinite(nextPage) && nextPage > 0 ? nextPage : 1,
      });
      return;
    }

    if (listReplyId.startsWith(CATEGORY_LIST_ROW_PREFIX)) {
      const categoryIdRaw = listReplyId.slice(CATEGORY_LIST_ROW_PREFIX.length);
      const categoryId = Number.parseInt(categoryIdRaw, 10);
      const categories = await loadActiveCategories();

      if (categories.length === 0) {
        await sendTextMessage({
          webhook,
          to: recipient,
          text: noCategoryMessage,
        });
        await sendMainMenu();
        return;
      }

      const category = categories.find((entry) => entry.id === categoryId);
      if (!category) {
        await sendTextMessage({
          webhook,
          to: recipient,
          text: "Não conseguimos localizar essa categoria. Atualize o menu principal e tente novamente.",
        });
        await sendMainMenu();
        return;
      }

      const confirmationMessage = [
        `Categoria selecionada: ${category.name}`,
        `Valor unitário: ${formatCurrency(category.price)}`,
        "",
        "Envie a quantidade desejada ou aguarde nosso suporte para finalizar sua compra.",
      ].join("\n");

      await sendTextMessage({
        webhook,
        to: recipient,
        text: confirmationMessage,
      });
      await sendMainMenu();
      return;
    }
  }

  if (buttonReplyId) {
    if (buttonReplyId === MENU_BUTTON_IDS.buy) {
      const categories = await loadActiveCategories();

      if (categories.length === 0) {
        await sendTextMessage({
          webhook,
          to: recipient,
          text: noCategoryMessage,
        });
        await sendMainMenu();
        return;
      }

      await sendCategoryListReply({
        webhook,
        to: recipient,
        categories: mapCategoriesToEntries(categories),
        page: 1,
      });
      return;
    }

    if (buttonReplyId === MENU_BUTTON_IDS.addBalance) {
      await sendTextMessage({
        webhook,
        to: recipient,
        text: "Para adicionar saldo, informe o valor desejado e aguarde o envio das instruções de pagamento por este canal.",
      });
      await sendMainMenu();
      return;
    }

    if (buttonReplyId === MENU_BUTTON_IDS.support) {
      await sendTextMessage({
        webhook,
        to: recipient,
        text: "Nossa equipe de suporte foi acionada. Descreva sua necessidade para que possamos auxiliá-lo imediatamente.",
      });
      await sendMainMenu();
      return;
    }
  }

  await sendMainMenu();
};

export async function GET(
  request: Request,
  context: { params: Promise<{ webhookId: string }> },
) {
  try {
    const { webhookId } = await context.params;
    const webhook = await getWebhookByPublicId(webhookId);

    if (!webhook) {
      return NextResponse.json({ message: "Webhook não encontrado." }, { status: 404 });
    }

    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode");
    const verifyToken = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && challenge && verifyToken === webhook.verify_token) {
      return new Response(challenge, { status: 200 });
    }

    return NextResponse.json({ message: "Parâmetros de verificação inválidos." }, { status: 403 });
  } catch (error) {
    console.error("Erro ao validar webhook", error);
    return NextResponse.json(
      { message: "Não foi possível completar a verificação." },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ webhookId: string }> },
) {
  try {
    const { webhookId } = await context.params;
    const webhook = await getWebhookByPublicId(webhookId);

    if (!webhook) {
      return NextResponse.json({ message: "Webhook não encontrado." }, { status: 404 });
    }

    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json({ message: "Payload inválido." }, { status: 400 });
    }

    const firstEntry = Array.isArray(body.entry) ? body.entry[0] : undefined;
    const firstChange = firstEntry && Array.isArray(firstEntry.changes)
      ? firstEntry.changes[0]
      : undefined;
    const changeValue = (firstChange?.value ?? {}) as ChangeValue;

    const messageType = Array.isArray(changeValue.messages)
      ? changeValue.messages[0]?.type
      : undefined;
    const statusType = Array.isArray(changeValue.statuses)
      ? changeValue.statuses[0]?.status
      : undefined;

    const eventType = messageType ?? statusType ?? body.object ?? null;

    console.info(
      "[Meta Webhook] Evento recebido",
      {
        webhookId: webhook.public_id,
        userId: webhook.user_id,
        eventType,
        timestamp: new Date().toISOString(),
      },
    );
    const prettyPayload = JSON.stringify(body, null, 2);
    console.info("[Meta Webhook] Payload bruto\n%s", prettyPayload);

    await recordWebhookEvent(webhook.id, webhook.user_id, eventType, body);

    try {
      await replyWithBotMenu(webhook, changeValue);
    } catch (sendError) {
      console.error("[Meta Webhook] Falha ao enviar resposta automática", sendError);
    }

    return NextResponse.json({ status: "received" }, { status: 200 });
  } catch (error) {
    console.error("Erro ao processar webhook", error);
    return NextResponse.json(
      { message: "Não foi possível processar o webhook." },
      { status: 500 },
    );
  }
}
