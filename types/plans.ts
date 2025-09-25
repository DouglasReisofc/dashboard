export type SubscriptionPlan = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  categoryLimit: number;
  durationDays: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SubscriptionPlanPayload = {
  name: string;
  description?: string | null;
  price: number;
  categoryLimit: number;
  durationDays: number;
  isActive: boolean;
};

export type UserPlanStatus = {
  planId: number | null;
  plan: SubscriptionPlan | null;
  status: 'inactive' | 'pending' | 'active' | 'expired';
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  daysRemaining: number | null;
};

export type PlanCheckoutPayload = {
  planId: number;
  provider: 'mercadopago_pix' | 'mercadopago_checkout';
};

export type PlanCheckoutResponse = {
  paymentId: string;
  providerPaymentId: string;
  provider: 'mercadopago_pix' | 'mercadopago_checkout';
  amount: number;
  ticketUrl: string | null;
  qrCode: string | null;
  qrCodeBase64: string | null;
  expiresAt: string | null;
};
