import { NextResponse } from "next/server";

import { creditCustomerBalanceByWhatsapp } from "lib/customers";
import { fetchMercadoPagoPayment } from "lib/mercadopago";
import {
  getMercadoPagoCheckoutConfigForUser,
  getMercadoPagoPixConfigForUser,
  getPaymentConfirmationConfigForUser,
  getPaymentChargeByProviderPaymentId,
  updatePaymentChargeStatus,
} from "lib/payments";
import { sendPaymentConfirmationMessage } from "lib/meta";
import { getWebhookRowForUser } from "lib/webhooks";
import { getUserBasicById, increaseUserBalance } from "lib/users";
import {
  sendBalanceTopUpNotification,
  sendCustomerBalanceCreditNotification,
  sendPlanPurchaseNotification,
} from "lib/notifications";
import {
  getPlanPaymentByProviderPaymentId,
  updatePlanPaymentStatus,
} from "lib/plan-payments";
import {
  getBalancePaymentByProviderPaymentId,
  updateBalancePaymentStatus,
} from "lib/balance-payments";
import {
  getAdminMercadoPagoCheckoutConfig,
  getAdminMercadoPagoPixConfig,
} from "lib/admin-payments";
import { activateUserPlan, getSubscriptionPlanById } from "lib/plans";

const extractPaymentIdFromResource = (resource: unknown): string | null => {
  if (typeof resource !== "string" || resource.trim().length === 0) {
    return null;
  }

  const trimmed = resource.trim();
  const segments = trimmed.split("/");
  const lastSegment = segments.pop();

  if (!lastSegment) {
    return null;
  }

  return lastSegment;
};

const extractPaymentId = (request: Request, body: unknown): string | null => {
  const url = new URL(request.url);
  const queryId = url.searchParams.get("id");
  if (queryId && queryId.trim()) {
    return queryId.trim();
  }

  if (body && typeof body === "object") {
    const data = body as Record<string, unknown>;

    const directId = data.id ?? data["payment_id"] ?? data["data_id"];
    if (typeof directId === "string" && directId.trim()) {
      return directId.trim();
    }

    if (typeof directId === "number" && Number.isFinite(directId)) {
      return String(directId);
    }

    const dataNode = data.data as Record<string, unknown> | undefined;
    if (dataNode) {
      const nestedId = dataNode.id ?? dataNode["payment_id"];
      if (typeof nestedId === "string" && nestedId.trim()) {
        return nestedId.trim();
      }

      if (typeof nestedId === "number" && Number.isFinite(nestedId)) {
        return String(nestedId);
      }
    }

    if (typeof data.resource === "string") {
      const extracted = extractPaymentIdFromResource(data.resource);
      if (extracted) {
        return extracted;
      }
    }
  }

  return null;
};

