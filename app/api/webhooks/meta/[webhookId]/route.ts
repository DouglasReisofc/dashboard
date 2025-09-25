import { NextResponse } from "next/server";

import { getBotMenuConfigForUser } from "lib/bot-config";
import {
  renderAddBalanceReply,
  renderCategoryDetailTemplate,
  renderNoCategoryMessage,
  renderSupportReply,
} from "lib/bot-menu";
import type { BotTemplateContext } from "lib/bot-menu";
import {
  decrementProductResaleLimit,
  findAvailableProductForCategory,
  getCategoriesForUser,
  restoreProductResaleLimit,
} from "lib/catalog";
import {
  debitCustomerBalanceByWhatsapp,
  findCustomerByWhatsappForUser,
  upsertCustomerInteraction,
} from "lib/customers";
import { formatCurrency, formatDateTime } from "lib/format";
import {
  CATEGORY_LIST_NEXT_PREFIX,
  CATEGORY_LIST_ROW_PREFIX,
  CATEGORY_PURCHASE_BUTTON_PREFIX,
  MENU_BUTTON_IDS,
  ADD_BALANCE_OPTION_PREFIX,
  PAYMENT_METHOD_OPTION_PREFIX,
  sendBotMenuReply,
  sendCategoryDetailReply,
  sendCategoryListReply,
  sendAddBalanceOptions,
  sendInteractiveCopyCodeMessage,
  sendInteractiveCtaUrlMessage,
  sendImageFromUrl,
  sendProductFile,
  sendTextMessage,
  sendSupportFinishPrompt,
  SUPPORT_FINISH_BUTTON_ID,
} from "lib/meta";
import {
  createMercadoPagoCheckoutCharge,
  createMercadoPagoPixCharge,
  getMercadoPagoCheckoutConfigForUser,
  getMercadoPagoPixConfigForUser,
  getPaymentMethodSummariesForUser,
  getPixChargeImageUrl,
} from "lib/payments";
import { recordPurchaseHistoryEntry } from "lib/purchase-history";
import { getWebhookByPublicId, recordWebhookEvent } from "lib/webhooks";
import {
  getOrCreateSupportThread,
  getSupportThreadByWhatsapp,
  recordSupportMessage,
  closeSupportThread,
  reopenSupportThread,
  buildSupportThreadSummary,
  serializeSupportMessage,
} from "lib/support";
import { getUserBasicById } from "lib/users";
import { EmailNotConfiguredError, sendEmail } from "lib/email";
import { sendBotProductPurchaseNotification } from "lib/notifications";
import {
  emitPurchaseCreated,
  emitSupportMessageEvent,
  emitSupportThreadUpdate,
  type PurchaseCreatedPayload,
} from "lib/realtime";
import type { CategorySummary } from "types/catalog";
import type { PaymentMethodProvider } from "types/payments";

type WhatsAppInteractiveReply = {
  id?: string | null;
  title?: string | null;
};

type WhatsAppInteractive = {
  type?: string | null;
  button_reply?: WhatsAppInteractiveReply | null;
  list_reply?: WhatsAppInteractiveReply | null;
};

type WhatsAppMedia = {
  id?: string | null;
  mime_type?: string | null;
  filename?: string | null;
  caption?: string | null;
} | null;

type WhatsAppMessage = {
  id?: string | null;
  type?: string | null;
  timestamp?: string | number | null;
  text?: { body?: string | null } | null;
  interactive?: WhatsAppInteractive | null;
  image?: WhatsAppMedia;
  document?: WhatsAppMedia;
  audio?: WhatsAppMedia;
  video?: WhatsAppMedia;
  sticker?: WhatsAppMedia;
};

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

const resolveInteractiveReplyId = (message: WhatsAppMessage | null | undefined) => {
  if (!message || typeof message !== "object") {
    return null;
  }
  if (message.type !== "interactive" || !message.interactive) {
    return null;
  }
  const interactive = message.interactive;
  if (interactive?.type === "button_reply") {
    return interactive.button_reply?.id ?? null;
  }
  if (interactive?.type === "list_reply") {
    return interactive.list_reply?.id ?? null;
  }
  return null;
};

const resolveInteractiveTitle = (message: WhatsAppMessage | null | undefined) => {
  if (!message || typeof message !== "object") {
    return null;
  }
  if (message.type !== "interactive" || !message.interactive) {
    return null;
  }
  const interactive = message.interactive;
  if (interactive?.type === "button_reply") {
    return interactive.button_reply?.title ?? interactive.button_reply?.id ?? null;
  }
  if (interactive?.type === "list_reply") {
    return interactive.list_reply?.title ?? interactive.list_reply?.id ?? null;
  }
  return null;
};

