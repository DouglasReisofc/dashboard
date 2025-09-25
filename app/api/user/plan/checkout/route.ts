import { NextResponse } from "next/server";

import { getCurrentUser } from "lib/auth";
import { createPlanCheckoutPreference, createPlanPixCharge } from "lib/plan-payments";
import { getSubscriptionPlanById } from "lib/plans";

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

    const planId = Number.parseInt(String((body as Record<string, unknown>).planId ?? ""), 10);
    const provider = String((body as Record<string, unknown>).provider ?? "mercadopago_pix");

    if (!Number.isFinite(planId) || planId <= 0) {
      return NextResponse.json({ message: "Plano inválido." }, { status: 400 });
    }

    if (provider !== "mercadopago_pix" && provider !== "mercadopago_checkout") {
      return NextResponse.json({ message: "Provedor de pagamento inválido." }, { status: 400 });
    }

    const plan = await getSubscriptionPlanById(planId);
    if (!plan || !plan.isActive) {
      return NextResponse.json({ message: "Plano indisponível para assinatura." }, { status: 404 });
    }

    if (plan.price <= 0) {
      return NextResponse.json({ message: "Plano configurado com valor inválido." }, { status: 400 });
    }

    const checkout =
      provider === "mercadopago_pix"
        ? await createPlanPixCharge({
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            plan,
          })
        : await createPlanCheckoutPreference({
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            plan,
          });

    return NextResponse.json({
      message: "Pagamento criado com sucesso.",
      checkout,
    });
  } catch (error) {
    console.error("Failed to create plan checkout", error);
    return NextResponse.json(
      { message: "Não foi possível gerar o pagamento do plano." },
      { status: 500 },
    );
  }
}
