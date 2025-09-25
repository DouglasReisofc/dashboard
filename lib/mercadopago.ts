const MERCADO_PAGO_BASE_URL = process.env.MERCADO_PAGO_API_URL?.trim()
  || "https://api.mercadopago.com";

const getAppBaseUrl = () => {
  const raw = process.env.APP_URL?.trim();
  if (!raw) {
    return "http://localhost:4478";
  }

  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
};

const getCheckoutReturnUrls = () => {
  const baseUrl = getAppBaseUrl();
  const buildUrl = (status: "success" | "pending" | "failure") =>
    `${baseUrl}/pagamentos/checkout-retorno?status=${status}`;

  return {
    success: buildUrl("success"),
    pending: buildUrl("pending"),
    failure: buildUrl("failure"),
  };
};

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

export type CreateCheckoutPreferenceOptions = {
  accessToken: string;
  amount: number;
  title: string;
  description: string;
  externalReference: string;
  notificationUrl?: string | null;
  payer?: {
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  metadata?: Record<string, unknown> | null;
  excludedPaymentTypes?: string[] | null;
  excludedPaymentMethods?: string[] | null;
};

export type MercadoPagoCheckoutPreferenceResponse = {
  id: string;
  initPoint: string | null;
  sandboxInitPoint: string | null;
  raw: Record<string, unknown>;
};

export type MercadoPagoPaymentDetails = {
  id: string;
  status: string;
  statusDetail: string | null;
  transactionAmount: number | null;
  currencyId: string | null;
  metadata: Record<string, unknown> | null;
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

export const createMercadoPagoCheckoutPreference = async (
  options: CreateCheckoutPreferenceOptions,
): Promise<MercadoPagoCheckoutPreferenceResponse> => {
  const {
    accessToken,
    amount,
    title,
    description,
    externalReference,
    notificationUrl,
    payer,
    metadata,
    excludedPaymentTypes,
    excludedPaymentMethods,
  } = options;

  const sanitizedAmount = Number.isFinite(amount) ? Math.max(amount, 0) : 0;
  const payload: Record<string, unknown> = {
    items: [
      {
        id: "storebot_balance",
        title: title.trim() || "Recarga de saldo",
        description: description.trim() || undefined,
        quantity: 1,
        unit_price: Number(sanitizedAmount.toFixed(2)),
        currency_id: "BRL",
      },
    ],
    external_reference: externalReference,
    auto_return: "approved",
  };

  payload.back_urls = getCheckoutReturnUrls();

  if (notificationUrl && notificationUrl.trim()) {
    payload.notification_url = notificationUrl.trim();
  }

  if (metadata && Object.keys(metadata).length > 0) {
    payload.metadata = metadata;
  }

  const paymentMethods: Record<string, unknown> = {};
  if (excludedPaymentTypes && excludedPaymentTypes.length > 0) {
    paymentMethods.excluded_payment_types = excludedPaymentTypes.map((id) => ({ id }));
  }

  if (excludedPaymentMethods && excludedPaymentMethods.length > 0) {
    paymentMethods.excluded_payment_methods = excludedPaymentMethods.map((id) => ({ id }));
  }

  if (Object.keys(paymentMethods).length > 0) {
    payload.payment_methods = paymentMethods;
  }

  if (payer && payer.email && payer.email.trim()) {
    payload.payer = {
      email: payer.email.trim(),
      name: payer.firstName ?? undefined,
      surname: payer.lastName ?? undefined,
    };
  }

  const response = await fetch(`${MERCADO_PAGO_BASE_URL}/checkout/preferences`, {
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
    throw new Error(
      `Mercado Pago checkout preference creation failed: ${response.status} ${response.statusText} ${errorText}`,
    );
  }

  const data = await response.json().catch(() => ({}));
  const rawData = data && typeof data === "object" ? data : {};

  const normalized = rawData as Record<string, unknown>;
  const initPoint = typeof normalized.init_point === "string" ? normalized.init_point : null;
  const sandboxInitPoint = typeof normalized.sandbox_init_point === "string"
    ? normalized.sandbox_init_point
    : null;

  return {
    id: String(normalized.id ?? ""),
    initPoint,
    sandboxInitPoint,
    raw: normalized,
  };
};

type FetchPaymentOptions = {
  accessToken: string;
  paymentId: string;
};

const parseTransactionAmount = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const parseMetadata = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
};

export const fetchMercadoPagoPayment = async (
  options: FetchPaymentOptions,
): Promise<MercadoPagoPaymentDetails> => {
  const { accessToken, paymentId } = options;
  const trimmedId = paymentId.trim();

  const response = await fetch(`${MERCADO_PAGO_BASE_URL}/v1/payments/${trimmedId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "StoreBotDashboard/1.0",
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Mercado Pago payment fetch failed: ${response.status} ${response.statusText} ${errorText}`);
  }

  const data = await response.json().catch(() => ({}));
  const rawData = data && typeof data === "object" ? data : {};

  const status = typeof rawData.status === "string" ? rawData.status : "unknown";
  const statusDetail = typeof rawData.status_detail === "string" ? rawData.status_detail : null;
  const transactionAmount = parseTransactionAmount(rawData.transaction_amount);
  const currencyId = typeof rawData.currency_id === "string" ? rawData.currency_id : null;
  const metadata = parseMetadata(rawData.metadata);

  return {
    id: String(rawData.id ?? trimmedId),
    status,
    statusDetail,
    transactionAmount,
    currencyId,
    metadata,
    raw: rawData as Record<string, unknown>,
  } satisfies MercadoPagoPaymentDetails;
};
