import { NextResponse } from "next/server";

import { getCurrentUser } from "lib/auth";
import { createBalanceTopUpCheckout, createBalanceTopUpPix } from "lib/balance-payments";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ message: "Payload inválido." }, { status: 400 });
    }

    const amountValue = (body as Record<string, unknown>).amount;
    const providerRaw = String((body as Record<string, unknown>).provider ?? "mercadopago_pix");

    const amount = typeof amountValue === "number"
      ? amountValue
      : typeof amountValue === "string"
        ? Number.parseFloat(amountValue.replace(/,/g, "."))
        : NaN;

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ message: "Informe um valor válido para adicionar saldo." }, { status: 400 });
    }

    if (providerRaw !== "mercadopago_pix" && providerRaw !== "mercadopago_checkout") {
      return NextResponse.json({ message: "Forma de pagamento inválida." }, { status: 400 });
    }

    const checkout =
      providerRaw === "mercadopago_pix"
        ? await createBalanceTopUpPix({
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            amount,
          })
        : await createBalanceTopUpCheckout({
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            amount,
          });

    return NextResponse.json({
      message: "Pagamento de saldo criado com sucesso.",
      checkout,
    });
  } catch (error) {
    console.error("Failed to create balance top-up", error);
    return NextResponse.json(
      { message: "Não foi possível gerar o pagamento de saldo." },
      { status: 500 },
    );
  }
}
