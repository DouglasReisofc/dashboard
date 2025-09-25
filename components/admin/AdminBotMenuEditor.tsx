"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Col, Form, Image, Row } from "react-bootstrap";

import type { AdminBotConfig } from "types/admin-bot";

interface AdminBotMenuEditorProps {
  config: AdminBotConfig;
}

type Feedback = { type: "success" | "danger"; message: string } | null;

type FormState = {
  menuText: string;
  menuFooterText: string;
  panelButtonText: string;
  subscriptionButtonText: string;
  supportButtonText: string;
  subscriptionHeaderText: string;
  subscriptionBodyText: string;
  subscriptionFooterText: string;
  subscriptionRenewButtonText: string;
  subscriptionChangeButtonText: string;
  subscriptionDetailsButtonText: string;
  subscriptionNoPlanHeaderText: string;
  subscriptionNoPlanBodyText: string;
  subscriptionNoPlanButtonText: string;
  subscriptionPlanListTitle: string;
  subscriptionPlanListBody: string;
  subscriptionPlanListButtonText: string;
  subscriptionPlanListFooterText: string;
  removeImage: boolean;
  imageFile: File | null;
};

const toFormState = (config: AdminBotConfig): FormState => ({
  menuText: config.menuText,
  menuFooterText: config.menuFooterText ?? "",
  panelButtonText: config.panelButtonText,
  subscriptionButtonText: config.subscriptionButtonText,
  supportButtonText: config.supportButtonText,
  subscriptionHeaderText: config.subscriptionHeaderText,
  subscriptionBodyText: config.subscriptionBodyText,
  subscriptionFooterText: config.subscriptionFooterText ?? "",
  subscriptionRenewButtonText: config.subscriptionRenewButtonText,
  subscriptionChangeButtonText: config.subscriptionChangeButtonText,
  subscriptionDetailsButtonText: config.subscriptionDetailsButtonText,
  subscriptionNoPlanHeaderText: config.subscriptionNoPlanHeaderText,
  subscriptionNoPlanBodyText: config.subscriptionNoPlanBodyText,
  subscriptionNoPlanButtonText: config.subscriptionNoPlanButtonText,
  subscriptionPlanListTitle: config.subscriptionPlanListTitle,
  subscriptionPlanListBody: config.subscriptionPlanListBody,
  subscriptionPlanListButtonText: config.subscriptionPlanListButtonText,
  subscriptionPlanListFooterText: config.subscriptionPlanListFooterText ?? "",
  removeImage: false,
  imageFile: null,
});

const formatMenuPreview = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");

const formatSubscriptionPreview = (value: string, placeholders: Record<string, string | null>) => {
  let rendered = value;
  for (const [token, replacement] of Object.entries(placeholders)) {
    const safeReplacement = (replacement ?? "").trim();
    rendered = rendered.replace(new RegExp(token, "gi"), safeReplacement);
  }
  return rendered;
};

