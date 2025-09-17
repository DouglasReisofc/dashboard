import { NextResponse } from "next/server";

import { getBotMenuConfigForUser } from "lib/bot-config";
import { renderBotMenuText } from "lib/bot-menu";
import { sendBotMenuReply } from "lib/meta";
import { getWebhookByPublicId, recordWebhookEvent } from "lib/webhooks";

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

const replyWithBotMenu = async (webhook: Awaited<ReturnType<typeof getWebhookByPublicId>>, value: ChangeValue) => {
  if (!webhook) {
    return;
  }

  const incomingMessage = findIncomingMessage(value);

  if (!incomingMessage || typeof incomingMessage.from !== "string") {
    return;
  }

  if (incomingMessage.from === value.metadata?.phone_number_id) {
    return;
  }

  const ignoredTypes = new Set(["system", "unknown"]);
  if (incomingMessage.type && ignoredTypes.has(String(incomingMessage.type))) {
    return;
  }

  const botConfig = await getBotMenuConfigForUser(webhook.user_id);
  const contactName = resolveContactName(value, incomingMessage.from);
  const menuText = renderBotMenuText(botConfig?.menuText, botConfig?.variables, {
    contactName,
    contactNumber: incomingMessage.from,
    categoryId: null,
  });

  await sendBotMenuReply({
    webhook,
    to: incomingMessage.from,
    text: menuText,
    imagePath: botConfig?.imagePath ?? null,
  });
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
