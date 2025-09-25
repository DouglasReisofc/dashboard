"use client";

import { FormEvent, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Form, Table } from "react-bootstrap";

import { formatDate, formatDateTime } from "lib/format";
import type { AdminWebhookDetails, AdminWebhookEventSummary } from "types/admin-webhooks";

interface Props {
  webhook: AdminWebhookDetails;
  events: AdminWebhookEventSummary[];
}

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

const mapWebhookToFormState = (webhook: AdminWebhookDetails): FormState => ({
  verifyToken: webhook.verifyToken,
  appId: webhook.appId ?? "",
  businessAccountId: webhook.businessAccountId ?? "",
  phoneNumberId: webhook.phoneNumberId ?? "",
  accessToken: webhook.accessToken ?? "",
});

const AdminWebhookManager = ({ webhook, events }: Props) => {
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentWebhook, setCurrentWebhook] = useState<AdminWebhookDetails>(webhook);
  const [formState, setFormState] = useState<FormState>(mapWebhookToFormState(webhook));
  const [recentEvents, setRecentEvents] = useState<AdminWebhookEventSummary[]>(events);

  useEffect(() => {
    setCurrentWebhook(webhook);
    setFormState(mapWebhookToFormState(webhook));
    setRecentEvents(events);
  }, [webhook, events]);

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
      const response = await fetch("/api/admin/webhook", {
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
        const message = payload?.message ?? "Não foi possível salvar as configurações do webhook.";
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
      console.error("Erro ao atualizar webhook administrativo", error);
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
            Integração com a Meta Cloud API
          </Card.Title>
        </Card.Header>
        <Card.Body className="d-flex flex-column gap-3">
          <p className="text-secondary mb-0">
            Utilize os campos abaixo para conectar o número oficial do WhatsApp que atenderá os usuários
            diretamente pelo chatbot administrativo. Cadastre o endpoint e o verify token na Meta, e preencha
            os identificadores fornecidos pelo Business Manager para habilitar o envio de mensagens.
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

          <Form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
            <Form.Group controlId="admin-webhook-endpoint">
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
                Registre esta URL no painel de Webhooks da Meta para receber os eventos do WhatsApp.
              </Form.Text>
            </Form.Group>

            <Form.Group controlId="admin-webhook-verify-token">
              <Form.Label>Verify Token</Form.Label>
              <div className="d-flex gap-2 flex-column flex-lg-row">
                <Form.Control
                  value={formState.verifyToken}
                  onChange={handleFieldChange("verifyToken")}
                  placeholder="Token utilizado na validação do webhook"
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
                Deve coincidir com o valor informado quando a Meta solicitar o <code>hub.verify_token</code> na
                verificação.
              </Form.Text>
            </Form.Group>

            <Form.Group controlId="admin-webhook-app-id">
              <Form.Label>ID do aplicativo (App ID)</Form.Label>
              <Form.Control
                value={formState.appId}
                onChange={handleFieldChange("appId")}
                placeholder="Ex.: 123456789"
                disabled={isSubmitting}
              />
            </Form.Group>

            <Form.Group controlId="admin-webhook-business-id">
              <Form.Label>ID da conta comercial</Form.Label>
              <Form.Control
                value={formState.businessAccountId}
                onChange={handleFieldChange("businessAccountId")}
                placeholder="Business Account ID"
                disabled={isSubmitting}
              />
            </Form.Group>

            <Form.Group controlId="admin-webhook-phone-id">
              <Form.Label>ID do número do WhatsApp</Form.Label>
              <Form.Control
                value={formState.phoneNumberId}
                onChange={handleFieldChange("phoneNumberId")}
                placeholder="Phone Number ID"
                disabled={isSubmitting}
              />
            </Form.Group>

            <Form.Group controlId="admin-webhook-access-token">
              <Form.Label>Token de acesso permanente</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={formState.accessToken}
                onChange={handleFieldChange("accessToken")}
                placeholder="Informe o token gerado no painel da Meta"
                disabled={isSubmitting}
              />
              <Form.Text>
                Recomendamos utilizar tokens de longa duração e manter esse valor em um local seguro.
              </Form.Text>
            </Form.Group>

            <div className="d-flex gap-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Salvar alterações"}
              </Button>
              {currentWebhook.createdAt && (
                <Badge bg="light" text="dark" className="align-self-center">
                  Criado em {formatDate(currentWebhook.createdAt)}
                </Badge>
              )}
            </div>
          </Form>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title as="h2" className="h5 mb-0">
            Eventos recentes
          </Card.Title>
        </Card.Header>
        <Card.Body>
          {recentEvents.length === 0 ? (
            <p className="text-secondary mb-0">
              Nenhum evento registrado até o momento. Assim que a Meta enviar mensagens para o webhook,
              elas aparecerão aqui.
            </p>
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle mb-0">
                <thead>
                  <tr>
                    <th style={{ minWidth: "180px" }}>Recebido em</th>
                    <th style={{ minWidth: "200px" }}>Tipo</th>
                    <th>Conteúdo</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEvents.map((event) => (
                    <tr key={event.id}>
                      <td className="text-secondary small">
                        {formatDateTime(event.receivedAt)}
                      </td>
                      <td className="text-secondary small">
                        {event.eventType ?? "—"}
                      </td>
                      <td>
                        <pre className="small text-secondary mb-0" style={{ whiteSpace: "pre-wrap" }}>
                          {event.payload}
                        </pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default AdminWebhookManager;
