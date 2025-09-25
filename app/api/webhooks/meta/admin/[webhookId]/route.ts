import { NextResponse } from "next/server";

import {
  getAdminWebhookByPublicId,
  recordAdminWebhookEvent,
} from "lib/admin-webhooks";
import {
  getAdminBotSession,
  removeAdminBotSession,
  touchAdminBotSession,
  upsertAdminBotSession,
  updateAdminBotSessionFlow,
} from "lib/admin-bot-sessions";
import {
  ADMIN_CATEGORY_ACTION_LIST_IDS,
  ADMIN_CATEGORY_BUTTON_IDS,
  ADMIN_CATEGORY_LIST_BACK_ID,
  ADMIN_FLOW_BUTTON_IDS,
  ADMIN_MENU_BUTTON_IDS,
  ADMIN_PANEL_LIST_IDS,
  ADMIN_SUBSCRIPTION_BUTTON_IDS,
  ADMIN_CUSTOMER_ACTION_LIST_IDS,
  ADMIN_CUSTOMER_BUTTON_IDS,
  ADMIN_CUSTOMER_EDIT_OPTION_IDS,
  parseAdminCategoryNextPage,
  parseAdminCategoryPriceNextPage,
  parseAdminCategoryPriceRowId,
  parseAdminCategoryRenameNextPage,
  parseAdminCategoryRenameRowId,
  parseAdminCategoryRowId,
  parseAdminCategorySkuNextPage,
  parseAdminCategorySkuRowId,
  parseAdminPlanRowId,
  sendAdminCategoryActionsMenu,
  sendAdminCategoryDetails,
  sendAdminCategoryInputPrompt,
  sendAdminCategoryList,
  sendAdminCategorySelectionList,
  sendAdminCategoryUpdateConfirmation,
  sendAdminCustomerActionsMenu,
  sendAdminCustomerBalancePrompt,
  sendAdminCustomerCsv,
  sendAdminCustomerEditMenu,
  sendAdminCustomerLookupPrompt,
  sendAdminCustomerNamePrompt,
  sendAdminCustomerUpdateConfirmation,
  sendAdminMainMenu,
  sendAdminPanelMenu,
  sendAdminPlanDetails,
  sendAdminPlanList,
  sendAdminPlanPayment,
  sendAdminRegistrationMissingMessage,
  sendAdminSubscriptionMenu,
  sendAdminSupportMessage,
  sendAdminUnknownOptionMessage,
} from "lib/admin-bot";
import { getAdminBotConfig } from "lib/admin-bot-config";
import { getCategoryByIdForUser, updateCategory } from "lib/catalog";
import {
  findCustomerByPhoneForUser,
  findCustomerByWhatsappForUser,
  getCustomerByIdForUser,
  updateCustomerForUser,
  creditCustomerBalanceByWhatsapp,
  debitCustomerBalanceByWhatsapp,
} from "lib/customers";
import { getAllSubscriptionPlans, getUserPlanStatus } from "lib/plans";
import { formatCurrency } from "lib/format";
import { findActiveUserByWhatsappId, getSessionUserById } from "lib/users";
import { sendTextMessage } from "lib/meta";
import type { SessionUser } from "types/auth";

const findIncomingMessage = (changeValue: Record<string, unknown>) => {
  const messages = Array.isArray(changeValue.messages) ? changeValue.messages : null;
  if (!messages?.length) {
    return null;
  }

  return messages.find((message) => typeof (message as { from?: unknown }).from === "string") ?? null;
};

const resolveInteractiveIds = (message: Record<string, unknown>) => {
  let buttonReplyId: string | null = null;
  let listReplyId: string | null = null;

  const interactive = message.interactive as Record<string, unknown> | undefined;
  const type = typeof interactive?.type === "string" ? interactive?.type : null;

  if (type === "button_reply") {
    const reply = interactive?.button_reply as { id?: string; payload?: string } | undefined;
    const rawId = reply?.id ?? reply?.payload;
    if (typeof rawId === "string" && rawId.trim()) {
      buttonReplyId = rawId.trim();
    }
  } else if (type === "list_reply") {
    const reply = interactive?.list_reply as { id?: string } | undefined;
    const rawId = reply?.id;
    if (typeof rawId === "string" && rawId.trim()) {
      listReplyId = rawId.trim();
    }
  }

  if (!buttonReplyId && message.type === "button") {
    const button = message.button as { payload?: string; text?: string } | undefined;
    const rawId = button?.payload ?? button?.text;
    if (typeof rawId === "string" && rawId.trim()) {
      buttonReplyId = rawId.trim();
    }
  }

  return { buttonReplyId, listReplyId };
};

const sanitizeWhatsappId = (value: string) => value.replace(/[^0-9]/g, "");

const sanitizeNameInput = (value: string) => {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length < 2) {
    return null;
  }
  return trimmed.slice(0, 80);
};

const parsePriceInput = (value: string) => {
  const cleaned = value.replace(/[^0-9.,]/g, "").replace(/,/g, ".");
  if (!cleaned) {
    return null;
  }

  const parts = cleaned.split(".");
  let normalized = cleaned;
  if (parts.length > 2) {
    const decimal = parts.pop() ?? "";
    const integer = parts.join("");
    normalized = `${integer}.${decimal}`;
  }

  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(0, Math.round(parsed * 100) / 100);
};

const sanitizeSkuInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const cleaned = trimmed.replace(/[^a-z0-9_-]/gi, "").toUpperCase();
  if (!cleaned) {
    return null;
  }

  return cleaned.slice(0, 32);
};

const normalizeCustomerPhoneInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const digits = trimmed.replace(/[^0-9]/g, "");
  if (!digits) {
    return null;
  }

  if (trimmed.trim().startsWith("+")) {
    return `+${digits}`;
  }

  return digits;
};

const parseBalanceDeltaInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replace(/,/g, ".").replace(/\s+/g, "");
  const signChar = normalized[0];
  const hasExplicitSign = signChar === "+" || signChar === "-";
  const numericPart = hasExplicitSign ? normalized.slice(1) : normalized;
  if (!numericPart) {
    return null;
  }

  const parsed = Number.parseFloat(numericPart);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  const valueWithSign = hasExplicitSign && signChar === "-" ? -parsed : parsed;
  return Math.round(valueWithSign * 100) / 100;
};

const resolveSessionUser = async (
  session: Awaited<ReturnType<typeof getAdminBotSession>>,
): Promise<SessionUser | null> => {
  if (!session) {
    return null;
  }

  const user = await getSessionUserById(session.userId);
  if (!user || !user.isActive) {
    await removeAdminBotSession(session.whatsappId);
    return null;
  }

  return user;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ webhookId: string }> },
) {
  try {
    const { webhookId } = await context.params;
    const webhook = await getAdminWebhookByPublicId(webhookId);

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
    console.error("Erro ao validar webhook administrativo", error);
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
    const webhook = await getAdminWebhookByPublicId(webhookId);

    if (!webhook) {
      return NextResponse.json({ message: "Webhook não encontrado." }, { status: 404 });
    }

    const credentials = {
      access_token: webhook.access_token ?? null,
      phone_number_id: webhook.phone_number_id ?? null,
    };

    const config = await getAdminBotConfig();

    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json({ message: "Payload inválido." }, { status: 400 });
    }

    const entry = Array.isArray(body.entry) ? body.entry[0] : undefined;
    const change = entry && Array.isArray(entry.changes) ? entry.changes[0] : undefined;
    const value = (change?.value ?? {}) as Record<string, unknown>;

    const messages = Array.isArray(value.messages) ? value.messages : [];
    const statuses = Array.isArray(value.statuses) ? value.statuses : [];

    const messageType = messages[0]?.type ?? null;
    const statusType = statuses[0]?.status ?? null;

    await recordAdminWebhookEvent(webhook.id, messageType ?? statusType ?? null, body);

    const incomingMessage = findIncomingMessage(value) as Record<string, unknown> | null;

    if (!incomingMessage) {
      return NextResponse.json({ ok: true });
    }

    const recipientRaw = incomingMessage.from as string | undefined;
    if (!recipientRaw) {
      return NextResponse.json({ ok: true });
    }

    const recipient = recipientRaw.trim();

    if (!recipient || recipient === value.metadata?.phone_number_id) {
      return NextResponse.json({ ok: true });
    }

    const normalizedRecipient = sanitizeWhatsappId(recipient);
    if (!normalizedRecipient) {
      return NextResponse.json({ ok: true });
    }

    let session = await getAdminBotSession(normalizedRecipient);
    let sessionUser: SessionUser | null = await resolveSessionUser(session);

    if (!sessionUser) {
      const user = await findActiveUserByWhatsappId(recipient);

      if (!user) {
        await sendAdminRegistrationMissingMessage({ webhook: credentials, to: recipient });
        return NextResponse.json({ ok: true });
      }

      session = await upsertAdminBotSession(normalizedRecipient, user.id);
      sessionUser = user;
      await sendAdminMainMenu({ webhook: credentials, to: recipient, user, config });
      return NextResponse.json({ ok: true });
    }

    const interactiveIds = resolveInteractiveIds(incomingMessage);
    const buttonReplyId = interactiveIds.buttonReplyId;
    const listReplyId = interactiveIds.listReplyId;

    if (buttonReplyId) {
      let handled = false;

      switch (buttonReplyId) {
        case ADMIN_MENU_BUTTON_IDS.panel: {
          await updateAdminBotSessionFlow(recipient, null);
          if (session) {
            session = { ...session, flowState: null };
          }
          await sendAdminPanelMenu({ webhook: credentials, to: recipient });
          handled = true;
          break;
        }
        case ADMIN_MENU_BUTTON_IDS.subscription: {
          await sendAdminSubscriptionMenu({
            webhook: credentials,
            to: recipient,
            user: sessionUser,
            config,
          });
          handled = true;
          break;
        }
        case ADMIN_MENU_BUTTON_IDS.support: {
          await sendAdminSupportMessage({ webhook: credentials, to: recipient });
          handled = true;
          break;
        }
        case ADMIN_SUBSCRIPTION_BUTTON_IDS.renew: {
          const status = await getUserPlanStatus(sessionUser.id);
          if (!status.plan) {
            await sendAdminSubscriptionMenu({
              webhook: credentials,
              to: recipient,
              user: sessionUser,
              config,
            });
            handled = true;
            break;
          }

          await sendAdminPlanPayment({
            webhook: credentials,
            to: recipient,
            user: sessionUser,
            plan: status.plan,
          });
          handled = true;
          break;
        }
        case ADMIN_SUBSCRIPTION_BUTTON_IDS.change:
        case ADMIN_SUBSCRIPTION_BUTTON_IDS.start: {
          await sendAdminPlanList({ webhook: credentials, to: recipient, config });
          handled = true;
          break;
        }
        case ADMIN_SUBSCRIPTION_BUTTON_IDS.details: {
          const status = await getUserPlanStatus(sessionUser.id);
          await sendAdminPlanDetails({
            webhook: credentials,
            to: recipient,
            status,
            config,
          });
          handled = true;
          break;
        }
        case ADMIN_FLOW_BUTTON_IDS.cancel: {
          const previousFlow = session?.flowState ?? null;
          await updateAdminBotSessionFlow(recipient, null);
          if (session) {
            session = { ...session, flowState: null };
          }

          await sendTextMessage({
            webhook: credentials,
            to: recipient,
            text: "Operação cancelada. Escolha outra opção para continuar.",
          });

          if (previousFlow?.name?.startsWith("category_")) {
            await sendAdminCategoryActionsMenu({ webhook: credentials, to: recipient });
          } else if (previousFlow?.name === "customer_lookup_input") {
            await sendAdminCustomerActionsMenu({ webhook: credentials, to: recipient });
          } else if (
            previousFlow?.name === "customer_edit_balance_input"
            || previousFlow?.name === "customer_edit_name_input"
            || previousFlow?.name === "customer_edit_menu"
          ) {
            const customerId = previousFlow.customerId;
            const customerRow = await getCustomerByIdForUser(sessionUser.id, customerId);
            if (customerRow) {
              const customerSummary = await findCustomerByWhatsappForUser(
                sessionUser.id,
                customerRow.whatsapp_id,
              );

              if (customerSummary) {
                const nextFlow = { name: "customer_edit_menu" as const, customerId };
                await updateAdminBotSessionFlow(recipient, nextFlow);
                if (session) {
                  session = { ...session, flowState: nextFlow };
                }
                await sendAdminCustomerEditMenu({
                  webhook: credentials,
                  to: recipient,
                  customer: customerSummary,
                });
                handled = true;
                break;
              }
            }

            await sendAdminCustomerActionsMenu({ webhook: credentials, to: recipient });
          } else {
            await sendAdminMainMenu({
              webhook: credentials,
              to: recipient,
              user: sessionUser,
              config,
            });
          }

          handled = true;
          break;
        }
        case ADMIN_CATEGORY_BUTTON_IDS.backToActions: {
          await updateAdminBotSessionFlow(recipient, null);
          if (session) {
            session = { ...session, flowState: null };
          }
          await sendAdminCategoryActionsMenu({ webhook: credentials, to: recipient });
          handled = true;
          break;
        }
        case ADMIN_CUSTOMER_BUTTON_IDS.backToActions: {
          await updateAdminBotSessionFlow(recipient, null);
          if (session) {
            session = { ...session, flowState: null };
          }
          await sendAdminCustomerActionsMenu({ webhook: credentials, to: recipient });
          handled = true;
          break;
        }
        default: {
          await sendAdminUnknownOptionMessage({ webhook: credentials, to: recipient });
          handled = true;
          break;
        }
      }

      if (handled) {
        await touchAdminBotSession(normalizedRecipient);
        return NextResponse.json({ ok: true });
      }
    }

    if (listReplyId) {
      if (listReplyId === ADMIN_PANEL_LIST_IDS.categories) {
        await updateAdminBotSessionFlow(recipient, null);
        if (session) {
          session = { ...session, flowState: null };
        }
        await sendAdminCategoryActionsMenu({ webhook: credentials, to: recipient });
        await touchAdminBotSession(normalizedRecipient);
        return NextResponse.json({ ok: true });
      }

      if (listReplyId === ADMIN_PANEL_LIST_IDS.customers) {
        await updateAdminBotSessionFlow(recipient, null);
        if (session) {
          session = { ...session, flowState: null };
        }
        await sendAdminCustomerActionsMenu({ webhook: credentials, to: recipient });
        await touchAdminBotSession(normalizedRecipient);
        return NextResponse.json({ ok: true });
      }

      if (listReplyId === ADMIN_PANEL_LIST_IDS.products) {
        await updateAdminBotSessionFlow(recipient, null);
        if (session) {
          session = { ...session, flowState: null };
        }
        await sendTextMessage({
          webhook: credentials,
          to: recipient,
          text: "Gerenciar produtos pelo bot estará disponível em breve. Por enquanto, use o painel web para editar o catálogo.",
        });
        await sendAdminPanelMenu({ webhook: credentials, to: recipient });
        await touchAdminBotSession(normalizedRecipient);
        return NextResponse.json({ ok: true });
      }

      if (listReplyId === ADMIN_PANEL_LIST_IDS.back) {
        await updateAdminBotSessionFlow(recipient, null);
        if (session) {
          session = { ...session, flowState: null };
        }
        await sendAdminMainMenu({
          webhook: credentials,
          to: recipient,
          user: sessionUser,
          config,
        });
        await touchAdminBotSession(normalizedRecipient);
        return NextResponse.json({ ok: true });
      }

      if (listReplyId === ADMIN_CATEGORY_ACTION_LIST_IDS.list) {
        const result = await sendAdminCategoryList({
          webhook: credentials,
          to: recipient,
          userId: sessionUser.id,
          page: 1,
        });
        await touchAdminBotSession(normalizedRecipient);
        return NextResponse.json({ ok: true, page: result.page });
      }

      if (listReplyId === ADMIN_CATEGORY_ACTION_LIST_IDS.rename) {
        await updateAdminBotSessionFlow(recipient, null);
        if (session) {
          session = { ...session, flowState: null };
        }
        await sendAdminCategorySelectionList({
          webhook: credentials,
          to: recipient,
          userId: sessionUser.id,
          mode: "rename",
          page: 1,
        });
        await touchAdminBotSession(normalizedRecipient);
        return NextResponse.json({ ok: true });
      }

      if (listReplyId === ADMIN_CATEGORY_ACTION_LIST_IDS.price) {
        await updateAdminBotSessionFlow(recipient, null);
        if (session) {
          session = { ...session, flowState: null };
        }
        await sendAdminCategorySelectionList({
          webhook: credentials,
          to: recipient,
          userId: sessionUser.id,
          mode: "price",
          page: 1,
        });
        await touchAdminBotSession(normalizedRecipient);
        return NextResponse.json({ ok: true });
      }

      if (listReplyId === ADMIN_CATEGORY_ACTION_LIST_IDS.sku) {
        await updateAdminBotSessionFlow(recipient, null);
        if (session) {
          session = { ...session, flowState: null };
        }
        await sendAdminCategorySelectionList({
          webhook: credentials,
          to: recipient,
          userId: sessionUser.id,
          mode: "sku",
          page: 1,
        });
        await touchAdminBotSession(normalizedRecipient);
        return NextResponse.json({ ok: true });
      }

      if (listReplyId === ADMIN_CATEGORY_ACTION_LIST_IDS.back) {
        await updateAdminBotSessionFlow(recipient, null);
        if (session) {
          session = { ...session, flowState: null };
        }
        await sendAdminPanelMenu({ webhook: credentials, to: recipient });
        await touchAdminBotSession(normalizedRecipient);
        return NextResponse.json({ ok: true });
      }

      if (listReplyId === ADMIN_CUSTOMER_ACTION_LIST_IDS.list) {
        await sendAdminCustomerCsv({
          webhook: credentials,
          to: recipient,
          userId: sessionUser.id,
        });
        await sendAdminCustomerActionsMenu({ webhook: credentials, to: recipient });
        await touchAdminBotSession(normalizedRecipient);
        return NextResponse.json({ ok: true });
      }

      if (listReplyId === ADMIN_CUSTOMER_ACTION_LIST_IDS.edit) {
        const flow = { name: "customer_lookup_input" as const, mode: "edit" as const };
        await updateAdminBotSessionFlow(recipient, flow);
        if (session) {
          session = { ...session, flowState: flow };
        }
        await sendAdminCustomerLookupPrompt({ webhook: credentials, to: recipient });
        await touchAdminBotSession(normalizedRecipient);
        return NextResponse.json({ ok: true });
      }

      if (listReplyId === ADMIN_CUSTOMER_ACTION_LIST_IDS.back) {
        await updateAdminBotSessionFlow(recipient, null);
        if (session) {
          session = { ...session, flowState: null };
        }
        await sendAdminPanelMenu({ webhook: credentials, to: recipient });
        await touchAdminBotSession(normalizedRecipient);
        return NextResponse.json({ ok: true });
      }

      if (listReplyId === ADMIN_CUSTOMER_EDIT_OPTION_IDS.back) {
        await updateAdminBotSessionFlow(recipient, null);
        if (session) {
          session = { ...session, flowState: null };
        }
        await sendAdminCustomerActionsMenu({ webhook: credentials, to: recipient });
        await touchAdminBotSession(normalizedRecipient);
        return NextResponse.json({ ok: true });
      }

      if (
        listReplyId === ADMIN_CUSTOMER_EDIT_OPTION_IDS.balance
        || listReplyId === ADMIN_CUSTOMER_EDIT_OPTION_IDS.name
        || listReplyId === ADMIN_CUSTOMER_EDIT_OPTION_IDS.toggleBlock
      ) {
        const currentFlow = session?.flowState;
        if (currentFlow?.name === "customer_edit_menu") {
          const customerRow = await getCustomerByIdForUser(sessionUser.id, currentFlow.customerId);
          if (!customerRow) {
            await sendTextMessage({
              webhook: credentials,
              to: recipient,
              text: "Não encontramos esse cliente. Tente novamente.",
            });
            await sendAdminCustomerActionsMenu({ webhook: credentials, to: recipient });
            await touchAdminBotSession(normalizedRecipient);
            return NextResponse.json({ ok: true });
          }

          const customerSummary = await findCustomerByWhatsappForUser(
            sessionUser.id,
            customerRow.whatsapp_id,
          );

          if (!customerSummary) {
            await sendTextMessage({
              webhook: credentials,
              to: recipient,
              text: "Não encontramos esse cliente. Tente novamente.",
            });
            await sendAdminCustomerActionsMenu({ webhook: credentials, to: recipient });
            await touchAdminBotSession(normalizedRecipient);
            return NextResponse.json({ ok: true });
          }

          if (listReplyId === ADMIN_CUSTOMER_EDIT_OPTION_IDS.balance) {
            const flow = { name: "customer_edit_balance_input" as const, customerId: currentFlow.customerId };
            await updateAdminBotSessionFlow(recipient, flow);
            if (session) {
              session = { ...session, flowState: flow };
            }
            await sendAdminCustomerBalancePrompt({
              webhook: credentials,
              to: recipient,
              customer: customerSummary,
            });
            await touchAdminBotSession(normalizedRecipient);
            return NextResponse.json({ ok: true });
          }

          if (listReplyId === ADMIN_CUSTOMER_EDIT_OPTION_IDS.name) {
            const flow = { name: "customer_edit_name_input" as const, customerId: currentFlow.customerId };
            await updateAdminBotSessionFlow(recipient, flow);
            if (session) {
              session = { ...session, flowState: flow };
            }
            await sendAdminCustomerNamePrompt({
              webhook: credentials,
              to: recipient,
              customer: customerSummary,
            });
            await touchAdminBotSession(normalizedRecipient);
            return NextResponse.json({ ok: true });
          }

          if (listReplyId === ADMIN_CUSTOMER_EDIT_OPTION_IDS.toggleBlock) {
            await updateCustomerForUser(sessionUser.id, customerSummary.id, {
              displayName: customerSummary.displayName,
              balance: customerSummary.balance,
              isBlocked: !customerSummary.isBlocked,
              notes: customerSummary.notes,
            });

            const refreshed = await findCustomerByWhatsappForUser(
              sessionUser.id,
              customerRow.whatsapp_id,
            );

            if (refreshed) {
              const nextFlow = { name: "customer_edit_menu" as const, customerId: refreshed.id };
              await updateAdminBotSessionFlow(recipient, nextFlow);
              if (session) {
                session = { ...session, flowState: nextFlow };
              }
              await sendAdminCustomerUpdateConfirmation({
                webhook: credentials,
                to: recipient,
                customer: refreshed,
                message: refreshed.isBlocked
                  ? "Cliente banido com sucesso."
                  : "Cliente liberado para interações.",
              });
              await touchAdminBotSession(normalizedRecipient);
              return NextResponse.json({ ok: true });
            }

            await sendAdminCustomerActionsMenu({ webhook: credentials, to: recipient });
            await touchAdminBotSession(normalizedRecipient);
            return NextResponse.json({ ok: true });
          }
        }
      }

      if (listReplyId === ADMIN_CATEGORY_LIST_BACK_ID) {
        await updateAdminBotSessionFlow(recipient, null);
        if (session) {
          session = { ...session, flowState: null };
        }
        await sendAdminCategoryActionsMenu({ webhook: credentials, to: recipient });
        await touchAdminBotSession(normalizedRecipient);
        return NextResponse.json({ ok: true });
      }

      const nextPage = parseAdminCategoryNextPage(listReplyId);
      if (nextPage !== null) {
        await sendAdminCategoryList({
          webhook: credentials,
          to: recipient,
          userId: sessionUser.id,
          page: nextPage,
        });
        await touchAdminBotSession(normalizedRecipient);
        return NextResponse.json({ ok: true });
      }

      const renameNextPage = parseAdminCategoryRenameNextPage(listReplyId);
      if (renameNextPage !== null) {
        await sendAdminCategorySelectionList({
          webhook: credentials,
          to: recipient,
          userId: sessionUser.id,
          mode: "rename",
          page: renameNextPage,
        });
        await touchAdminBotSession(normalizedRecipient);
        return NextResponse.json({ ok: true });
      }

      const priceNextPage = parseAdminCategoryPriceNextPage(listReplyId);
      if (priceNextPage !== null) {
        await sendAdminCategorySelectionList({
          webhook: credentials,
          to: recipient,
          userId: sessionUser.id,
          mode: "price",
          page: priceNextPage,
        });
        await touchAdminBotSession(normalizedRecipient);
        return NextResponse.json({ ok: true });
      }

      const skuNextPage = parseAdminCategorySkuNextPage(listReplyId);
      if (skuNextPage !== null) {
        await sendAdminCategorySelectionList({
          webhook: credentials,
          to: recipient,
          userId: sessionUser.id,
          mode: "sku",
          page: skuNextPage,
        });
        await touchAdminBotSession(normalizedRecipient);
        return NextResponse.json({ ok: true });
      }

      const categoryId = parseAdminCategoryRowId(listReplyId);
      if (categoryId !== null) {
        await sendAdminCategoryDetails({
          webhook: credentials,
          to: recipient,
          userId: sessionUser.id,
          categoryId,
        });
        await touchAdminBotSession(normalizedRecipient);
        return NextResponse.json({ ok: true });
      }

      const renameCategoryId = parseAdminCategoryRenameRowId(listReplyId);
      if (renameCategoryId !== null) {
        const category = await getCategoryByIdForUser(sessionUser.id, renameCategoryId);
        if (!category) {
          await sendTextMessage({
            webhook: credentials,
            to: recipient,
            text: "Não encontramos essa categoria. Atualize a lista e tente novamente.",
          });
          await sendAdminCategorySelectionList({
            webhook: credentials,
            to: recipient,
            userId: sessionUser.id,
            mode: "rename",
            page: 1,
          });
          await touchAdminBotSession(normalizedRecipient);
          return NextResponse.json({ ok: true });
        }

        const flow = { name: "category_rename_input" as const, categoryId: renameCategoryId };
        await updateAdminBotSessionFlow(recipient, flow);
        if (session) {
          session = { ...session, flowState: flow };
        }
        await sendAdminCategoryInputPrompt({
          webhook: credentials,
          to: recipient,
          category,
          mode: "rename",
        });
        await touchAdminBotSession(normalizedRecipient);
        return NextResponse.json({ ok: true });
      }

      const priceCategoryId = parseAdminCategoryPriceRowId(listReplyId);
      if (priceCategoryId !== null) {
        const category = await getCategoryByIdForUser(sessionUser.id, priceCategoryId);
        if (!category) {
          await sendTextMessage({
            webhook: credentials,
            to: recipient,
            text: "Não encontramos essa categoria. Atualize a lista e tente novamente.",
          });
          await sendAdminCategorySelectionList({
            webhook: credentials,
            to: recipient,
            userId: sessionUser.id,
            mode: "price",
            page: 1,
          });
          await touchAdminBotSession(normalizedRecipient);
          return NextResponse.json({ ok: true });
        }

        const flow = { name: "category_price_input" as const, categoryId: priceCategoryId };
        await updateAdminBotSessionFlow(recipient, flow);
        if (session) {
          session = { ...session, flowState: flow };
        }
        await sendAdminCategoryInputPrompt({
          webhook: credentials,
          to: recipient,
          category,
          mode: "price",
        });
        await touchAdminBotSession(normalizedRecipient);
        return NextResponse.json({ ok: true });
      }

      const skuCategoryId = parseAdminCategorySkuRowId(listReplyId);
      if (skuCategoryId !== null) {
        const category = await getCategoryByIdForUser(sessionUser.id, skuCategoryId);
        if (!category) {
          await sendTextMessage({
            webhook: credentials,
            to: recipient,
            text: "Não encontramos essa categoria. Atualize a lista e tente novamente.",
          });
          await sendAdminCategorySelectionList({
            webhook: credentials,
            to: recipient,
            userId: sessionUser.id,
            mode: "sku",
            page: 1,
          });
          await touchAdminBotSession(normalizedRecipient);
          return NextResponse.json({ ok: true });
        }

        const flow = { name: "category_sku_input" as const, categoryId: skuCategoryId };
        await updateAdminBotSessionFlow(recipient, flow);
        if (session) {
          session = { ...session, flowState: flow };
        }
        await sendAdminCategoryInputPrompt({
          webhook: credentials,
          to: recipient,
          category,
          mode: "sku",
        });
        await touchAdminBotSession(normalizedRecipient);
        return NextResponse.json({ ok: true });
      }

      const planId = parseAdminPlanRowId(listReplyId);
      if (planId !== null) {
        const plans = (await getAllSubscriptionPlans()).filter((plan) => plan.isActive);
        const plan = plans.find((item) => item.id === planId);

        if (plan) {
          await sendAdminPlanPayment({
            webhook: credentials,
            to: recipient,
            user: sessionUser,
            plan,
          });
        } else {
          await sendAdminUnknownOptionMessage({ webhook: credentials, to: recipient });
        }

        await touchAdminBotSession(normalizedRecipient);
        return NextResponse.json({ ok: true });
      }

      await sendAdminUnknownOptionMessage({ webhook: credentials, to: recipient });
      await touchAdminBotSession(normalizedRecipient);
      return NextResponse.json({ ok: true });
    }

    const currentMessageType = typeof (incomingMessage.type as string | undefined) === "string"
      ? (incomingMessage.type as string)
      : null;

    if (!buttonReplyId && !listReplyId && session?.flowState && currentMessageType === "text") {
      const textPayload = incomingMessage.text as { body?: string } | undefined;
      const rawBody = typeof textPayload?.body === "string" ? textPayload.body.trim() : "";

      if (rawBody) {
        const flow = session.flowState;

        if (
          flow.name === "category_rename_input"
          || flow.name === "category_price_input"
          || flow.name === "category_sku_input"
        ) {
          const category = await getCategoryByIdForUser(sessionUser.id, flow.categoryId);

          if (!category) {
            await updateAdminBotSessionFlow(recipient, null);
            if (session) {
              session = { ...session, flowState: null };
            }
            await sendTextMessage({
              webhook: credentials,
              to: recipient,
              text: "Não encontramos essa categoria. Voltando ao menu de categorias.",
            });
            await sendAdminCategoryActionsMenu({ webhook: credentials, to: recipient });
            await touchAdminBotSession(normalizedRecipient);
            return NextResponse.json({ ok: true });
          }

          if (flow.name === "category_rename_input") {
            const sanitized = sanitizeNameInput(rawBody);
            if (!sanitized) {
              await sendTextMessage({
                webhook: credentials,
                to: recipient,
                text: "Informe um nome com pelo menos 2 caracteres.",
              });
              await sendAdminCategoryInputPrompt({
                webhook: credentials,
                to: recipient,
                category,
                mode: "rename",
              });
              await touchAdminBotSession(normalizedRecipient);
              return NextResponse.json({ ok: true });
            }

            await updateCategory(category.id, {
              name: sanitized,
              price: category.price,
              sku: category.sku,
              description: category.description,
              imagePath: category.imagePath,
              isActive: category.isActive,
            });

            const updated = await getCategoryByIdForUser(sessionUser.id, category.id);
            await updateAdminBotSessionFlow(recipient, null);
            if (session) {
              session = { ...session, flowState: null };
            }
            if (updated) {
              await sendAdminCategoryUpdateConfirmation({
                webhook: credentials,
                to: recipient,
                category: updated,
                message: "Nome atualizado com sucesso!",
              });
            } else {
              await sendTextMessage({
                webhook: credentials,
                to: recipient,
                text: "Nome atualizado com sucesso.",
              });
              await sendAdminCategoryActionsMenu({ webhook: credentials, to: recipient });
            }
            await touchAdminBotSession(normalizedRecipient);
            return NextResponse.json({ ok: true });
          }

          if (flow.name === "category_price_input") {
            const parsedPrice = parsePriceInput(rawBody);
            if (parsedPrice === null) {
              await sendTextMessage({
                webhook: credentials,
                to: recipient,
                text: "Não consegui entender o valor. Exemplos válidos: 49,90 ou 49.90.",
              });
              await sendAdminCategoryInputPrompt({
                webhook: credentials,
                to: recipient,
                category,
                mode: "price",
              });
              await touchAdminBotSession(normalizedRecipient);
              return NextResponse.json({ ok: true });
            }

            await updateCategory(category.id, {
              name: category.name,
              price: parsedPrice,
              sku: category.sku,
              description: category.description,
              imagePath: category.imagePath,
              isActive: category.isActive,
            });

            const updated = await getCategoryByIdForUser(sessionUser.id, category.id);
            await updateAdminBotSessionFlow(recipient, null);
            if (session) {
              session = { ...session, flowState: null };
            }
            if (updated) {
              await sendAdminCategoryUpdateConfirmation({
                webhook: credentials,
                to: recipient,
                category: updated,
                message: "Valor atualizado com sucesso!",
              });
            } else {
              await sendTextMessage({
                webhook: credentials,
                to: recipient,
                text: "Valor atualizado com sucesso.",
              });
              await sendAdminCategoryActionsMenu({ webhook: credentials, to: recipient });
            }
            await touchAdminBotSession(normalizedRecipient);
            return NextResponse.json({ ok: true });
          }

          if (flow.name === "category_sku_input") {
            const sanitizedSku = sanitizeSkuInput(rawBody);
            if (!sanitizedSku) {
              await sendTextMessage({
                webhook: credentials,
                to: recipient,
                text: "Envie um SKU usando apenas letras, números, hífen ou sublinhado (máx. 32 caracteres).",
              });
              await sendAdminCategoryInputPrompt({
                webhook: credentials,
                to: recipient,
                category,
                mode: "sku",
              });
              await touchAdminBotSession(normalizedRecipient);
              return NextResponse.json({ ok: true });
            }

            await updateCategory(category.id, {
              name: category.name,
              price: category.price,
              sku: sanitizedSku,
              description: category.description,
              imagePath: category.imagePath,
              isActive: category.isActive,
            });

            const updated = await getCategoryByIdForUser(sessionUser.id, category.id);
            await updateAdminBotSessionFlow(recipient, null);
            if (session) {
              session = { ...session, flowState: null };
            }
            if (updated) {
              await sendAdminCategoryUpdateConfirmation({
                webhook: credentials,
                to: recipient,
                category: updated,
                message: "SKU atualizado com sucesso!",
              });
            } else {
              await sendTextMessage({
                webhook: credentials,
                to: recipient,
                text: "SKU atualizado com sucesso.",
              });
              await sendAdminCategoryActionsMenu({ webhook: credentials, to: recipient });
            }
            await touchAdminBotSession(normalizedRecipient);
            return NextResponse.json({ ok: true });
          }
        }

        if (flow.name === "customer_lookup_input") {
          const normalizedPhone = normalizeCustomerPhoneInput(rawBody);
          if (!normalizedPhone) {
            await sendTextMessage({
              webhook: credentials,
              to: recipient,
              text: "Não consegui entender o número. Utilize o formato +5511999998888.",
            });
            await sendAdminCustomerLookupPrompt({ webhook: credentials, to: recipient });
            await touchAdminBotSession(normalizedRecipient);
            return NextResponse.json({ ok: true });
          }

          const customer = await findCustomerByPhoneForUser(sessionUser.id, normalizedPhone);

          if (!customer) {
            await sendTextMessage({
              webhook: credentials,
              to: recipient,
              text: "Não encontramos esse cliente. Verifique o número e tente novamente.",
            });
            await sendAdminCustomerLookupPrompt({ webhook: credentials, to: recipient });
            await touchAdminBotSession(normalizedRecipient);
            return NextResponse.json({ ok: true });
          }

          const nextFlow = { name: "customer_edit_menu" as const, customerId: customer.id };
          await updateAdminBotSessionFlow(recipient, nextFlow);
          if (session) {
            session = { ...session, flowState: nextFlow };
          }
          await sendAdminCustomerEditMenu({ webhook: credentials, to: recipient, customer });
          await touchAdminBotSession(normalizedRecipient);
          return NextResponse.json({ ok: true });
        }

        if (flow.name === "customer_edit_name_input") {
          const sanitized = sanitizeNameInput(rawBody);
          if (!sanitized) {
            await sendTextMessage({
              webhook: credentials,
              to: recipient,
              text: "Informe um nome com pelo menos 2 caracteres.",
            });
            const customerRow = await getCustomerByIdForUser(sessionUser.id, flow.customerId);
            if (customerRow) {
              const customerSummary = await findCustomerByWhatsappForUser(
                sessionUser.id,
                customerRow.whatsapp_id,
              );
              if (customerSummary) {
                await sendAdminCustomerNamePrompt({
                  webhook: credentials,
                  to: recipient,
                  customer: customerSummary,
                });
              }
            }
            await touchAdminBotSession(normalizedRecipient);
            return NextResponse.json({ ok: true });
          }

          const customerRow = await getCustomerByIdForUser(sessionUser.id, flow.customerId);
          if (!customerRow) {
            await updateAdminBotSessionFlow(recipient, null);
            if (session) {
              session = { ...session, flowState: null };
            }
            await sendAdminCustomerActionsMenu({ webhook: credentials, to: recipient });
            await touchAdminBotSession(normalizedRecipient);
            return NextResponse.json({ ok: true });
          }

          const customerSummary = await findCustomerByWhatsappForUser(
            sessionUser.id,
            customerRow.whatsapp_id,
          );

          if (!customerSummary) {
            await updateAdminBotSessionFlow(recipient, null);
            if (session) {
              session = { ...session, flowState: null };
            }
            await sendAdminCustomerActionsMenu({ webhook: credentials, to: recipient });
            await touchAdminBotSession(normalizedRecipient);
            return NextResponse.json({ ok: true });
          }

          await updateCustomerForUser(sessionUser.id, customerSummary.id, {
            displayName: sanitized,
            balance: customerSummary.balance,
            isBlocked: customerSummary.isBlocked,
            notes: customerSummary.notes,
          });

          const refreshed = await findCustomerByWhatsappForUser(
            sessionUser.id,
            customerRow.whatsapp_id,
          );

          if (refreshed) {
            const nextFlow = { name: "customer_edit_menu" as const, customerId: refreshed.id };
            await updateAdminBotSessionFlow(recipient, nextFlow);
            if (session) {
              session = { ...session, flowState: nextFlow };
            }
            await sendAdminCustomerUpdateConfirmation({
              webhook: credentials,
              to: recipient,
              customer: refreshed,
              message: "Nome atualizado com sucesso!",
            });
          } else {
            await updateAdminBotSessionFlow(recipient, null);
            if (session) {
              session = { ...session, flowState: null };
            }
            await sendAdminCustomerActionsMenu({ webhook: credentials, to: recipient });
          }

          await touchAdminBotSession(normalizedRecipient);
          return NextResponse.json({ ok: true });
        }

        if (flow.name === "customer_edit_balance_input") {
          const delta = parseBalanceDeltaInput(rawBody);
          if (delta === null) {
            await sendTextMessage({
              webhook: credentials,
              to: recipient,
              text: "Não consegui entender o valor. Use formatos +10 ou -5.",
            });
            const customerRow = await getCustomerByIdForUser(sessionUser.id, flow.customerId);
            if (customerRow) {
              const customerSummary = await findCustomerByWhatsappForUser(
                sessionUser.id,
                customerRow.whatsapp_id,
              );
              if (customerSummary) {
                await sendAdminCustomerBalancePrompt({
                  webhook: credentials,
                  to: recipient,
                  customer: customerSummary,
                });
              }
            }
            await touchAdminBotSession(normalizedRecipient);
            return NextResponse.json({ ok: true });
          }

          const customerRow = await getCustomerByIdForUser(sessionUser.id, flow.customerId);
          if (!customerRow) {
            await updateAdminBotSessionFlow(recipient, null);
            if (session) {
              session = { ...session, flowState: null };
            }
            await sendAdminCustomerActionsMenu({ webhook: credentials, to: recipient });
            await touchAdminBotSession(normalizedRecipient);
            return NextResponse.json({ ok: true });
          }

          let operationSucceeded = true;
          let failureReason: string | null = null;
          let refreshed: Awaited<ReturnType<typeof findCustomerByWhatsappForUser>> = null;

          if (delta > 0) {
            const credit = await creditCustomerBalanceByWhatsapp(
              sessionUser.id,
              customerRow.whatsapp_id,
              delta,
            );
            if (!credit.success) {
              operationSucceeded = false;
              failureReason = credit.reason ?? "invalid_amount";
            } else {
              refreshed = credit.customer
                ? await findCustomerByWhatsappForUser(sessionUser.id, credit.customer.whatsappId)
                : await findCustomerByWhatsappForUser(sessionUser.id, customerRow.whatsapp_id);
            }
          } else if (delta < 0) {
            const debit = await debitCustomerBalanceByWhatsapp(
              sessionUser.id,
              customerRow.whatsapp_id,
              Math.abs(delta),
            );
            if (!debit.success) {
              operationSucceeded = false;
              failureReason = debit.reason ?? "invalid_amount";
              refreshed = debit.customer
                ? await findCustomerByWhatsappForUser(sessionUser.id, debit.customer.whatsappId)
                : null;
            } else {
              refreshed = debit.customer
                ? await findCustomerByWhatsappForUser(sessionUser.id, debit.customer.whatsappId)
                : await findCustomerByWhatsappForUser(sessionUser.id, customerRow.whatsapp_id);
            }
          } else {
            refreshed = await findCustomerByWhatsappForUser(sessionUser.id, customerRow.whatsapp_id);
          }

          if (!operationSucceeded) {
            const reasonMessage = failureReason === "insufficient"
              ? "Saldo insuficiente para debitar o valor informado."
              : failureReason === "blocked"
                ? "Este cliente está banido. Desbanha-o antes de ajustar o saldo."
                : "Não foi possível ajustar o saldo. Tente novamente.";

            await sendTextMessage({
              webhook: credentials,
              to: recipient,
              text: reasonMessage,
            });

            if (refreshed) {
              await sendAdminCustomerBalancePrompt({
                webhook: credentials,
                to: recipient,
                customer: refreshed,
              });
            } else {
              await sendAdminCustomerActionsMenu({ webhook: credentials, to: recipient });
            }

            await touchAdminBotSession(normalizedRecipient);
            return NextResponse.json({ ok: true });
          }

          if (refreshed) {
            const nextFlow = { name: "customer_edit_menu" as const, customerId: refreshed.id };
            await updateAdminBotSessionFlow(recipient, nextFlow);
            if (session) {
              session = { ...session, flowState: nextFlow };
            }
            const message = delta === 0
              ? "Nenhum ajuste foi aplicado ao saldo."
              : `Saldo ajustado em ${delta > 0 ? "+" : ""}${formatCurrency(delta)}.`;
            await sendAdminCustomerUpdateConfirmation({
              webhook: credentials,
              to: recipient,
              customer: refreshed,
              message,
            });
          } else {
            await updateAdminBotSessionFlow(recipient, null);
            if (session) {
              session = { ...session, flowState: null };
            }
            await sendAdminCustomerActionsMenu({ webhook: credentials, to: recipient });
          }

          await touchAdminBotSession(normalizedRecipient);
          return NextResponse.json({ ok: true });
        }
      }
    }

    // Nenhuma opção reconhecida: reapresentar o menu
    await sendAdminMainMenu({ webhook: credentials, to: recipient, user: sessionUser, config });
    await touchAdminBotSession(normalizedRecipient);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Erro ao processar webhook administrativo", error);
    return NextResponse.json({ ok: false });
  }
}
