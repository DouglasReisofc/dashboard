"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Alert, Badge, Button, Card, Col, Form, Row } from "react-bootstrap";
import { useRouter } from "next/navigation";

import type { PaymentConfirmationMessageConfig } from "types/payments";

interface PaymentConfirmationFormProps {
  config: PaymentConfirmationMessageConfig;
}

type FormState = {
  messageText: string;
  buttonLabel: string;
  mediaUrl: string;
};

type Feedback = { type: "success" | "danger"; message: string } | null;

const buildInitialState = (config: PaymentConfirmationMessageConfig): FormState => ({
  messageText: config.messageText,
  buttonLabel: config.buttonLabel,
  mediaUrl: config.mediaUrl ?? "",
});

const PaymentConfirmationForm = ({ config }: PaymentConfirmationFormProps) => {
  const router = useRouter();
  const [formState, setFormState] = useState<FormState>(() => buildInitialState(config));
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState("-");

  useEffect(() => {
    if (!config.updatedAt) {
      setLastUpdatedLabel("-");
      return;
    }

    try {
      const formatter = new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      });
      setLastUpdatedLabel(formatter.format(new Date(config.updatedAt)));
    } catch (error) {
      console.warn("Failed to format payment confirmation last update", error);
      setLastUpdatedLabel("-");
    }
  }, [config.updatedAt]);

  useEffect(() => {
    setFormState(buildInitialState(config));
  }, [config]);

  const handleChange = <Field extends keyof FormState>(field: Field, value: FormState[Field]) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleReset = () => {
    setFormState(buildInitialState(config));
    setFeedback(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    const payload = {
      messageText: formState.messageText,
      buttonLabel: formState.buttonLabel,
      mediaUrl: formState.mediaUrl,
    };

    const response = await fetch("/api/payments/confirmation", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setFeedback({
        type: "danger",
        message: data.message ?? "Não foi possível salvar a mensagem de confirmação.",
      });
      setIsSubmitting(false);
      return;
    }

    setFeedback({
      type: "success",
      message: data.message ?? "Mensagem de confirmação atualizada com sucesso.",
    });

    setIsSubmitting(false);
    router.refresh();
  };

  return (
    <Card>
      <Card.Header className="d-flex justify-content-between align-items-center">
        <div>
          <Card.Title as="h2" className="h5 mb-1">
            Mensagem após pagamento aprovado
          </Card.Title>
          <Card.Subtitle className="text-secondary small">
            Personalize o texto enviado automaticamente quando o pagamento for confirmado.
          </Card.Subtitle>
        </div>
        <Badge bg="secondary">Automático</Badge>
      </Card.Header>
      <Card.Body>
        {feedback && (
          <Alert variant={feedback.type} onClose={() => setFeedback(null)} dismissible>
            {feedback.message}
          </Alert>
        )}
        <Form onSubmit={handleSubmit}>
          <Row className="gy-4">
            <Col xs={12} className="text-md-end">
              <Form.Text className="text-secondary">
                Última atualização: {lastUpdatedLabel}
              </Form.Text>
            </Col>
            <Col xs={12}>
              <Form.Group className="mb-3" controlId="confirmationMessageText">
                <Form.Label>Mensagem principal</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  value={formState.messageText}
                  onChange={(event) => handleChange("messageText", event.target.value)}
                  placeholder="Pagamento confirmado! Seu saldo foi atualizado automaticamente."
                  required
                />
                <Form.Text className="text-secondary">
                  {"Use {{valor}} e {{saldo}} para inserir automaticamente o valor pago e o saldo atual."}
                </Form.Text>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3" controlId="confirmationButtonLabel">
                <Form.Label>Texto do botão</Form.Label>
                <Form.Control
                  value={formState.buttonLabel}
                  onChange={(event) => handleChange("buttonLabel", event.target.value)}
                  placeholder="Ver opções"
                  maxLength={20}
                  required
                />
                <Form.Text className="text-secondary">
                  Máximo de 20 caracteres. O botão abre o menu de compras automaticamente.
                </Form.Text>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3" controlId="confirmationMediaUrl">
                <Form.Label>Imagem opcional</Form.Label>
                <Form.Control
                  value={formState.mediaUrl}
                  onChange={(event) => handleChange("mediaUrl", event.target.value)}
                  placeholder="https://..."
                  type="url"
                />
                <Form.Text className="text-secondary">
                  Informe um link HTTPS público para exibir a imagem no topo da mensagem.
                </Form.Text>
              </Form.Group>
            </Col>
          </Row>
          <div className="d-flex gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Salvar alterações"}
            </Button>
            <Button variant="outline-secondary" onClick={handleReset} disabled={isSubmitting}>
              Desfazer mudanças
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
};

export default PaymentConfirmationForm;
