import { NextResponse } from "next/server";

import { creditCustomerBalanceByWhatsapp } from "lib/customers";
import { fetchMercadoPagoPayment } from "lib/mercadopago";
import {
  getMercadoPagoPixChargeByProviderPaymentId,
  getMercadoPagoPixConfigForUser,
  updateMercadoPagoPixChargeStatus,
} from "lib/payments";

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

    const charge = await getMercadoPagoPixChargeByProviderPaymentId(paymentId);

    if (!charge) {
      return NextResponse.json({ message: "Cobrança não localizada." });
    }

    const config = await getMercadoPagoPixConfigForUser(charge.userId);

    if (!config.isConfigured || !config.accessToken) {
      console.warn("[Mercado Pago Webhook] Configuração indisponível para o usuário", charge.userId);
      return NextResponse.json({ message: "Configuração indisponível." });
    }

    const payment = await fetchMercadoPagoPayment({
      accessToken: config.accessToken,
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

    const updatedCharge = await updateMercadoPagoPixChargeStatus({
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
    }

    return NextResponse.json({ message: "Webhook processado." });
  } catch (error) {
    console.error("[Mercado Pago Webhook] Falha ao processar evento", error);
    return NextResponse.json({ message: "Erro ao processar webhook." }, { status: 500 });
  }
}
