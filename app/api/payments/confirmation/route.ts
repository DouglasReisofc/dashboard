import { NextResponse } from "next/server";

import { getCurrentUser } from "lib/auth";
import { upsertPaymentConfirmationConfig } from "lib/payments";

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json({ message: "Payload inválido." }, { status: 400 });
    }

    const { messageText, buttonLabel, mediaUrl } = body as Record<string, unknown>;

    const sanitizedMessageText = typeof messageText === "string" ? messageText : "";
    const sanitizedButtonLabel = typeof buttonLabel === "string" ? buttonLabel : "";
    const sanitizedMediaUrl = typeof mediaUrl === "string" ? mediaUrl : null;

    if (!sanitizedMessageText.trim()) {
      return NextResponse.json(
        { message: "Informe a mensagem que será enviada após o pagamento." },
        { status: 400 },
      );
    }

    if (!sanitizedButtonLabel.trim()) {
      return NextResponse.json(
        { message: "Defina o texto do botão que abrirá o menu de compras." },
        { status: 400 },
      );
    }

    const config = await upsertPaymentConfirmationConfig({
      userId: user.id,
      messageText: sanitizedMessageText,
      buttonLabel: sanitizedButtonLabel,
      mediaUrl: sanitizedMediaUrl,
    });

    return NextResponse.json({
      message: "Mensagem de confirmação salva com sucesso.",
      config,
    });
  } catch (error) {
    console.error("Failed to update payment confirmation message", error);
    return NextResponse.json(
      { message: "Não foi possível atualizar a mensagem de confirmação." },
      { status: 500 },
    );
  }
}
