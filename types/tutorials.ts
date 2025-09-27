export type FieldTutorial = {
  slug: string;
  title: string;
  description: string;
  mediaUrl: string | null;
  mediaType: "image" | "video" | null;
  updatedAt: string;
  mediaPath?: string | null;
};

export type FieldTutorialMap = Partial<Record<string, FieldTutorial>>;

export type WebhookTutorialFieldKey =
  | "endpoint"
  | "verifyToken"
  | "appId"
  | "businessAccountId"
  | "phoneNumberId"
  | "accessToken";

export const WEBHOOK_TUTORIAL_FIELDS: {
  key: WebhookTutorialFieldKey;
  slug: string;
  label: string;
  description: string;
}[] = [
  {
    key: "endpoint",
    slug: "webhook-endpoint",
    label: "Endpoint",
    description:
      "Explique como localizar o endpoint gerado pela plataforma e onde ele deve ser cadastrado na Meta.",
  },
  {
    key: "verifyToken",
    slug: "webhook-verify-token",
    label: "Verify Token",
    description:
      "Oriente o usuário sobre como definir o token de verificação utilizado na etapa de validação do webhook.",
  },
  {
    key: "appId",
    slug: "webhook-app-id",
    label: "App ID",
    description:
      "Detalhe como encontrar o identificador do aplicativo no painel da Meta para integrá-lo ao chatbot.",
  },
  {
    key: "businessAccountId",
    slug: "webhook-business-account-id",
    label: "WhatsApp Business Account ID",
    description:
      "Mostre como identificar a conta do WhatsApp Business vinculada à Cloud API.",
  },
  {
    key: "phoneNumberId",
    slug: "webhook-phone-number-id",
    label: "Phone Number ID",
    description:
      "Explique como localizar o identificador do número conectado à API do WhatsApp.",
  },
  {
    key: "accessToken",
    slug: "webhook-access-token",
    label: "Access Token",
    description:
      "Instrua o usuário a gerar e copiar o token de acesso permanente utilizado para enviar mensagens.",
  },
];

export const WEBHOOK_TUTORIAL_SLUG_BY_KEY = WEBHOOK_TUTORIAL_FIELDS.reduce(
  (accumulator, field) => ({ ...accumulator, [field.key]: field.slug }),
  {} as Record<WebhookTutorialFieldKey, string>,
);
