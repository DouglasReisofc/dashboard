import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "lib/auth";
import { updateWebhookConfig } from "lib/webhooks";

const MAX_VERIFY_TOKEN = 128;
const MAX_APP_ID = 64;
const MAX_APP_SECRET = 128;
const MAX_BUSINESS_ACCOUNT_ID = 64;
const MAX_PHONE_NUMBER_ID = 64;
const MAX_PHONE_NUMBER = 32;
const MAX_ACCESS_TOKEN = 4096;

const sanitizeRequiredString = (value: unknown, maxLength: number) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
};

const sanitizeOptionalString = (value: unknown, maxLength: number) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
};

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
    }

    const payload = await request.json().catch(() => null);

    if (!payload) {
      return NextResponse.json({ message: "Payload inválido." }, { status: 400 });
    }

    const verifyToken = sanitizeRequiredString(payload.verifyToken, MAX_VERIFY_TOKEN);

    if (!verifyToken) {
      return NextResponse.json(
        { message: "Informe um verify token válido." },
        { status: 400 },
      );
    }

    const appId = sanitizeOptionalString(payload.appId, MAX_APP_ID);
    const appSecret = sanitizeOptionalString(payload.appSecret, MAX_APP_SECRET);
    const businessAccountId = sanitizeOptionalString(
      payload.businessAccountId,
      MAX_BUSINESS_ACCOUNT_ID,
    );
    const phoneNumberId = sanitizeOptionalString(payload.phoneNumberId, MAX_PHONE_NUMBER_ID);
    const phoneNumber = sanitizeOptionalString(payload.phoneNumber, MAX_PHONE_NUMBER);
    const accessToken = sanitizeOptionalString(payload.accessToken, MAX_ACCESS_TOKEN);

    const webhook = await updateWebhookConfig(user.id, {
      verifyToken,
      appId,
      appSecret,
      businessAccountId,
      phoneNumberId,
      phoneNumber,
      accessToken,
    });

    if (!webhook) {
      return NextResponse.json(
        { message: "Não foi possível atualizar o webhook." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      message: "Configurações do webhook atualizadas com sucesso.",
      webhook,
    });
  } catch (error) {
    console.error("Failed to update webhook settings", error);
    return NextResponse.json(
      { message: "Não foi possível salvar as configurações do webhook." },
      { status: 500 },
    );
  }
}
