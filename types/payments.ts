export type MercadoPagoCheckoutPaymentType =
  | "credit_card"
  | "debit_card"
  | "ticket"
  | "bank_transfer"
  | "atm"
  | "account_money";

export type MercadoPagoCheckoutPaymentMethod = "pix";

export type PaymentMethodProvider = "mercadopago_pix" | "mercadopago_checkout";

export type PaymentMethodSummary = {
  provider: PaymentMethodProvider;
  displayName: string;
  isActive: boolean;
  isConfigured: boolean;
};

export type MercadoPagoPixConfig = {
  isActive: boolean;
  displayName: string;
  accessToken: string;
  publicKey: string | null;
  pixKey: string | null;
  notificationUrl: string | null;
  pixExpirationMinutes: number;
  amountOptions: number[];
  instructions: string | null;
  isConfigured: boolean;
  updatedAt: string | null;
};

export type MercadoPagoCheckoutConfig = {
  isActive: boolean;
  displayName: string;
  accessToken: string;
  publicKey: string | null;
  notificationUrl: string | null;
  amountOptions: number[];
  allowedPaymentTypes: MercadoPagoCheckoutPaymentType[];
  allowedPaymentMethods: MercadoPagoCheckoutPaymentMethod[];
  isConfigured: boolean;
  updatedAt: string | null;
};

export type PaymentCharge = {
  id: number;
  publicId: string;
  userId: number;
  provider: string;
  providerPaymentId: string;
  status: string;
  amount: number;
  currency: string;
  qrCode: string | null;
  qrCodeBase64: string | null;
  ticketUrl: string | null;
  expiresAt: string | null;
  customerWhatsapp: string | null;
  customerName: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type MercadoPagoPixCharge = PaymentCharge & {
  provider: "mercadopago_pix";
};

export type MercadoPagoCheckoutCharge = PaymentCharge & {
  provider: "mercadopago_checkout";
};
