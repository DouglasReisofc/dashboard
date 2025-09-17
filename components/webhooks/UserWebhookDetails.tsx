"use client";

import { useState } from "react";
import { Alert, Badge, Button, Card, Table } from "react-bootstrap";

import { formatDate } from "lib/format";
import type { UserWebhookDetails, WebhookEventSummary } from "types/webhooks";

type Props = {
  webhook: UserWebhookDetails;
  events: WebhookEventSummary[];
};

type Feedback = { type: "success" | "danger"; message: string } | null;

const copyToClipboard = async (value: string) => {
  if (!navigator?.clipboard) {
    throw new Error("Clipboard API indisponível");
  }

  await navigator.clipboard.writeText(value);
};

const UserWebhookDetails = ({ webhook, events }: Props) => {
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isCopying, setIsCopying] = useState(false);

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

  return (
    <div className="d-flex flex-column gap-4">
      <Card>
        <Card.Header>
          <Card.Title as="h2" className="h5 mb-0">
            Configuração do webhook
          </Card.Title>
        </Card.Header>
        <Card.Body className="d-flex flex-column gap-3">
          <p className="text-secondary mb-0">
            Use estes dados para configurar o endpoint oficial da Meta Cloud API. Durante a
            verificação informe o <strong>Verify Token</strong> e depois encaminhe os eventos para o
            endpoint gerado.
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

          <div className="d-flex flex-column gap-2">
            <div>
              <span className="text-secondary d-block">Endpoint</span>
              <code className="d-block text-break">{webhook.endpoint}</code>
              <Button
                variant="outline-primary"
                size="sm"
                className="mt-2"
                disabled={isCopying}
                onClick={() => handleCopy("Endpoint", webhook.endpoint)}
              >
                Copiar endpoint
              </Button>
            </div>

            <div>
              <span className="text-secondary d-block">Verify Token</span>
              <code className="d-block text-break">{webhook.verifyToken}</code>
              <Button
                variant="outline-primary"
                size="sm"
                className="mt-2"
                disabled={isCopying}
                onClick={() => handleCopy("Verify Token", webhook.verifyToken)}
              >
                Copiar verify token
              </Button>
            </div>

            <div>
              <span className="text-secondary d-block">API Key</span>
              <code className="d-block text-break">{webhook.apiKey}</code>
              <Button
                variant="outline-primary"
                size="sm"
                className="mt-2"
                disabled={isCopying}
                onClick={() => handleCopy("API Key", webhook.apiKey)}
              >
                Copiar API key
              </Button>
            </div>
          </div>

          <div className="bg-light rounded p-3">
            <p className="mb-1 fw-semibold">Referência rápida</p>
            <p className="text-secondary mb-2">
              1. Cadastre o endpoint acima na Meta Cloud API.
              <br />
              2. Informe o verify token quando solicitado.
              <br />
              3. Publique e teste o webhook seguindo a documentação oficial.
            </p>
            <a
              href="https://developers.facebook.com/docs/whatsapp/cloud-api/reference?locale=pt_BR"
              target="_blank"
              rel="noreferrer"
              className="fw-semibold"
            >
              Abrir documentação da Meta Cloud API
            </a>
          </div>

          <div className="text-secondary small">
            Atualizado em {formatDate(webhook.updatedAt)}.
            {webhook.lastEventAt && (
              <>
                {" "}
                Último evento recebido em {formatDate(webhook.lastEventAt)}.
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
