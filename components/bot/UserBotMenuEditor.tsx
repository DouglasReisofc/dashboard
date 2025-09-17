"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Form, Image } from "react-bootstrap";
import { useRouter } from "next/navigation";

import { defaultMenuText, defaultMenuVariables } from "lib/bot-menu";

import type { BotMenuConfig } from "types/bot";

type Feedback = { type: "success" | "danger"; message: string } | null;

type FormState = {
  menuText: string;
  variables: string;
  imageFile: File | null;
  removeImage: boolean;
};

interface UserBotMenuEditorProps {
  config: BotMenuConfig | null;
}

const UserBotMenuEditor = ({ config }: UserBotMenuEditorProps) => {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formState, setFormState] = useState<FormState>({
    menuText: config?.menuText ?? defaultMenuText,
    variables:
      config?.variables && config.variables.length > 0
        ? config.variables.join(", ")
        : defaultMenuVariables.join(", "),
    imageFile: null,
    removeImage: false,
  });
  const [currentImagePath, setCurrentImagePath] = useState<string | null>(config?.imagePath ?? null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const availableVariables = useMemo(
    () => [
      {
        token: "{{nome_cliente}}",
        description: "Substitui pelo nome exibido no contato recebido pelo webhook.",
      },
      {
        token: "{{numero_cliente}}",
        description: "Substitui pelo número de WhatsApp do cliente.",
      },
      {
        token: "{{saldo_cliente}}",
        description: "Exibe o saldo atual salvo para o cliente no painel de Clientes.",
      },
      {
        token: "{{id_categoria}}",
        description: "Permite informar a categoria atual quando um produto estiver vinculado.",
      },
    ],
    [],
  );

  const handleFieldChange = <T extends keyof FormState>(field: T, value: FormState[T]) => {
    setFormState((previous) => ({ ...previous, [field]: value }));
  };

  const handleFileChange = (file: File | null) => {
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }

    handleFieldChange("imageFile", file);

    if (file) {
      const newPreview = URL.createObjectURL(file);
      setPreviewUrl(newPreview);
      handleFieldChange("removeImage", false);
      return;
    }

    setPreviewUrl(null);
  };

  const handleRemoveImageToggle = (checked: boolean) => {
    handleFieldChange("removeImage", checked);

    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(null);

    if (checked) {
      handleFieldChange("imageFile", null);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    const formData = new FormData();
    formData.append("menuText", formState.menuText);
    formData.append("variables", formState.variables);

    if (formState.imageFile) {
      formData.append("image", formState.imageFile);
    }

    if (formState.removeImage) {
      formData.append("removeImage", "true");
    }

    const response = await fetch("/api/bot/config", {
      method: "POST",
      body: formData,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setFeedback({
        type: "danger",
        message: data.message ?? "Não foi possível salvar a configuração do bot.",
      });
      setIsSubmitting(false);
      return;
    }

    const nextConfig = data.config as BotMenuConfig | undefined;

    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);

    setFeedback({
      type: "success",
      message: data.message ?? "Configuração do bot atualizada com sucesso.",
    });
    setIsSubmitting(false);

    if (nextConfig) {
      setFormState({
        menuText: nextConfig.menuText,
        variables:
          nextConfig.variables.length > 0 ? nextConfig.variables.join(", ") : "",
        imageFile: null,
        removeImage: false,
      });
      setCurrentImagePath(nextConfig.imagePath);
    } else {
      setCurrentImagePath(null);
    }

    router.refresh();
  };

  return (
    <section className="d-flex flex-column gap-4">
      <Card>
        <Card.Body>
          <Card.Title as="h2" className="h4">
            Conteúdo do menu automático
          </Card.Title>
          <Card.Text className="text-secondary">
            Defina a mensagem principal que será enviada pelo bot sempre que o webhook receber uma nova
            interação. Utilize as variáveis disponíveis para personalizar o atendimento.
          </Card.Text>

          {feedback && (
            <Alert
              variant={feedback.type}
              onClose={() => setFeedback(null)}
              dismissible
              className="mb-4"
            >
              {feedback.message}
            </Alert>
          )}

          <Form onSubmit={handleSubmit} className="d-flex flex-column gap-4">
            <Form.Group controlId="bot-menu-text">
              <Form.Label>Texto do menu</Form.Label>
              <Form.Control
                as="textarea"
                rows={6}
                value={formState.menuText}
                onChange={(event) => handleFieldChange("menuText", event.target.value)}
                placeholder="Escreva a mensagem que será enviada automaticamente"
                required
              />
              <Form.Text className="text-secondary">
                Este texto será utilizado nas respostas enviadas imediatamente após qualquer mensagem
                recebida pela Meta Cloud API.
              </Form.Text>
            </Form.Group>

            <Form.Group controlId="bot-menu-variables">
              <Form.Label>Variáveis personalizadas</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={formState.variables}
                onChange={(event) => handleFieldChange("variables", event.target.value)}
                placeholder="{{nome_cliente}}, {{numero_cliente}}"
              />
              <Form.Text className="text-secondary">
                Separe as variáveis por vírgulas ou linhas. Elas serão substituídas automaticamente ao
                enviar a mensagem para o cliente.
              </Form.Text>
            </Form.Group>

            <Form.Group controlId="bot-menu-image">
              <Form.Label>Mídia opcional</Form.Label>
              <Form.Control
                type="file"
                accept="image/*"
                onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
              />
              <Form.Text className="text-secondary d-block mb-2">
                Utilize uma imagem ou documento para complementar o menu enviado automaticamente.
              </Form.Text>

              {(previewUrl || currentImagePath) && (
                <div className="d-flex flex-column flex-md-row gap-3 align-items-md-center">
                  {(previewUrl || currentImagePath) && (
                    <Image
                      src={previewUrl ?? `/${currentImagePath}`}
                      alt="Pré-visualização da mídia do bot"
                      rounded
                      className="border"
                      style={{ maxWidth: "180px" }}
                    />
                  )}

                  {currentImagePath && (
                    <a href={`/${currentImagePath}`} target="_blank" rel="noreferrer">
                      Abrir mídia atual em nova aba
                    </a>
                  )}

                  {(currentImagePath || previewUrl) && (
                    <Form.Check
                      type="switch"
                      id="bot-remove-image"
                      label="Remover mídia ao salvar"
                      checked={formState.removeImage}
                      onChange={(event) => handleRemoveImageToggle(event.target.checked)}
                    />
                  )}
                </div>
              )}
            </Form.Group>

            <div className="d-flex justify-content-end">
              <Button type="submit" variant="primary" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>

      <Card>
        <Card.Body>
          <Card.Title as="h3" className="h5">
            Variáveis disponíveis
          </Card.Title>
          <Card.Text className="text-secondary">
            Você pode utilizar as variáveis abaixo no texto do menu. Elas serão substituídas dinamicamente
            quando a mensagem for disparada pelo webhook da Meta Cloud API.
          </Card.Text>

          <ul className="list-unstyled d-flex flex-column gap-3 mb-0">
            {availableVariables.map((variable) => (
              <li key={variable.token}>
                <strong className="d-block">{variable.token}</strong>
                <span className="text-secondary small">{variable.description}</span>
              </li>
            ))}
          </ul>
        </Card.Body>
      </Card>
    </section>
  );
};

export default UserBotMenuEditor;