const AdminBotMenuEditor = ({ config }: AdminBotMenuEditorProps) => {
  const [formState, setFormState] = useState<FormState>(() => toFormState(config));
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(config.menuImageUrl);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    setFormState(toFormState(config));
    setCurrentImageUrl(config.menuImageUrl);
    setPreviewUrl(null);
  }, [config]);

  const displayedImageUrl = useMemo(() => {
    if (formState.removeImage) {
      return null;
    }
    return previewUrl ?? currentImageUrl ?? null;
  }, [formState.removeImage, previewUrl, currentImageUrl]);

  const handleTextChange = (field: keyof FormState) =>
    (event: FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.currentTarget.value;
      setFormState((previous) => ({ ...previous, [field]: value }));
    };

  const handleFileChange = (event: FormEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null;

    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }

    if (!file) {
      setPreviewUrl(null);
      setFormState((previous) => ({ ...previous, imageFile: null }));
      return;
    }

    const mime = file.type.toLowerCase();
    if (mime !== "image/png" && mime !== "image/jpeg") {
      setFeedback({ type: "danger", message: "Selecione uma imagem PNG ou JPG." });
      event.currentTarget.value = "";
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setFormState((previous) => ({ ...previous, imageFile: file, removeImage: false }));
  };

  const handleRemoveImageToggle = (event: FormEvent<HTMLInputElement>) => {
    const checked = (event.currentTarget as HTMLInputElement).checked;
    setFormState((previous) => ({ ...previous, removeImage: checked }));
    if (checked) {
      setPreviewUrl(null);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    setIsSubmitting(true);

    try {
      const body = new FormData();
      body.set("menuText", formState.menuText);
      body.set("menuFooterText", formState.menuFooterText);
      body.set("panelButtonText", formState.panelButtonText);
      body.set("subscriptionButtonText", formState.subscriptionButtonText);
      body.set("supportButtonText", formState.supportButtonText);
      body.set("subscriptionHeaderText", formState.subscriptionHeaderText);
      body.set("subscriptionBodyText", formState.subscriptionBodyText);
      body.set("subscriptionFooterText", formState.subscriptionFooterText);
      body.set("subscriptionRenewButtonText", formState.subscriptionRenewButtonText);
      body.set("subscriptionChangeButtonText", formState.subscriptionChangeButtonText);
      body.set("subscriptionDetailsButtonText", formState.subscriptionDetailsButtonText);
      body.set("subscriptionNoPlanHeaderText", formState.subscriptionNoPlanHeaderText);
      body.set("subscriptionNoPlanBodyText", formState.subscriptionNoPlanBodyText);
      body.set("subscriptionNoPlanButtonText", formState.subscriptionNoPlanButtonText);
      body.set("subscriptionPlanListTitle", formState.subscriptionPlanListTitle);
      body.set("subscriptionPlanListBody", formState.subscriptionPlanListBody);
      body.set("subscriptionPlanListButtonText", formState.subscriptionPlanListButtonText);
      body.set("subscriptionPlanListFooterText", formState.subscriptionPlanListFooterText);
      body.set("removeMenuImage", String(formState.removeImage));

      if (formState.imageFile) {
        body.set("menuImage", formState.imageFile);
      }

      const response = await fetch("/api/admin/bot/config", {
        method: "POST",
        body,
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message = payload?.message ?? "Não foi possível atualizar as configurações do bot.";
        throw new Error(message);
      }

      if (payload?.config) {
        const nextConfig = payload.config as AdminBotConfig;
        setFormState(toFormState(nextConfig));
        setCurrentImageUrl(nextConfig.menuImageUrl);
        setPreviewUrl(null);
      }

      setFeedback({
        type: "success",
        message: payload?.message ?? "Configurações do bot atualizadas com sucesso.",
      });
    } catch (error) {
      console.error("Failed to update admin bot config", error);
      setFeedback({
        type: "danger",
        message:
          error instanceof Error ? error.message : "Não foi possível atualizar as configurações do bot.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const menuPreviewText = formatMenuPreview(formState.menuText);
  const subscriptionPreviewPlaceholder = formatSubscriptionPreview(formState.subscriptionBodyText, {
    "{{plan_name}}": "StoreBot PRO",
    "{{plan_status}}": "Ativo",
    "{{plan_price}}": "R$ 89,90",
    "{{plan_renews_at}}": "15/03/2025",
  });

  const subscriptionNoPlanPreview = formatSubscriptionPreview(formState.subscriptionNoPlanBodyText, {
    "{{plan_name}}": "",
    "{{plan_status}}": "",
    "{{plan_price}}": "",
    "{{plan_renews_at}}": "",
  });

  const subscriptionPlanListPreview = formatSubscriptionPreview(formState.subscriptionPlanListBody, {
    "{{plan_name}}": "",
    "{{plan_price}}": "",
  });

  return (
    <Card className="mb-4">
      <Card.Header>
        <Card.Title as="h2" className="h5 mb-0">
          Personalizar bot administrativo
        </Card.Title>
      </Card.Header>
      <Card.Body>
        <Form className="d-flex flex-column gap-4" onSubmit={handleSubmit} encType="multipart/form-data">
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

          <Row className="g-4">
            <Col lg={6}>
              <Card className="h-100 border">
                <Card.Header>
                  <Card.Title as="h3" className="h6 mb-0">
                    Prévia do menu principal
                  </Card.Title>
                </Card.Header>
                <Card.Body className="d-flex flex-column gap-3">
                  {displayedImageUrl && (
                    <Image
                      src={displayedImageUrl}
                      alt="Imagem do menu"
                      rounded
                      className="border"
                    />
                  )}
                  <div className="bg-light border rounded p-3">
                    <pre className="mb-3 text-secondary" style={{ whiteSpace: "pre-wrap" }}>
                      {menuPreviewText}
                    </pre>
                    {formState.menuFooterText.trim() && (
                      <p className="text-secondary small mb-3">{formState.menuFooterText.trim()}</p>
                    )}
                    <div className="d-flex flex-wrap gap-2">
                      <Button size="sm" variant="outline-primary">
                        {formState.panelButtonText}
                      </Button>
                      <Button size="sm" variant="outline-primary">
                        {formState.subscriptionButtonText}
                      </Button>
                      <Button size="sm" variant="outline-primary">
                        {formState.supportButtonText}
                      </Button>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </Col>

            <Col lg={6}>
              <Card className="h-100 border">
                <Card.Header>
                  <Card.Title as="h3" className="h6 mb-0">
                    Prévia da seção de assinatura
                  </Card.Title>
                </Card.Header>
                <Card.Body className="d-flex flex-column gap-3">
                  <div className="bg-light border rounded p-3">
                    <strong className="d-block mb-2">{formState.subscriptionHeaderText}</strong>
                    <pre className="mb-2 text-secondary" style={{ whiteSpace: "pre-wrap" }}>
                      {subscriptionPreviewPlaceholder}
                    </pre>
                    {formState.subscriptionFooterText.trim() && (
                      <p className="text-secondary small mb-3">
                        {formState.subscriptionFooterText.trim()}
                      </p>
                    )}
                    <div className="d-flex flex-wrap gap-2">
                      <Button size="sm" variant="outline-primary">
                        {formState.subscriptionRenewButtonText}
                      </Button>
                      <Button size="sm" variant="outline-primary">
                        {formState.subscriptionChangeButtonText}
                      </Button>
                      <Button size="sm" variant="outline-primary">
                        {formState.subscriptionDetailsButtonText}
                      </Button>
                    </div>
                  </div>
                  <div className="bg-light border rounded p-3">
                    <strong className="d-block mb-2">{formState.subscriptionNoPlanHeaderText}</strong>
                    <p className="text-secondary small mb-3" style={{ whiteSpace: "pre-wrap" }}>
                      {subscriptionNoPlanPreview}
                    </p>
                    <Button size="sm" variant="outline-success">
                      {formState.subscriptionNoPlanButtonText}
                    </Button>
                  </div>
                  <div className="bg-light border rounded p-3">
                    <strong className="d-block mb-2">{formState.subscriptionPlanListTitle}</strong>
                    <p className="text-secondary small mb-3" style={{ whiteSpace: "pre-wrap" }}>
                      {subscriptionPlanListPreview}
                    </p>
                    {formState.subscriptionPlanListFooterText.trim() && (
                      <p className="text-secondary small mb-2">
                        {formState.subscriptionPlanListFooterText.trim()}
                      </p>
                    )}
                    <Button size="sm" variant="outline-primary">
                      {formState.subscriptionPlanListButtonText}
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <hr />

          <Row className="g-4">
            <Col lg={6}>
              <Form.Group controlId="admin-bot-menu-text">
                <Form.Label>Mensagem do menu principal</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={6}
                  value={formState.menuText}
                  onChange={handleTextChange("menuText")}
                  disabled={isSubmitting}
                  required
                />
                <Form.Text>
                  Use quebras de linha para separar parágrafos. O bot substituirá automaticamente o nome do
                  usuário por {"{{user_first_name}}"} se você utilizar essa variável.
                </Form.Text>
              </Form.Group>
            </Col>
            <Col lg={6}>
              <Form.Group controlId="admin-bot-menu-footer">
                <Form.Label>Rodapé do menu</Form.Label>
                <Form.Control
                  type="text"
                  value={formState.menuFooterText}
                  onChange={handleTextChange("menuFooterText")}
                  disabled={isSubmitting}
                />
              </Form.Group>
              <Row className="g-3 mt-1">
                <Col sm={4}>
                  <Form.Group controlId="admin-bot-button-panel">
                    <Form.Label>Botão 1</Form.Label>
                    <Form.Control
                      type="text"
                      value={formState.panelButtonText}
                      onChange={handleTextChange("panelButtonText")}
                      disabled={isSubmitting}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col sm={4}>
                  <Form.Group controlId="admin-bot-button-subscription">
                    <Form.Label>Botão 2</Form.Label>
                    <Form.Control
                      type="text"
                      value={formState.subscriptionButtonText}
                      onChange={handleTextChange("subscriptionButtonText")}
                      disabled={isSubmitting}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col sm={4}>
                  <Form.Group controlId="admin-bot-button-support">
                    <Form.Label>Botão 3</Form.Label>
                    <Form.Control
                      type="text"
                      value={formState.supportButtonText}
                      onChange={handleTextChange("supportButtonText")}
                      disabled={isSubmitting}
                      required
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Form.Group controlId="admin-bot-menu-image" className="mt-3">
                <Form.Label>Imagem do menu (opcional)</Form.Label>
                <Form.Control
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  disabled={isSubmitting}
                />
                <Form.Check
                  type="switch"
                  id="admin-bot-menu-remove-image"
                  className="mt-2"
                  label="Remover imagem atual"
                  checked={formState.removeImage}
                  onChange={handleRemoveImageToggle}
                  disabled={isSubmitting || (!displayedImageUrl && !currentImageUrl)}
                />
              </Form.Group>
            </Col>
          </Row>

          <Row className="g-4">
            <Col lg={6}>
              <Form.Group controlId="admin-bot-subscription-header">
                <Form.Label>Título da assinatura</Form.Label>
                <Form.Control
                  type="text"
                  value={formState.subscriptionHeaderText}
                  onChange={handleTextChange("subscriptionHeaderText")}
                  disabled={isSubmitting}
                  required
                />
              </Form.Group>
              <Form.Group controlId="admin-bot-subscription-body" className="mt-3">
                <Form.Label>Resumo do plano</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={5}
                  value={formState.subscriptionBodyText}
                  onChange={handleTextChange("subscriptionBodyText")}
                  disabled={isSubmitting}
                  required
                />
                <Form.Text>
                  Variáveis disponíveis: {"{{plan_name}}"}, {"{{plan_status}}"}, {"{{plan_price}}"},
                  {"{{plan_renews_at}}"}.
                </Form.Text>
              </Form.Group>
              <Form.Group controlId="admin-bot-subscription-footer" className="mt-3">
                <Form.Label>Rodapé da assinatura</Form.Label>
                <Form.Control
                  type="text"
                  value={formState.subscriptionFooterText}
                  onChange={handleTextChange("subscriptionFooterText")}
                  disabled={isSubmitting}
                />
              </Form.Group>
              <Row className="g-3 mt-1">
                <Col sm={4}>
                  <Form.Group controlId="admin-bot-subscription-renew">
                    <Form.Label>Botão renovar</Form.Label>
                    <Form.Control
                      type="text"
                      value={formState.subscriptionRenewButtonText}
                      onChange={handleTextChange("subscriptionRenewButtonText")}
                      disabled={isSubmitting}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col sm={4}>
                  <Form.Group controlId="admin-bot-subscription-change">
                    <Form.Label>Botão mudar</Form.Label>
                    <Form.Control
                      type="text"
                      value={formState.subscriptionChangeButtonText}
                      onChange={handleTextChange("subscriptionChangeButtonText")}
                      disabled={isSubmitting}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col sm={4}>
                  <Form.Group controlId="admin-bot-subscription-details">
                    <Form.Label>Botão detalhes</Form.Label>
                    <Form.Control
                      type="text"
                      value={formState.subscriptionDetailsButtonText}
                      onChange={handleTextChange("subscriptionDetailsButtonText")}
                      disabled={isSubmitting}
                      required
                    />
                  </Form.Group>
                </Col>
              </Row>
            </Col>
            <Col lg={6}>
              <Form.Group controlId="admin-bot-noplan-header">
                <Form.Label>Título sem plano</Form.Label>
                <Form.Control
                  type="text"
                  value={formState.subscriptionNoPlanHeaderText}
                  onChange={handleTextChange("subscriptionNoPlanHeaderText")}
                  disabled={isSubmitting}
                  required
                />
              </Form.Group>
              <Form.Group controlId="admin-bot-noplan-body" className="mt-3">
                <Form.Label>Mensagem sem plano</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  value={formState.subscriptionNoPlanBodyText}
                  onChange={handleTextChange("subscriptionNoPlanBodyText")}
                  disabled={isSubmitting}
                  required
                />
              </Form.Group>
              <Form.Group controlId="admin-bot-noplan-button" className="mt-3">
                <Form.Label>Botão para assinar</Form.Label>
                <Form.Control
                  type="text"
                  value={formState.subscriptionNoPlanButtonText}
                  onChange={handleTextChange("subscriptionNoPlanButtonText")}
                  disabled={isSubmitting}
                  required
                />
              </Form.Group>
              <Form.Group controlId="admin-bot-planlist-title" className="mt-3">
                <Form.Label>Título da lista de planos</Form.Label>
                <Form.Control
                  type="text"
                  value={formState.subscriptionPlanListTitle}
                  onChange={handleTextChange("subscriptionPlanListTitle")}
                  disabled={isSubmitting}
                  required
                />
              </Form.Group>
              <Form.Group controlId="admin-bot-planlist-body" className="mt-3">
                <Form.Label>Mensagem da lista de planos</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  value={formState.subscriptionPlanListBody}
                  onChange={handleTextChange("subscriptionPlanListBody")}
                  disabled={isSubmitting}
                  required
                />
              </Form.Group>
              <Form.Group controlId="admin-bot-planlist-button" className="mt-3">
                <Form.Label>Botão da lista</Form.Label>
                <Form.Control
                  type="text"
                  value={formState.subscriptionPlanListButtonText}
                  onChange={handleTextChange("subscriptionPlanListButtonText")}
                  disabled={isSubmitting}
                  required
                />
              </Form.Group>
              <Form.Group controlId="admin-bot-planlist-footer" className="mt-3">
                <Form.Label>Rodapé da lista</Form.Label>
                <Form.Control
                  type="text"
                  value={formState.subscriptionPlanListFooterText}
                  onChange={handleTextChange("subscriptionPlanListFooterText")}
                  disabled={isSubmitting}
                />
              </Form.Group>
            </Col>
          </Row>

          <div className="d-flex gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Salvar alterações"}
            </Button>
            <Button
              type="button"
              variant="outline-secondary"
              disabled={isSubmitting}
              onClick={() => {
                setFormState(toFormState(config));
                setPreviewUrl(null);
                setCurrentImageUrl(config.menuImageUrl);
                setFeedback(null);
              }}
            >
              Restaurar valores carregados
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
};

export default AdminBotMenuEditor;