const extractMessageText = (message: WhatsAppMessage | null | undefined) => {
  if (!message || typeof message !== "object") {
    return null;
  }

  switch (message.type) {
    case "text":
      return message.text?.body ?? null;
    case "interactive":
      return resolveInteractiveTitle(message);
    case "image":
      return message.image?.caption ?? null;
    case "document":
      return message.document?.caption ?? null;
    case "audio":
    case "video":
    case "sticker":
      return message[message.type as "audio" | "video" | "sticker"]?.caption ?? message.type ?? null;
    default:
      return null;
  }
};

const simplifyPayload = (message: WhatsAppMessage | null | undefined) => {
  if (!message || typeof message !== "object") {
    return null;
  }

  const base: Record<string, unknown> = {
    id: message.id ?? null,
    type: message.type ?? null,
    timestamp: message.timestamp ?? null,
  };

  if (message.type === "image" && message.image?.id) {
    return {
      ...base,
      mediaId: message.image.id,
      mimeType: message.image.mime_type ?? null,
      caption: message.image.caption ?? null,
      mediaType: "image",
    };
  }
  if (message.type === "document" && message.document?.id) {
    return {
      ...base,
      mediaId: message.document.id,
      mimeType: message.document.mime_type ?? null,
      filename: message.document.filename ?? null,
      caption: message.document.caption ?? null,
      mediaType: "document",
    };
  }
  if (message.type === "audio" && message.audio?.id) {
    return {
      ...base,
      mediaId: message.audio.id,
      mimeType: message.audio.mime_type ?? null,
      mediaType: "audio",
    };
  }
  if (message.type === "video" && message.video?.id) {
    return {
      ...base,
      mediaId: message.video.id,
      mimeType: message.video.mime_type ?? null,
      caption: message.video.caption ?? null,
      mediaType: "video",
    };
  }
  if (message.type === "sticker" && message.sticker?.id) {
    return {
      ...base,
      mediaId: message.sticker.id,
      mediaType: "sticker",
      caption: message.sticker.caption ?? null,
    };
  }
  if (message.type === "interactive") {
    return {
      ...base,
      interactive: message.interactive ?? null,
      selectionTitle: resolveInteractiveTitle(message),
    };
  }

  if (message.type === "text" && message.text?.body) {
    return {
      ...base,
      text: message.text.body,
    };
  }

  try {
    return JSON.parse(JSON.stringify(message));
  } catch {
    return message;
  }
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

  const messageTimestamp = timestampSeconds ? new Date(timestampSeconds * 1000) : new Date();
  const supportThread = await getSupportThreadByWhatsapp(webhook.user_id, recipient);

  if (supportThread && supportThread.status === "open") {
    const interactiveReplyId = resolveInteractiveReplyId(incomingMessage as WhatsAppMessage);
    const messageText = extractMessageText(incomingMessage as WhatsAppMessage);

    const inboundRecord = await recordSupportMessage({
      userId: webhook.user_id,
      whatsappId: recipient,
      direction: "inbound",
      messageType: incomingMessage.type ?? "unknown",
      text: messageText,
      payload: simplifyPayload(incomingMessage as WhatsAppMessage),
      messageId: typeof incomingMessage.id === "string" ? incomingMessage.id : null,
      timestamp: messageTimestamp,
      customerName: contactName ?? null,
      profileName: contactName ?? null,
    });

    const inboundMessage = serializeSupportMessage(inboundRecord.message);
    const inboundSummary = await buildSupportThreadSummary(webhook.user_id, inboundRecord.thread);
    emitSupportMessageEvent({
      userId: webhook.user_id,
      whatsappId: inboundRecord.thread.whatsappId,
      message: inboundMessage,
    });
    emitSupportThreadUpdate({ userId: webhook.user_id, thread: inboundSummary });

    if (interactiveReplyId === SUPPORT_FINISH_BUTTON_ID) {
      const farewell = "Obrigado! Encerramos seu atendimento. Se precisar de algo, retorne a qualquer momento.";
      await sendTextMessage({ webhook, to: recipient, text: farewell });
      const farewellRecord = await recordSupportMessage({
        userId: webhook.user_id,
        whatsappId: recipient,
        direction: "outbound",
        messageType: "text",
        text: farewell,
      });
      const farewellMessage = serializeSupportMessage(farewellRecord.message);
      const farewellSummary = await buildSupportThreadSummary(webhook.user_id, farewellRecord.thread);
      emitSupportMessageEvent({
        userId: webhook.user_id,
        whatsappId: farewellRecord.thread.whatsappId,
        message: farewellMessage,
      });
      emitSupportThreadUpdate({ userId: webhook.user_id, thread: farewellSummary });

      await closeSupportThread(webhook.user_id, recipient);
      const closedThread = await getSupportThreadByWhatsapp(webhook.user_id, recipient);
      if (closedThread) {
        const closedSummary = await buildSupportThreadSummary(webhook.user_id, closedThread);
        emitSupportThreadUpdate({ userId: webhook.user_id, thread: closedSummary });
      }
      await sendMainMenu();
    }

    return;
  }

  let cachedCategories: CategorySummary[] | null = null;
  let botConfigPromise: Promise<Awaited<ReturnType<typeof getBotMenuConfigForUser>>> | null = null;
  let pixConfigPromise: Promise<Awaited<ReturnType<typeof getMercadoPagoPixConfigForUser>>> | null = null;
  let checkoutConfigPromise: Promise<Awaited<ReturnType<typeof getMercadoPagoCheckoutConfigForUser>>> | null = null;
  let paymentMethodSummariesPromise: Promise<Awaited<ReturnType<typeof getPaymentMethodSummariesForUser>>> | null = null;
  let addBalanceMessagePromise: Promise<string> | null = null;

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

  const resolveBotConfig = async () => {
    if (!botConfigPromise) {
      botConfigPromise = getBotMenuConfigForUser(webhook.user_id);
    }

    return botConfigPromise;
  };

  const resolvePixConfig = async () => {
    if (!pixConfigPromise) {
      pixConfigPromise = getMercadoPagoPixConfigForUser(webhook.user_id);
    }

    return pixConfigPromise;
  };

  const resolveCheckoutConfig = async () => {
    if (!checkoutConfigPromise) {
      checkoutConfigPromise = getMercadoPagoCheckoutConfigForUser(webhook.user_id);
    }

    return checkoutConfigPromise;
  };

  const resolvePaymentMethods = async () => {
    if (!paymentMethodSummariesPromise) {
      paymentMethodSummariesPromise = getPaymentMethodSummariesForUser(webhook.user_id);
    }

    return paymentMethodSummariesPromise;
  };

  const resolveAddBalanceMessage = async () => {
    if (!addBalanceMessagePromise) {
      addBalanceMessagePromise = (async () => {
        const botConfig = await resolveBotConfig();
        return renderAddBalanceReply(
          botConfig
            ? { addBalanceReplyText: botConfig.addBalanceReplyText, variables: botConfig.variables }
            : null,
          getContext(),
        );
      })();
    }

    return addBalanceMessagePromise;
  };

  const normalizeAmountOptions = (values: number[]) =>
    values
      .map((value) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric) || numeric <= 0) {
          return null;
        }

        const cents = Math.round(numeric * 100);
        return { amount: numeric, cents };
      })
      .filter((entry): entry is { amount: number; cents: number } => Boolean(entry));

  const sendAmountSelectionForProvider = async (
    provider: PaymentMethodProvider,
    params: {
      message: string;
      normalizedAmounts: Array<{ amount: number; cents: number }>;
      pixConfig: Awaited<ReturnType<typeof getMercadoPagoPixConfigForUser>>;
      checkoutConfig: Awaited<ReturnType<typeof getMercadoPagoCheckoutConfigForUser>>;
    },
  ) => {
    const { message, normalizedAmounts, pixConfig, checkoutConfig } = params;

    const rows = normalizedAmounts.map((entry) => ({
      id: `${ADD_BALANCE_OPTION_PREFIX}${provider}_${entry.cents}`,
      title: formatCurrency(entry.amount),
      description:
        provider === "mercadopago_pix"
          ? `Expira em ${pixConfig.pixExpirationMinutes} min`
          : "Pagamento online via checkout",
    }));

    const footer = provider === "mercadopago_pix"
      ? pixConfig.instructions?.trim()
          ? pixConfig.instructions.trim()
          : pixConfig.pixKey?.trim()
            ? `Chave Pix: ${pixConfig.pixKey.trim()}`
            : null
      : null;

    const header = provider === "mercadopago_pix"
      ? pixConfig.displayName
      : checkoutConfig.displayName;

    await sendAddBalanceOptions({
      webhook,
      to: recipient,
      header,
      body: message,
      footer,
      buttonLabel: "Selecionar valor",
      sectionTitle: "Valores disponíveis",
      rows,
    });
  };

  const getContext = (): BotTemplateContext => ({
    contactName,
    contactNumber: recipient,
    contactBalance: customerBalance,
  });

  const sendNoCategoryMessage = async () => {
    const botConfig = await resolveBotConfig();
    const message = renderNoCategoryMessage(
      botConfig
        ? { categoryListEmptyText: botConfig.categoryListEmptyText, variables: botConfig.variables }
        : null,
      getContext(),
    );

    await sendTextMessage({
      webhook,
      to: recipient,
      text: message,
    });
  };

  const sendMainMenu = async () => {
    const botConfig = await resolveBotConfig();

    await sendBotMenuReply({
      webhook,
      to: recipient,
      config: botConfig,
      context: getContext(),
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
    if (listReplyId.startsWith(PAYMENT_METHOD_OPTION_PREFIX)) {
      const providerRaw = listReplyId.slice(PAYMENT_METHOD_OPTION_PREFIX.length).trim();
      const provider = providerRaw as PaymentMethodProvider;

      if (provider !== "mercadopago_pix" && provider !== "mercadopago_checkout") {
        await sendTextMessage({
          webhook,
          to: recipient,
          text: "Não reconhecemos a forma de pagamento selecionada. Tente novamente pelo menu.",
        });
        await sendMainMenu();
        return;
      }

      const [message, pixConfig, checkoutConfig, methodSummaries] = await Promise.all([
        resolveAddBalanceMessage(),
        resolvePixConfig(),
        resolveCheckoutConfig(),
        resolvePaymentMethods(),
      ]);

      const pixAmounts = normalizeAmountOptions(pixConfig.amountOptions);
      const checkoutAmounts = normalizeAmountOptions(checkoutConfig.amountOptions);
      const amountByProvider: Record<PaymentMethodProvider, Array<{ amount: number; cents: number }>> = {
        mercadopago_pix: pixAmounts,
        mercadopago_checkout: checkoutAmounts,
      };

      const selectedMethod = methodSummaries.find(
        (method) => method.provider === provider && method.isActive && method.isConfigured,
      );

      if (!selectedMethod) {
        await sendTextMessage({
          webhook,
          to: recipient,
          text: "Essa forma de pagamento não está disponível no momento. Escolha outra opção.",
        });
        await sendMainMenu();
        return;
      }

      const normalizedAmounts = amountByProvider[provider] ?? [];

      if (normalizedAmounts.length === 0) {
        await sendTextMessage({
          webhook,
          to: recipient,
          text: `${message}\n\nNenhum valor de recarga foi configurado para esta forma de pagamento.`,
        });
        await sendMainMenu();
        return;
      }

      await sendAmountSelectionForProvider(provider, {
        message,
        normalizedAmounts,
        pixConfig,
        checkoutConfig,
      });

      return;
    }

    if (listReplyId.startsWith(ADD_BALANCE_OPTION_PREFIX)) {
      const remainder = listReplyId.slice(ADD_BALANCE_OPTION_PREFIX.length);
      let provider: PaymentMethodProvider = "mercadopago_pix";
      let amountSegment = remainder;

      const separatorIndex = remainder.lastIndexOf("_");
      if (separatorIndex > 0) {
        const maybeProvider = remainder.slice(0, separatorIndex) as PaymentMethodProvider;
        if (maybeProvider === "mercadopago_pix" || maybeProvider === "mercadopago_checkout") {
          provider = maybeProvider;
          amountSegment = remainder.slice(separatorIndex + 1);
        }
      }

      const cents = Number.parseInt(amountSegment, 10);

      const [pixConfig, checkoutConfig] = await Promise.all([
        resolvePixConfig(),
        resolveCheckoutConfig(),
      ]);

      const normalizedAmounts =
        provider === "mercadopago_pix"
          ? normalizeAmountOptions(pixConfig.amountOptions)
          : normalizeAmountOptions(checkoutConfig.amountOptions);
      const allowedCents = new Set(normalizedAmounts.map((entry) => entry.cents));

      if (
        normalizedAmounts.length === 0 ||
        !Number.isFinite(cents) ||
        cents <= 0 ||
        !allowedCents.has(cents)
      ) {
        await sendTextMessage({
          webhook,
          to: recipient,
          text: "Não reconhecemos o valor selecionado. Escolha uma opção disponível no menu.",
        });
        await sendMainMenu();
        return;
      }

      const amount = cents / 100;

      if (provider === "mercadopago_pix") {
        if (!pixConfig.isActive || !pixConfig.isConfigured) {
          await sendTextMessage({
            webhook,
            to: recipient,
            text: "No momento não conseguimos gerar um Pix automático. Tente novamente em instantes.",
          });
          await sendMainMenu();
          return;
        }

        try {
          const charge = await createMercadoPagoPixCharge({
            userId: webhook.user_id,
            amount,
            customerWhatsapp: recipient,
            customerName: contactName,
            config: pixConfig,
          });

          const expirationText = charge.expiresAt ? formatDateTime(charge.expiresAt) : null;
          const pixKeyLine = pixConfig.pixKey ? `Chave Pix: ${pixConfig.pixKey}` : null;
          const detailLines = [
            `Valor: ${formatCurrency(charge.amount)}`,
            expirationText ? `Expira em: ${expirationText}` : null,
            pixKeyLine,
          ].filter((line): line is string => typeof line === "string" && line.length > 0);

          const summaryBody = [
            "💳 Pagamento Pix",
            detailLines.join("\n"),
            pixConfig.instructions?.trim() || null,
            "Use o botão abaixo para abrir o QR Code e finalizar o pagamento.",
            "O saldo será atualizado automaticamente após a confirmação.",
          ]
            .filter((line): line is string => typeof line === "string" && line.trim().length > 0)
            .join("\n\n");
          const headerImageUrl = charge.qrCodeBase64 ? getPixChargeImageUrl(charge.publicId) : null;

          let summaryDelivered = false;

          if (charge.ticketUrl) {
            await sendInteractiveCtaUrlMessage({
              webhook,
              to: recipient,
              bodyText: summaryBody,
              buttonText: "Abrir pagamento Pix",
              buttonUrl: charge.ticketUrl,
              headerImageUrl,
              headerText: "Pagamento Pix",
            });
            summaryDelivered = true;
          } else if (headerImageUrl) {
            const caption = [
              "💳 Pagamento Pix",
              `Valor: ${formatCurrency(charge.amount)}`,
              expirationText ? `Expira em: ${expirationText}` : null,
            ]
              .filter((line): line is string => typeof line === "string" && line.length > 0)
              .join("\n");

            await sendImageFromUrl({
              webhook,
              to: recipient,
              imageUrl: headerImageUrl,
              caption,
            });
          }

          if (!summaryDelivered) {
            await sendTextMessage({
              webhook,
              to: recipient,
              text: summaryBody,
            });
          }

          if (charge.qrCode) {
            await sendTextMessage({
              webhook,
              to: recipient,
              text: charge.qrCode,
            });

            await sendInteractiveCopyCodeMessage({
              webhook,
              to: recipient,
              bodyText: "Copiar código Pix",
              buttonText: "Copiar código Pix",
              code: charge.qrCode,
            });
          }

          return;
        } catch (pixError) {
          console.error("[Meta Webhook] Falha ao gerar cobrança Pix", pixError);
          await sendTextMessage({
            webhook,
            to: recipient,
            text: "Não foi possível gerar o Pix agora. Tente novamente em alguns minutos.",
          });
          await sendMainMenu();
          return;
        }
      }

      if (provider === "mercadopago_checkout") {
        if (!checkoutConfig.isActive || !checkoutConfig.isConfigured) {
          await sendTextMessage({
            webhook,
            to: recipient,
            text: "O checkout online está indisponível no momento. Escolha outra forma de pagamento.",
          });
          await sendMainMenu();
          return;
        }

        try {
          const charge = await createMercadoPagoCheckoutCharge({
            userId: webhook.user_id,
            amount,
            customerWhatsapp: recipient,
            customerName: contactName,
            config: checkoutConfig,
          });

          const summaryBody = [
            `💳 ${checkoutConfig.displayName}`,
            `Valor: ${formatCurrency(charge.amount)}`,
            "Finalize o pagamento no link abaixo.",
            "O saldo será atualizado automaticamente após a confirmação.",
          ]
            .filter((line): line is string => typeof line === "string" && line.trim().length > 0)
            .join("\n\n");

          if (charge.ticketUrl) {
            await sendInteractiveCtaUrlMessage({
              webhook,
              to: recipient,
              bodyText: summaryBody,
              buttonText: "Abrir pagamento",
              buttonUrl: charge.ticketUrl,
              headerText: checkoutConfig.displayName,
            });
          } else {
            await sendTextMessage({
              webhook,
              to: recipient,
              text: summaryBody,
            });
          }

          return;
        } catch (checkoutError) {
          console.error("[Meta Webhook] Falha ao gerar cobrança de checkout", checkoutError);
          await sendTextMessage({
            webhook,
            to: recipient,
            text: "Não foi possível gerar o pagamento agora. Tente novamente em alguns minutos.",
          });
          await sendMainMenu();
          return;
        }
      }

      await sendTextMessage({
        webhook,
        to: recipient,
        text: "Não reconhecemos a forma de pagamento selecionada. Utilize o menu principal para tentar novamente.",
      });
      await sendMainMenu();
      return;
    }

    if (listReplyId.startsWith(CATEGORY_LIST_NEXT_PREFIX)) {
      const nextPageRaw = listReplyId.slice(CATEGORY_LIST_NEXT_PREFIX.length);
      const nextPage = Number.parseInt(nextPageRaw, 10);
      const categories = await loadActiveCategories();

      if (categories.length === 0) {
        await sendNoCategoryMessage();
        await sendMainMenu();
        return;
      }

      const botConfig = await resolveBotConfig();
      await sendCategoryListReply({
        webhook,
        to: recipient,
        categories: mapCategoriesToEntries(categories),
        page: Number.isFinite(nextPage) && nextPage > 0 ? nextPage : 1,
        config: botConfig,
        context: getContext(),
      });
      return;
    }

    if (listReplyId.startsWith(CATEGORY_LIST_ROW_PREFIX)) {
      const categoryIdRaw = listReplyId.slice(CATEGORY_LIST_ROW_PREFIX.length);
      const categoryId = Number.parseInt(categoryIdRaw, 10);
      const categories = await loadActiveCategories();

      if (categories.length === 0) {
        await sendNoCategoryMessage();
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

      const botConfig = await resolveBotConfig();
      await sendCategoryDetailReply({
        webhook,
        to: recipient,
        category,
        config: botConfig,
        context: {
          ...getContext(),
          categoryId: category.id.toString(),
          categoryName: category.name,
          categoryPrice: category.price,
          categoryDescription: category.description ?? "",
        },
      });
      return;
    }
  }

  if (buttonReplyId) {
    if (buttonReplyId === MENU_BUTTON_IDS.buy) {
      const categories = await loadActiveCategories();

      if (categories.length === 0) {
        await sendNoCategoryMessage();
        await sendMainMenu();
        return;
      }

      const botConfig = await resolveBotConfig();
      await sendCategoryListReply({
        webhook,
        to: recipient,
        categories: mapCategoriesToEntries(categories),
        page: 1,
        config: botConfig,
        context: getContext(),
      });
      return;
    }

    if (buttonReplyId.startsWith(CATEGORY_PURCHASE_BUTTON_PREFIX)) {
      const categoryIdRaw = buttonReplyId.slice(CATEGORY_PURCHASE_BUTTON_PREFIX.length);
      const categoryId = Number.parseInt(categoryIdRaw, 10);

      if (!Number.isFinite(categoryId) || categoryId <= 0) {
        await sendTextMessage({
          webhook,
          to: recipient,
          text: "Não foi possível identificar a categoria selecionada. Tente novamente pelo menu principal.",
        });
        await sendMainMenu();
        return;
      }

      const categories = await loadActiveCategories();

      if (categories.length === 0) {
        await sendNoCategoryMessage();
        await sendMainMenu();
        return;
      }

      const category = categories.find((entry) => entry.id === categoryId && entry.isActive);

      if (!category) {
        await sendTextMessage({
          webhook,
          to: recipient,
          text: "Essa categoria não está mais disponível. Atualize o menu para ver as opções em estoque.",
        });
        await sendMainMenu();
        return;
      }

      const availableProduct = await findAvailableProductForCategory(webhook.user_id, category.id);

      if (!availableProduct) {
        await sendTextMessage({
          webhook,
          to: recipient,
          text: "Todos os produtos dessa categoria foram vendidos. Em breve teremos novas unidades.",
        });
        await sendMainMenu();
        return;
      }

      const reserved = await decrementProductResaleLimit(availableProduct.id);

      if (!reserved) {
        await sendTextMessage({
          webhook,
          to: recipient,
          text: "Não conseguimos reservar esse produto. Atualize o menu e tente novamente.",
        });
        await sendMainMenu();
        return;
      }

      const debitResult = await debitCustomerBalanceByWhatsapp(
        webhook.user_id,
        recipient,
        category.price,
      );

      if (!debitResult.success) {
        await restoreProductResaleLimit(availableProduct.id);

        if (debitResult.reason === "blocked") {
          await sendTextMessage({
            webhook,
            to: recipient,
            text: "Seu acesso está bloqueado. Fale com o suporte para regularizar sua conta.",
          });
          await sendMainMenu();
          return;
        }

        if (debitResult.reason === "insufficient") {
          const currentBalance = debitResult.balance;
          const shortage = Math.max(category.price - currentBalance, 0);
          const shortageMessage = [
            "Saldo insuficiente para concluir a compra.",
            `Valor da categoria: ${formatCurrency(category.price)}`,
            `Seu saldo atual: ${formatCurrency(currentBalance)}`,
            shortage > 0
              ? `Recarregue pelo menos ${formatCurrency(shortage)} para finalizar a compra.`
              : "Adicione saldo para continuar.",
          ].join("\n");

          await sendTextMessage({
            webhook,
            to: recipient,
            text: shortageMessage,
          });
          await sendMainMenu();
          return;
        }

        await sendTextMessage({
          webhook,
          to: recipient,
          text: "Não localizamos seu cadastro ativo. Reenvie uma mensagem para o menu principal e tente novamente.",
        });
        await sendMainMenu();
        return;
      }

      customerBalance = debitResult.balance;

      const purchaseSummary = [
        "✅ Compra confirmada!",
        `Categoria: ${category.name}`,
        `Valor cobrado: ${formatCurrency(category.price)}`,
        `Saldo disponível: ${formatCurrency(customerBalance)}`,
        "",
        category.description?.trim()
          ? `Descrição da categoria:\n${category.description.trim()}`
          : "",
        "Detalhes do produto:",
        availableProduct.details.trim(),
      ]
        .filter(Boolean)
        .join("\n\n");

      await sendTextMessage({
        webhook,
        to: recipient,
        text: purchaseSummary,
      });

      let purchaseEventPayload: PurchaseCreatedPayload["purchase"] | null = null;

      try {
        await recordPurchaseHistoryEntry({
          userId: webhook.user_id,
          customerId: debitResult.customer?.id ?? null,
          customerWhatsapp: recipient,
          customerName:
            debitResult.customer?.displayName
            ?? debitResult.customer?.profileName
            ?? contactName
            ?? null,
          categoryId: category.id,
          categoryName: category.name,
          categoryPrice: category.price,
          categoryDescription: category.description ?? null,
          productId: availableProduct.id,
          productDetails: availableProduct.details,
          productFilePath: availableProduct.filePath,
          metadata: {
            purchaseSummary,
            balanceAfterPurchase: customerBalance,
          },
        });

        purchaseEventPayload = {
          categoryName: category.name,
          categoryPrice: category.price,
          customerName:
            debitResult.customer?.displayName
            ?? debitResult.customer?.profileName
            ?? contactName
            ?? null,
          customerWhatsapp: recipient,
          purchasedAt: new Date().toISOString(),
          productDetails: availableProduct.details,
        };
      } catch (historyError) {
        console.error(
          "[Meta Webhook] Não foi possível registrar o histórico de compra",
          historyError,
        );
      }

      if (purchaseEventPayload) {
        emitPurchaseCreated({
          userId: webhook.user_id,
          purchase: purchaseEventPayload,
        });

        try {
          const owner = await getUserBasicById(webhook.user_id);
          if (owner) {
            await sendBotProductPurchaseNotification({
              userId: owner.id,
              userName: owner.name,
              userEmail: owner.email ?? null,
              categoryName: category.name,
              amount: category.price,
              customerName: purchaseEventPayload.customerName ?? null,
              customerWhatsapp: purchaseEventPayload.customerWhatsapp ?? null,
              customerBalanceAfter: customerBalance,
              productDetails: availableProduct.details,
            });
          }
        } catch (notificationError) {
          console.error(
            "[Meta Webhook] Falha ao notificar compra do bot",
            notificationError,
          );
        }
      }

      if (availableProduct.filePath) {
        const botConfig = await resolveBotConfig();
        const detailTemplate = renderCategoryDetailTemplate(
          botConfig
            ? {
                categoryDetailBodyText: botConfig.categoryDetailBodyText,
                categoryDetailFooterText: botConfig.categoryDetailFooterText,
                categoryDetailButtonText: botConfig.categoryDetailButtonText,
                categoryDetailFileCaption: botConfig.categoryDetailFileCaption,
                variables: botConfig.variables,
              }
            : null,
          {
            ...getContext(),
            categoryId: category.id.toString(),
            categoryName: category.name,
            categoryPrice: category.price,
            categoryDescription: category.description ?? "",
          },
        );

        const caption = detailTemplate.fileCaption ?? `${category.name} - dados complementares`;

        await sendProductFile({
          webhook,
          to: recipient,
          product: availableProduct,
          caption,
        });
      }

      await sendMainMenu();
      return;
    }

    if (buttonReplyId === MENU_BUTTON_IDS.addBalance) {
      const [pixConfig, checkoutConfig, methodSummaries, message] = await Promise.all([
        resolvePixConfig(),
        resolveCheckoutConfig(),
        resolvePaymentMethods(),
        resolveAddBalanceMessage(),
      ]);

      const activeMethods = methodSummaries.filter((method) => method.isActive && method.isConfigured);

      if (activeMethods.length === 0) {
        await sendTextMessage({
          webhook,
          to: recipient,
          text: `${message}\n\nNo momento não há métodos de pagamento disponíveis.`,
        });
        await sendMainMenu();
        return;
      }

      const pixAmounts = normalizeAmountOptions(pixConfig.amountOptions);
      const checkoutAmounts = normalizeAmountOptions(checkoutConfig.amountOptions);
      const amountByProvider: Record<PaymentMethodProvider, Array<{ amount: number; cents: number }>> = {
        mercadopago_pix: pixAmounts,
        mercadopago_checkout: checkoutAmounts,
      };

      const methodsWithAmounts = activeMethods.filter(
        (method) => amountByProvider[method.provider]?.length,
      );

      if (methodsWithAmounts.length === 0) {
        await sendTextMessage({
          webhook,
          to: recipient,
          text: `${message}\n\nNenhum valor de recarga foi configurado.`,
        });
        await sendMainMenu();
        return;
      }

      if (methodsWithAmounts.length === 1) {
        const [method] = methodsWithAmounts;
        await sendAmountSelectionForProvider(method.provider, {
          message,
          normalizedAmounts: amountByProvider[method.provider],
          pixConfig,
          checkoutConfig,
        });
        return;
      }

      const methodRows = methodsWithAmounts.map((method) => ({
        id: `${PAYMENT_METHOD_OPTION_PREFIX}${method.provider}`,
        title: method.displayName,
        description:
          method.provider === "mercadopago_pix"
            ? "Pix com QR Code e copia e cola"
            : "Checkout online com cartão, Pix e boleto",
      }));

      await sendAddBalanceOptions({
        webhook,
        to: recipient,
        header: "Selecione a forma de pagamento",
        body: message,
        footer: null,
        buttonLabel: "Escolher método",
        sectionTitle: "Formas disponíveis",
        rows: methodRows,
      });

      return;
    }

    if (buttonReplyId === MENU_BUTTON_IDS.support) {
      const botConfig = await resolveBotConfig();
      const supportReply = renderSupportReply(
        botConfig
          ? { supportReplyText: botConfig.supportReplyText, variables: botConfig.variables }
          : null,
        getContext(),
      );

      await getOrCreateSupportThread(webhook.user_id, recipient, {
        customerName: contactName ?? null,
        profileName: contactName ?? null,
      });
      await reopenSupportThread(webhook.user_id, recipient);

      const initialRecord = await recordSupportMessage({
        userId: webhook.user_id,
        whatsappId: recipient,
        direction: "inbound",
        messageType: incomingMessage.type ?? "interactive",
        text: resolveInteractiveTitle(incomingMessage as WhatsAppMessage) ?? "Suporte",
        payload: simplifyPayload(incomingMessage as WhatsAppMessage),
        messageId: typeof incomingMessage.id === "string" ? incomingMessage.id : null,
        timestamp: messageTimestamp,
        customerName: contactName ?? null,
        profileName: contactName ?? null,
      });

      const initialMessage = serializeSupportMessage(initialRecord.message);
      const initialSummary = await buildSupportThreadSummary(webhook.user_id, initialRecord.thread);
      emitSupportMessageEvent({
        userId: webhook.user_id,
        whatsappId: initialRecord.thread.whatsappId,
        message: initialMessage,
      });
      emitSupportThreadUpdate({ userId: webhook.user_id, thread: initialSummary });

      await sendTextMessage({
        webhook,
        to: recipient,
        text: supportReply,
      });
      const replyRecord = await recordSupportMessage({
        userId: webhook.user_id,
        whatsappId: recipient,
        direction: "outbound",
        messageType: "text",
        text: supportReply,
      });
      const replyMessage = serializeSupportMessage(replyRecord.message);
      const replySummary = await buildSupportThreadSummary(webhook.user_id, replyRecord.thread);
      emitSupportMessageEvent({
        userId: webhook.user_id,
        whatsappId: replyRecord.thread.whatsappId,
        message: replyMessage,
      });
      emitSupportThreadUpdate({ userId: webhook.user_id, thread: replySummary });

      const finishPrompt = "Quando finalizar, toque no botão abaixo para encerrar o atendimento.";
      await sendSupportFinishPrompt({ webhook, to: recipient, bodyText: finishPrompt });
      const promptRecord = await recordSupportMessage({
        userId: webhook.user_id,
        whatsappId: recipient,
        direction: "outbound",
        messageType: "interactive",
        text: "Encerrar atendimento",
      });
      const promptMessage = serializeSupportMessage(promptRecord.message);
      const promptSummary = await buildSupportThreadSummary(webhook.user_id, promptRecord.thread);
      emitSupportMessageEvent({
        userId: webhook.user_id,
        whatsappId: promptRecord.thread.whatsappId,
        message: promptMessage,
      });
      emitSupportThreadUpdate({ userId: webhook.user_id, thread: promptSummary });

      try {
        const owner = await getUserBasicById(webhook.user_id);
        if (owner?.email) {
          const customerLabel = contactName ? `${contactName} (${recipient})` : recipient;
          const text = `Novo atendimento solicitado por ${customerLabel}. Responda pelo painel do StoreBot.`;
          await sendEmail({
            to: owner.email,
            subject: "Novo atendimento de suporte",
            text,
          });
        }
      } catch (emailError) {
        if (!(emailError instanceof EmailNotConfiguredError)) {
          console.error("[Meta Webhook] Falha ao enviar notificação de suporte", emailError);
        }
      }

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
        webhookId: webhook.id,
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