export async function GET() {
  return NextResponse.json({ message: "Mercado Pago webhook ativo." });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const paymentId = extractPaymentId(request, body);

    if (!paymentId) {
      return NextResponse.json({ message: "Evento ignorado." });
    }

    const charge = await getPaymentChargeByProviderPaymentId(paymentId);

    if (!charge) {
      const planPayment = await getPlanPaymentByProviderPaymentId(paymentId);
      if (planPayment) {
        let accessToken: string | null = null;

        if (planPayment.provider === "mercadopago_pix") {
          const config = await getAdminMercadoPagoPixConfig();
          if (!config.isConfigured || !config.accessToken) {
            console.warn("[Mercado Pago Webhook] Configuração Pix admin indisponível");
            return NextResponse.json({ message: "Configuração indisponível." });
          }
          accessToken = config.accessToken;
        } else if (planPayment.provider === "mercadopago_checkout") {
          const config = await getAdminMercadoPagoCheckoutConfig();
          if (!config.isConfigured || !config.accessToken) {
            console.warn("[Mercado Pago Webhook] Configuração checkout admin indisponível");
            return NextResponse.json({ message: "Configuração indisponível." });
          }
          accessToken = config.accessToken;
        } else {
          console.warn("[Mercado Pago Webhook] Provedor de plano não suportado", planPayment.provider);
          return NextResponse.json({ message: "Provedor não suportado." });
        }

        const payment = await fetchMercadoPagoPayment({ accessToken, paymentId });

        const previousStatus = planPayment.status.toLowerCase();
        const normalizedStatus = payment.status.toLowerCase();

        const updatedPayment = await updatePlanPaymentStatus(
          planPayment.provider_payment_id,
          payment.status,
          payment.statusDetail ?? null,
          { raw: payment.raw },
        );

        if (normalizedStatus === "approved" && previousStatus !== "approved" && updatedPayment) {
          const { status: planStatus, subscriptionId } = await activateUserPlan(
            updatedPayment.user_id,
            updatedPayment.plan_id,
          );

          if (subscriptionId) {
            await updatePlanPaymentStatus(
              updatedPayment.provider_payment_id,
              payment.status,
              payment.statusDetail ?? null,
              undefined,
              subscriptionId,
            );
          }

          const [plan, user] = await Promise.all([
            getSubscriptionPlanById(updatedPayment.plan_id),
            getUserBasicById(updatedPayment.user_id),
          ]);

          if (plan && user) {
            await sendPlanPurchaseNotification({
              planName: plan.name,
              amount: plan.price,
              buyerName: user.name,
              buyerEmail: user.email,
              buyerUserId: user.id,
            });
          }

          console.info(
            "[Mercado Pago Webhook] Plano ativado",
            JSON.stringify({ userId: updatedPayment.user_id, planId: updatedPayment.plan_id, status: planStatus }),
          );
        }

        return NextResponse.json({ message: "Pagamento de plano processado." });
      }

      const balancePayment = await getBalancePaymentByProviderPaymentId(paymentId);
      if (balancePayment) {
        let accessToken: string | null = null;

        if (balancePayment.provider === "mercadopago_pix") {
          const config = await getAdminMercadoPagoPixConfig();
          if (!config.isConfigured || !config.accessToken) {
            console.warn("[Mercado Pago Webhook] Configuração Pix admin indisponível");
            return NextResponse.json({ message: "Configuração indisponível." });
          }
          accessToken = config.accessToken;
        } else if (balancePayment.provider === "mercadopago_checkout") {
          const config = await getAdminMercadoPagoCheckoutConfig();
          if (!config.isConfigured || !config.accessToken) {
            console.warn("[Mercado Pago Webhook] Configuração checkout admin indisponível");
            return NextResponse.json({ message: "Configuração indisponível." });
          }
          accessToken = config.accessToken;
        } else {
          console.warn("[Mercado Pago Webhook] Provedor de recarga não suportado", balancePayment.provider);
          return NextResponse.json({ message: "Provedor não suportado." });
        }

        const payment = await fetchMercadoPagoPayment({ accessToken, paymentId });

        const previousStatus = balancePayment.status.toLowerCase();
        const normalizedStatus = payment.status.toLowerCase();

        await updateBalancePaymentStatus(
          balancePayment.provider_payment_id,
          payment.status,
          payment.statusDetail ?? null,
          { raw: payment.raw },
        );

        if (normalizedStatus === "approved" && previousStatus !== "approved") {
          const amount = Number.parseFloat(balancePayment.amount ?? "0");

          if (Number.isFinite(amount) && amount > 0) {
            const newBalance = await increaseUserBalance(balancePayment.user_id, amount);
            const user = await getUserBasicById(balancePayment.user_id);

            if (user) {
              await sendBalanceTopUpNotification({
                userId: user.id,
                userName: user.name,
                userEmail: user.email,
                amount,
                newBalance,
              });
            }

            console.info(
              "[Mercado Pago Webhook] Saldo do usuário atualizado",
              JSON.stringify({ userId: balancePayment.user_id, amount, newBalance }),
            );
          }
        }

        return NextResponse.json({ message: "Recarga de saldo processada." });
      }

      return NextResponse.json({ message: "Cobrança não localizada." });
    }

    let accessToken: string | null = null;

    if (charge.provider === "mercadopago_pix") {
      const config = await getMercadoPagoPixConfigForUser(charge.userId);

      if (!config.isConfigured || !config.accessToken) {
        console.warn("[Mercado Pago Webhook] Configuração Pix indisponível", charge.userId);
        return NextResponse.json({ message: "Configuração indisponível." });
      }

      accessToken = config.accessToken;
    } else if (charge.provider === "mercadopago_checkout") {
      const config = await getMercadoPagoCheckoutConfigForUser(charge.userId);

      if (!config.isConfigured || !config.accessToken) {
        console.warn("[Mercado Pago Webhook] Configuração de checkout indisponível", charge.userId);
        return NextResponse.json({ message: "Configuração indisponível." });
      }

      accessToken = config.accessToken;
    } else {
      console.warn("[Mercado Pago Webhook] Provedor de cobrança não suportado", charge.provider);
      return NextResponse.json({ message: "Provedor não suportado." });
    }

    const payment = await fetchMercadoPagoPayment({
      accessToken,
      paymentId,
    });

    const normalizedStatus = payment.status.toLowerCase();
    const previousStatus = charge.status.toLowerCase();

    let creditResult: Awaited<ReturnType<typeof creditCustomerBalanceByWhatsapp>> | null = null;

    if (normalizedStatus === "approved" && previousStatus !== "approved" && charge.customerWhatsapp) {
      creditResult = await creditCustomerBalanceByWhatsapp(charge.userId, charge.customerWhatsapp, charge.amount, {
        displayName: charge.customerName,
        phoneNumber: charge.customerWhatsapp,
      });
    }

    const updatedCharge = await updatePaymentChargeStatus({
      chargeId: charge.id,
      status: payment.status,
      statusDetail: payment.statusDetail,
      rawPayload: payment.raw,
      creditResult: creditResult
        ? {
            success: creditResult.success,
            amount: charge.amount,
            balance: creditResult.balance,
            customerId: creditResult.customer?.id ?? null,
            customerWhatsapp: charge.customerWhatsapp,
            creditedAt: new Date().toISOString(),
            reason: creditResult.reason ?? null,
          }
        : undefined,
    });

    if (updatedCharge && creditResult?.success) {
      console.info(
        "[Mercado Pago Webhook] Saldo creditado automaticamente",
        JSON.stringify({
          userId: updatedCharge.userId,
          customerId: creditResult.customer?.id ?? null,
          whatsapp: updatedCharge.customerWhatsapp,
          amount: charge.amount,
        }),
      );

      if (updatedCharge.customerWhatsapp) {
        try {
          const [confirmationConfig, webhookRow] = await Promise.all([
            getPaymentConfirmationConfigForUser(updatedCharge.userId),
            getWebhookRowForUser(updatedCharge.userId),
          ]);

          if (webhookRow) {
            await sendPaymentConfirmationMessage({
              webhook: webhookRow,
              to: updatedCharge.customerWhatsapp,
              config: confirmationConfig,
              amount: charge.amount,
              balance: creditResult.balance,
            });
          }
        } catch (messageError) {
          console.error(
            "[Mercado Pago Webhook] Falha ao enviar mensagem de confirmação",
            messageError,
          );
        }
      }

      try {
        const user = await getUserBasicById(updatedCharge.userId);
        if (user) {
          await sendCustomerBalanceCreditNotification({
            userId: user.id,
            userName: user.name,
            userEmail: user.email ?? null,
            amount: charge.amount,
            customerName:
              creditResult.customer?.displayName
              ?? creditResult.customer?.profileName
              ?? updatedCharge.customerName
              ?? null,
            customerWhatsapp: updatedCharge.customerWhatsapp,
            newCustomerBalance: creditResult.balance,
          });
        }
      } catch (notificationError) {
        console.error(
          "[Mercado Pago Webhook] Falha ao notificar crédito de cliente",
          notificationError,
        );
      }
    }

    return NextResponse.json({ message: "Webhook processado." });
  } catch (error) {
    console.error("[Mercado Pago Webhook] Falha ao processar evento", error);
    return NextResponse.json({ message: "Erro ao processar webhook." }, { status: 500 });
  }
}
