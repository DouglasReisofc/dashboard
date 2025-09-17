export type UserWebhookDetails = {
  id: string;
  endpoint: string;
  verifyToken: string;
  appId: string | null;
  businessAccountId: string | null;
  phoneNumberId: string | null;
  accessToken: string | null;
  createdAt: string;
  updatedAt: string;
  lastEventAt: string | null;
};

export type WebhookEventSummary = {
  id: number;
  webhookId: string;
  eventType: string | null;
  receivedAt: string;
  payload: string;
};
