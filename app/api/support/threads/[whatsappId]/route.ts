import { NextResponse } from "next/server";

import { getCurrentUser } from "lib/auth";
import {
  getSupportThreadByWhatsapp,
  getSupportMessages,
  buildSupportThreadSummary,
  serializeSupportMessage,
  serializeSupportThread,
  closeSupportThread,
} from "lib/support";
import { emitSupportThreadUpdate } from "lib/realtime";

export async function GET(
  _request: Request,
  context: { params: Promise<{ whatsappId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
    }

    const { whatsappId } = await context.params;
    const thread = await getSupportThreadByWhatsapp(user.id, whatsappId);
    if (!thread) {
      return NextResponse.json({ message: "Conversa não encontrada." }, { status: 404 });
    }

    const messagesRaw = await getSupportMessages(thread.id);
    const messages = messagesRaw.map(serializeSupportMessage);
    const summary = await buildSupportThreadSummary(user.id, thread);

    return NextResponse.json({
      thread: serializeSupportThread(thread),
      messages,
      within24h: summary.within24h,
      minutesLeft24h: summary.minutesLeft24h,
    });
  } catch (error) {
    console.error("Failed to load support conversation", error);
    return NextResponse.json({ message: "Erro ao carregar conversa." }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ whatsappId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
    }

    const { whatsappId } = await context.params;
    const payload = await request.json().catch(() => null);
    if (!payload || payload.action !== "close") {
      return NextResponse.json({ message: "Ação inválida." }, { status: 400 });
    }

    await closeSupportThread(user.id, whatsappId);

    const thread = await getSupportThreadByWhatsapp(user.id, whatsappId);
    let summary = null;
    if (thread) {
      summary = await buildSupportThreadSummary(user.id, thread);
      emitSupportThreadUpdate({ userId: user.id, thread: summary });
    }

    return NextResponse.json({ ok: true, thread: summary });
  } catch (error) {
    console.error("Failed to close support conversation", error);
    return NextResponse.json({ message: "Erro ao encerrar conversa." }, { status: 500 });
  }
}
