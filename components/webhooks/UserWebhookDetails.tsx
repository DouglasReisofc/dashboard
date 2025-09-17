"use client";

import { FormEvent, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Form, Table } from "react-bootstrap";

import { formatDate } from "lib/format";
import type { UserWebhookDetails, WebhookEventSummary } from "types/webhooks";

type Props = {
  webhook: UserWebhookDetails;
  events: WebhookEventSummary[];
};

type Feedback = { type: "success" | "danger"; message: string } | null;

type FormState = {
  verifyToken: string;
  appId: string;
  businessAccountId: string;
  phoneNumberId: string;
  accessToken: string;
};

const copyToClipboard = async (value: string) => {
  if (!navigator?.clipboard) {
    throw new Error("Clipboard API indisponível");
  }

  await navigator.clipboard.writeText(value);
};

const mapWebhookToFormState = (webhook: UserWebhookDetails): FormState => ({
  verifyToken: webhook.verifyToken,
  appId: webhook.appId ?? "",
  businessAccountId: webhook.businessAccountId ?? "",
  phoneNumberId: webhook.phoneNumberId ?? "",
  accessToken: webhook.accessToken ?? "",
});

const UserWebhookDetails = ({ webhook, events }: Props) => {
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentWebhook, setCurrentWebhook] = useState<UserWebhookDetails>(webhook);
  const [formState, setFormState] = useState<FormState>(mapWebhookToFormState(webhook));

  useEffect(() => {
    setCurrentWebhook(webhook);
    setFormState(mapWebhookToFormState(webhook));
  }, [webhook]);

  const handleCopy = async (label: string, value: string) => {
    setIsCopying(true);
    setFeedback(null);

    try {
      await copyToClipboard(value);
      setFeedback({ type: "success", message: `${label} copiado para a área de transferência.` });
    } catch (error) {
      console.error("Erro ao copiar", error);
      setFeedback({
        type: "danger",
        message: "Não foi possível copiar o valor. Copie manualmente.",
      });
    } finally {
      setIsCopying(false);
    }
  };

  const handleFieldChange = (field: keyof FormState) =>
    (event: FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const target = event.currentTarget;
      setFormState((previous) => ({ ...previous, [field]: target.value }));
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/webhooks/meta/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          verifyToken: formState.verifyToken,
          appId: formState.appId || null,
          businessAccountId: formState.businessAccountId || null,
          phoneNumberId: formState.phoneNumberId || null,
          accessToken: formState.accessToken || null,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          payload?.message ?? "Não foi possível salvar as configurações do webhook.";
        throw new Error(message);
      }

      if (payload?.webhook) {
        setCurrentWebhook(payload.webhook);
        setFormState(mapWebhookToFormState(payload.webhook));
      }

      setFeedback({
        type: "success",
        message: payload?.message ?? "Configurações atualizadas com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao atualizar webhook", error);
      setFeedback({
        type: "danger",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível salvar as configurações do webhook.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="d-flex flex-column gap-4">
      <Card>
        <Card.Header>
          <Card.Title as="h2" className="h5 mb-0">
            Configuração do webhook
          </Card.Title>
        </Card.Header>
        <Card.Body className="d-flex flex-column gap-3">
          <Form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
            <p className="text-secondary mb-0">
              Configure os dados exigidos pela documentação oficial da Meta para receber
              notificações e realizar ações com a Cloud API do WhatsApp. Preencha o identificador do
              aplicativo, as contas vinculadas e o token de acesso permanente fornecido pelo Business
              Manager.
            </p>

            {feedback && (
              <Alert
                variant={feedback.type === "success" ? "success" : "danger"}
                onClose={() => setFeedback(null)}
                dismissible
                className="mb-0"
              >
                {feedback.message}
              </Alert>
            )}

            <Form.Group controlId="webhook-endpoint">
              <Form.Label>Endpoint</Form.Label>
              <div className="d-flex gap-2 flex-column flex-lg-row">
                <Form.Control value={currentWebhook.endpoint} readOnly />
                <Button
                  variant="outline-primary"
                  disabled={isCopying}
                  onClick={() => handleCopy("Endpoint", currentWebhook.endpoint)}
                >
                  Copiar endpoint
                </Button>
              </div>
              <Form.Text>
                Cadastre esta URL no painel de Webhooks da Meta para receber os eventos na sua conta.
              </Form.Text>
            </Form.Group>

            <Form.Group controlId="webhook-verify-token">
              <Form.Label>Verify Token</Form.Label>
              <div className="d-flex gap-2 flex-column flex-lg-row">
                <Form.Control
                  value={formState.verifyToken}
                  onChange={handleFieldChange("verifyToken")}
                  placeholder="Token definido para a verificação do webhook"
                  disabled={isSubmitting}
                  required
                />
                <Button
                  variant="outline-primary"
                  disabled={isCopying}
                  onClick={() => handleCopy("Verify Token", formState.verifyToken)}
                >
                  Copiar verify token
                </Button>
              </div>
              <Form.Text>
                Este valor deve ser informado quando a Meta solicitar o <code>hub.verify_token</code>
                durante a validação do webhook.
              </Form.Text>
            </Form.Group>

            <Form.Group controlId="webhook-app-id">
              <Form.Label>ID do aplicativo (App ID)</Form.Label>
              <Form.Control
                value={formState.appId}
                onChange={handleFieldChange("appId")}
                placeholder="Ex.: 123456789012345"
                disabled={isSubmitting}
              />
            </Form.Group>

            <div className="row g-3">
              <div className="col-md-6">
                <Form.Group controlId="webhook-business-account">
                  <Form.Label>WhatsApp Business Account ID</Form.Label>
                  <Form.Control
                    value={formState.businessAccountId}
                    onChange={handleFieldChange("businessAccountId")}
                    placeholder="Identificador da conta do WhatsApp Business"
                    disabled={isSubmitting}
                  />
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group controlId="webhook-phone-number-id">
                  <Form.Label>Phone Number ID</Form.Label>
                  <Form.Control
                    value={formState.phoneNumberId}
                    onChange={handleFieldChange("phoneNumberId")}
                    placeholder="ID do número configurado na Cloud API"
                    disabled={isSubmitting}
                  />
                </Form.Group>
              </div>
            </div>

            <Form.Group controlId="webhook-access-token">
              <Form.Label>Access Token</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={formState.accessToken}
                onChange={handleFieldChange("accessToken")}
                placeholder="Token permanente gerado no Business Manager"
                disabled={isSubmitting}
              />
              <Form.Text>
                Necessário para enviar mensagens e consultar a API oficial do WhatsApp.
              </Form.Text>
            </Form.Group>

            <div className="d-flex justify-content-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Salvar configurações"}
              </Button>
            </div>
          </Form>

          <div className="bg-light rounded p-3">
            <p className="mb-1 fw-semibold">Referência rápida</p>
            <p className="text-secondary mb-2">
              1. Cadastre o endpoint acima na Meta Cloud API.
              <br />
              2. Preencha o Verify Token para concluir a verificação.
              <br />
              3. Informe App ID, Phone Number ID e Access Token para enviar mensagens com a API.
            </p>
            <a
              href="https://developers.facebook.com/docs/graph-api/webhooks"
              target="_blank"
              rel="noreferrer"
              className="fw-semibold"
            >
              Abrir documentação completa de Webhooks da Meta
            </a>
          </div>

          <div className="text-secondary small">
            Atualizado em {formatDate(currentWebhook.updatedAt)}.
            {currentWebhook.lastEventAt && (
              <>
                {" "}
                Último evento recebido em {formatDate(currentWebhook.lastEventAt)}.
              </>
            )}
          </div>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title as="h2" className="h5 mb-0">
            Histórico de eventos recentes
          </Card.Title>
        </Card.Header>
        <Card.Body>
          {events.length === 0 ? (
            <p className="text-secondary mb-0">
              Ainda não recebemos notificações da Meta para este webhook.
            </p>
          ) : (
            <div className="table-responsive">
              <Table hover responsive className="mb-0">
                <thead>
                  <tr>
                    <th className="text-secondary">Evento</th>
                    <th className="text-secondary">Recebido em</th>
                    <th className="text-secondary">Resumo</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => {
                    const preview = event.payload.slice(0, 120);
                    const suffix = event.payload.length > 120 ? "…" : "";

                    return (
                      <tr key={event.id}>
                        <td>
                          {event.eventType ? (
                            <Badge bg="light" text="dark">
                              {event.eventType}
                            </Badge>
                          ) : (
                            <span className="text-secondary">-</span>
                          )}
                        </td>
                        <td>{formatDate(event.receivedAt)}</td>
                        <td>
                          <code className="d-block text-break">
                            {preview}
                            {suffix}
                          </code>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default UserWebhookDetails;
