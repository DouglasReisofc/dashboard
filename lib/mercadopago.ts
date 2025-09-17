const MERCADO_PAGO_BASE_URL = process.env.MERCADO_PAGO_API_URL?.trim()
  || "https://api.mercadopago.com";

export type CreatePixPaymentOptions = {
  accessToken: string;
  amount: number;
  description: string;
  externalReference: string;
  payer: {
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  };
  notificationUrl?: string | null;
  expiresAt?: Date | null;
  additionalMetadata?: Record<string, unknown>;
};

export type MercadoPagoPixPaymentResponse = {
  id: string;
  status: string;
  qrCode: string | null;
  qrCodeBase64: string | null;
  ticketUrl: string | null;
  dateOfExpiration: string | null;
  raw: Record<string, unknown>;
};

const buildExpiration = (expiresAt?: Date | null) => {
  if (!expiresAt) {
    return undefined;
  }

  const timestamp = expiresAt.getTime();
  if (!Number.isFinite(timestamp)) {
    return undefined;
  }

  return expiresAt.toISOString();
};

export const createMercadoPagoPixPayment = async (
  options: CreatePixPaymentOptions,
): Promise<MercadoPagoPixPaymentResponse> => {
  const { accessToken, amount, description, externalReference, payer, notificationUrl, expiresAt, additionalMetadata } = options;

  const sanitizedAmount = Number.isFinite(amount) ? Math.max(amount, 0) : 0;

  const payload: Record<string, unknown> = {
    transaction_amount: Number(sanitizedAmount.toFixed(2)),
    description: description.trim() || "Pagamento via Pix",
    payment_method_id: "pix",
    external_reference: externalReference,
    payer: {
      email: payer.email,
      first_name: payer.firstName ?? undefined,
      last_name: payer.lastName ?? undefined,
    },
  };

  const expiration = buildExpiration(expiresAt);
  if (expiration) {
    payload.date_of_expiration = expiration;
  }

  if (notificationUrl && notificationUrl.trim()) {
    payload.notification_url = notificationUrl.trim();
  }

  if (additionalMetadata && Object.keys(additionalMetadata).length > 0) {
    payload.metadata = additionalMetadata;
  }

  const response = await fetch(`${MERCADO_PAGO_BASE_URL}/v1/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "StoreBotDashboard/1.0",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Mercado Pago Pix creation failed: ${response.status} ${response.statusText} ${errorText}`);
  }

  const data = await response.json().catch(() => ({}));
  const rawData = data && typeof data === "object" ? data : {};

  const transactionData = rawData?.point_of_interaction?.transaction_data as Record<string, unknown> | undefined;

  const qrCode = typeof transactionData?.qr_code === "string" ? transactionData.qr_code : null;
  const qrCodeBase64 = typeof transactionData?.qr_code_base64 === "string"
    ? transactionData.qr_code_base64
    : null;
  const ticketUrl = typeof transactionData?.ticket_url === "string" ? transactionData.ticket_url : null;

  const dateOfExpirationRaw = typeof rawData?.date_of_expiration === "string"
    ? rawData.date_of_expiration
    : typeof transactionData?.date_of_expiration === "string"
      ? transactionData.date_of_expiration
      : null;

  return {
    id: String(rawData.id ?? ""),
    status: typeof rawData.status === "string" ? rawData.status : "unknown",
    qrCode,
    qrCodeBase64,
    ticketUrl,
    dateOfExpiration: dateOfExpirationRaw,
    raw: rawData as Record<string, unknown>,
  };
};
