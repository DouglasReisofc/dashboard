import { NextResponse } from "next/server";

import { getCurrentUser } from "lib/auth";
import { getSubscriptionPlanById, activateUserPlan } from "lib/plans";
import { decreaseUserBalance, getUserBasicById } from "lib/users";
import { recordPlanPayment } from "lib/plan-payments";
import { sendPlanPurchaseNotification } from "lib/notifications";

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
    if (!Number.isFinite(planId) || planId <= 0) {
      return NextResponse.json({ message: "Plano inválido." }, { status: 400 });
    }

    const plan = await getSubscriptionPlanById(planId);
    if (!plan || !plan.isActive) {
      return NextResponse.json({ message: "Plano indisponível para assinatura." }, { status: 404 });
    }

    const newBalance = await decreaseUserBalance(user.id, plan.price);
    const { status: planStatus, subscriptionId } = await activateUserPlan(user.id, plan.id);

    await recordPlanPayment({
      userId: user.id,
      planId: plan.id,
      provider: "balance",
      providerPaymentId: `balance:${user.id}:${Date.now()}`,
      status: "approved",
      amount: plan.price,
      metadata: {
        type: "plan",
        paidWithBalance: true,
      },
      subscriptionId,
    });

    const userProfile = await getUserBasicById(user.id);
    if (userProfile) {
      await sendPlanPurchaseNotification({
        planName: plan.name,
        amount: plan.price,
        buyerName: userProfile.name,
        buyerEmail: userProfile.email,
        buyerUserId: userProfile.id,
      });
    }

    return NextResponse.json({
      message: "Plano ativado com sucesso usando o saldo disponível.",
      status: planStatus,
      balance: newBalance,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Saldo insuficiente")) {
      return NextResponse.json({ message: error.message }, { status: 402 });
    }

    console.error("Failed to activate plan with balance", error);
    return NextResponse.json(
      { message: "Não foi possível ativar o plano com o saldo disponível." },
      { status: 500 },
    );
  }
}
