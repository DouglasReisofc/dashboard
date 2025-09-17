export type UserWebhookDetails = {
  id: string;
  endpoint: string;
  verifyToken: string;
  apiKey: string;
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
