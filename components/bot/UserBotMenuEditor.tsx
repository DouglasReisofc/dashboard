"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Form, Image } from "react-bootstrap";
import { useRouter } from "next/navigation";

import {
  defaultAddBalanceReplyText,
  defaultCategoryDetailBodyText,
  defaultCategoryDetailButtonText,
  defaultCategoryDetailFileCaption,
  defaultCategoryDetailFooterText,
  defaultCategoryListBodyText,
  defaultCategoryListButtonText,
  defaultCategoryListEmptyText,
  defaultCategoryListFooterMoreText,
  defaultCategoryListFooterText,
  defaultCategoryListHeaderText,
  defaultCategoryListNextDescription,
  defaultCategoryListNextTitle,
  defaultCategoryListSectionTitle,
  defaultMenuButtonLabels,
  defaultMenuFooterText,
  defaultMenuText,
  defaultMenuVariables,
  defaultSupportReplyText,
} from "lib/bot-menu";

import type { BotMenuConfig } from "types/bot";

type Feedback = { type: "success" | "danger"; message: string } | null;

type FormState = {
  menuText: string;
  menuFooterText: string;
  menuButtonBuyText: string;
  menuButtonAddBalanceText: string;
  menuButtonSupportText: string;
  categoryListHeaderText: string;
  categoryListBodyText: string;
  categoryListFooterText: string;
  categoryListFooterMoreText: string;
  categoryListButtonText: string;
  categoryListSectionTitle: string;
  categoryListNextTitle: string;
  categoryListNextDescription: string;
  categoryListEmptyText: string;
  categoryDetailBodyText: string;
  categoryDetailFooterText: string;
  categoryDetailButtonText: string;
  categoryDetailFileCaption: string;
  addBalanceReplyText: string;
  supportReplyText: string;
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
  const hasExistingConfig = Boolean(config);
  const [formState, setFormState] = useState<FormState>({
    menuText: config?.menuText ?? defaultMenuText,
    menuFooterText: hasExistingConfig ? config?.menuFooterText ?? "" : defaultMenuFooterText,
    menuButtonBuyText: config?.menuButtonBuyText ?? defaultMenuButtonLabels.buy,
    menuButtonAddBalanceText: config?.menuButtonAddBalanceText ?? defaultMenuButtonLabels.addBalance,
    menuButtonSupportText: config?.menuButtonSupportText ?? defaultMenuButtonLabels.support,
    categoryListHeaderText: config?.categoryListHeaderText ?? defaultCategoryListHeaderText,
    categoryListBodyText: config?.categoryListBodyText ?? defaultCategoryListBodyText,
    categoryListFooterText: hasExistingConfig
      ? config?.categoryListFooterText ?? ""
      : defaultCategoryListFooterText,
    categoryListFooterMoreText: hasExistingConfig
      ? config?.categoryListFooterMoreText ?? ""
      : defaultCategoryListFooterMoreText,
    categoryListButtonText: config?.categoryListButtonText ?? defaultCategoryListButtonText,
    categoryListSectionTitle: config?.categoryListSectionTitle ?? defaultCategoryListSectionTitle,
    categoryListNextTitle: config?.categoryListNextTitle ?? defaultCategoryListNextTitle,
    categoryListNextDescription:
      config?.categoryListNextDescription ?? defaultCategoryListNextDescription,
    categoryListEmptyText: config?.categoryListEmptyText ?? defaultCategoryListEmptyText,
    categoryDetailBodyText: config?.categoryDetailBodyText ?? defaultCategoryDetailBodyText,
    categoryDetailFooterText: hasExistingConfig
      ? config?.categoryDetailFooterText ?? ""
      : defaultCategoryDetailFooterText,
    categoryDetailButtonText: config?.categoryDetailButtonText ?? defaultCategoryDetailButtonText,
    categoryDetailFileCaption: hasExistingConfig
      ? config?.categoryDetailFileCaption ?? ""
      : defaultCategoryDetailFileCaption,
    addBalanceReplyText: config?.addBalanceReplyText ?? defaultAddBalanceReplyText,
    supportReplyText: config?.supportReplyText ?? defaultSupportReplyText,
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
      {
        token: "{{nome_categoria}}",
        description: "Mostra o título da categoria selecionada pelo cliente.",
      },
      {
        token: "{{preco_categoria}}",
        description: "Exibe o valor configurado para a categoria atual com formatação monetária.",
      },
      {
        token: "{{descricao_categoria}}",
        description: "Inclui a descrição detalhada da categoria, se disponível.",
      },
      {
        token: "{{pagina_atual}}",
        description: "Indica o número da página atual na lista de categorias.",
      },
      {
        token: "{{total_paginas}}",
        description: "Mostra o total de páginas disponíveis na lista de categorias.",
      },
      {
        token: "{{categorias_total}}",
        description: "Quantidade total de categorias ativas que podem ser exibidas.",
      },
      {
        token: "{{categorias_pagina}}",
        description: "Quantidade de categorias listadas na página atual.",
      },
      {
        token: "{{proxima_pagina}}",
        description: "Número da próxima página disponível na listagem, quando existir.",
      },
      {
        token: "{{possui_proxima_pagina}}",
        description: "Retorna 'Sim' quando há mais páginas disponíveis ou 'Não' caso contrário.",
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
    formData.append("menuFooterText", formState.menuFooterText);
    formData.append("menuButtonBuyText", formState.menuButtonBuyText);
    formData.append("menuButtonAddBalanceText", formState.menuButtonAddBalanceText);
    formData.append("menuButtonSupportText", formState.menuButtonSupportText);
    formData.append("categoryListHeaderText", formState.categoryListHeaderText);
    formData.append("categoryListBodyText", formState.categoryListBodyText);
    formData.append("categoryListFooterText", formState.categoryListFooterText);
    formData.append("categoryListFooterMoreText", formState.categoryListFooterMoreText);
    formData.append("categoryListButtonText", formState.categoryListButtonText);
    formData.append("categoryListSectionTitle", formState.categoryListSectionTitle);
    formData.append("categoryListNextTitle", formState.categoryListNextTitle);
    formData.append("categoryListNextDescription", formState.categoryListNextDescription);
    formData.append("categoryListEmptyText", formState.categoryListEmptyText);
    formData.append("categoryDetailBodyText", formState.categoryDetailBodyText);
    formData.append("categoryDetailFooterText", formState.categoryDetailFooterText);
    formData.append("categoryDetailButtonText", formState.categoryDetailButtonText);
    formData.append("categoryDetailFileCaption", formState.categoryDetailFileCaption);
    formData.append("addBalanceReplyText", formState.addBalanceReplyText);
    formData.append("supportReplyText", formState.supportReplyText);
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
        menuFooterText: nextConfig.menuFooterText ?? "",
        menuButtonBuyText: nextConfig.menuButtonBuyText,
        menuButtonAddBalanceText: nextConfig.menuButtonAddBalanceText,
        menuButtonSupportText: nextConfig.menuButtonSupportText,
        categoryListHeaderText: nextConfig.categoryListHeaderText,
        categoryListBodyText: nextConfig.categoryListBodyText,
        categoryListFooterText: nextConfig.categoryListFooterText ?? "",
        categoryListFooterMoreText: nextConfig.categoryListFooterMoreText ?? "",
        categoryListButtonText: nextConfig.categoryListButtonText,
        categoryListSectionTitle: nextConfig.categoryListSectionTitle,
        categoryListNextTitle: nextConfig.categoryListNextTitle,
        categoryListNextDescription: nextConfig.categoryListNextDescription,
        categoryListEmptyText: nextConfig.categoryListEmptyText,
        categoryDetailBodyText: nextConfig.categoryDetailBodyText,
        categoryDetailFooterText: nextConfig.categoryDetailFooterText ?? "",
        categoryDetailButtonText: nextConfig.categoryDetailButtonText,
        categoryDetailFileCaption: nextConfig.categoryDetailFileCaption ?? "",
        addBalanceReplyText: nextConfig.addBalanceReplyText,
        supportReplyText: nextConfig.supportReplyText,
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
            Personalização do bot
          </Card.Title>
          <Card.Text className="text-secondary">
            Ajuste o menu principal, a lista de categorias e as respostas automáticas enviadas pelo chatbot
            da Meta Cloud API. Utilize as variáveis para manter cada mensagem personalizada.
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
            <section className="d-flex flex-column gap-3">
              <h3 className="h5 mb-1">Menu principal</h3>
              <Form.Text className="text-secondary">
                Personalize a mensagem e os botões enviados automaticamente logo após qualquer interação.
              </Form.Text>

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
              </Form.Group>

              <Form.Group controlId="bot-menu-footer">
                <Form.Label>Rodapé do menu</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={formState.menuFooterText}
                  onChange={(event) => handleFieldChange("menuFooterText", event.target.value)}
                  placeholder="Texto exibido abaixo dos botões do menu principal"
                />
                <Form.Text className="text-secondary">
                  Deixe em branco para ocultar o rodapé.
                </Form.Text>
              </Form.Group>

              <Form.Group controlId="bot-menu-buttons">
                <Form.Label>Textos dos botões</Form.Label>
                <div className="row g-3">
                  <div className="col-12 col-md-4">
                    <Form.Control
                      value={formState.menuButtonBuyText}
                      onChange={(event) => handleFieldChange("menuButtonBuyText", event.target.value)}
                      placeholder="Botão para compras"
                      required
                    />
                    <Form.Text className="text-secondary">Opção exibida para iniciar uma compra.</Form.Text>
                  </div>
                  <div className="col-12 col-md-4">
                    <Form.Control
                      value={formState.menuButtonAddBalanceText}
                      onChange={(event) => handleFieldChange("menuButtonAddBalanceText", event.target.value)}
                      placeholder="Botão para adicionar saldo"
                      required
                    />
                    <Form.Text className="text-secondary">Texto utilizado no botão de saldo.</Form.Text>
                  </div>
                  <div className="col-12 col-md-4">
                    <Form.Control
                      value={formState.menuButtonSupportText}
                      onChange={(event) => handleFieldChange("menuButtonSupportText", event.target.value)}
                      placeholder="Botão de suporte"
                      required
                    />
                    <Form.Text className="text-secondary">Descrição do atalho para suporte.</Form.Text>
                  </div>
                </div>
              </Form.Group>

              <Form.Group controlId="bot-menu-image">
                <Form.Label>Mídia opcional</Form.Label>
                <Form.Control
                  type="file"
                  accept="image/*"
                  onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
                />
                <Form.Text className="text-secondary d-block mb-2">
                  Utilize uma imagem para destacar o menu enviado automaticamente.
                </Form.Text>

                {(previewUrl || currentImagePath) && (
                  <div className="d-flex flex-column flex-md-row gap-3 align-items-md-center">
                    <Image
                      src={previewUrl ?? `/${currentImagePath}`}
                      alt="Pré-visualização da mídia do bot"
                      rounded
                      className="border"
                      style={{ maxWidth: "180px" }}
                    />

                    {currentImagePath && (
                      <a href={`/${currentImagePath}`} target="_blank" rel="noreferrer">
                        Abrir mídia atual em nova aba
                      </a>
                    )}

                    <Form.Check
                      type="switch"
                      id="bot-remove-image"
                      label="Remover mídia ao salvar"
                      checked={formState.removeImage}
                      onChange={(event) => handleRemoveImageToggle(event.target.checked)}
                    />
                  </div>
                )}
              </Form.Group>
            </section>

            <section className="d-flex flex-column gap-3">
              <h3 className="h5 mb-1">Lista de categorias</h3>
              <Form.Text className="text-secondary">
                Ajuste os textos exibidos quando o cliente abre a lista interativa de categorias.
              </Form.Text>

              <Form.Group controlId="bot-list-header">
                <Form.Label>Título da lista</Form.Label>
                <Form.Control
                  value={formState.categoryListHeaderText}
                  onChange={(event) => handleFieldChange("categoryListHeaderText", event.target.value)}
                  placeholder="Ex: Comprar contas"
                  required
                />
              </Form.Group>

              <Form.Group controlId="bot-list-body">
                <Form.Label>Descrição da lista</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={formState.categoryListBodyText}
                  onChange={(event) => handleFieldChange("categoryListBodyText", event.target.value)}
                  placeholder="Ex: Selecione a categoria desejada ({{pagina_atual}}/{{total_paginas}})."
                  required
                />
              </Form.Group>

              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <Form.Group controlId="bot-list-button">
                    <Form.Label>Texto do botão da lista</Form.Label>
                    <Form.Control
                      value={formState.categoryListButtonText}
                      onChange={(event) => handleFieldChange("categoryListButtonText", event.target.value)}
                      placeholder="Ex: Ver categorias"
                      required
                    />
                  </Form.Group>
                </div>
                <div className="col-12 col-md-6">
                  <Form.Group controlId="bot-list-section">
                    <Form.Label>Título da seção</Form.Label>
                    <Form.Control
                      value={formState.categoryListSectionTitle}
                      onChange={(event) => handleFieldChange("categoryListSectionTitle", event.target.value)}
                      placeholder="Ex: Página {{pagina_atual}}/{{total_paginas}}"
                      required
                    />
                  </Form.Group>
                </div>
              </div>

              <Form.Group controlId="bot-list-footer">
                <Form.Label>Rodapé quando for a última página</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={formState.categoryListFooterText}
                  onChange={(event) => handleFieldChange("categoryListFooterText", event.target.value)}
                  placeholder="Mensagem exibida quando não há mais páginas"
                />
              </Form.Group>

              <Form.Group controlId="bot-list-footer-more">
                <Form.Label>Rodapé quando houver mais páginas</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={formState.categoryListFooterMoreText}
                  onChange={(event) => handleFieldChange("categoryListFooterMoreText", event.target.value)}
                  placeholder="Instruções para acessar a próxima página"
                />
              </Form.Group>

              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <Form.Group controlId="bot-list-next-title">
                    <Form.Label>Título do item &quot;próxima lista&quot;</Form.Label>
                    <Form.Control
                      value={formState.categoryListNextTitle}
                      onChange={(event) => handleFieldChange("categoryListNextTitle", event.target.value)}
                      placeholder="Ex: Próxima lista ▶️"
                      required
                    />
                  </Form.Group>
                </div>
                <div className="col-12 col-md-6">
                  <Form.Group controlId="bot-list-next-description">
                    <Form.Label>Descrição do item &quot;próxima lista&quot;</Form.Label>
                    <Form.Control
                      value={formState.categoryListNextDescription}
                      onChange={(event) => handleFieldChange("categoryListNextDescription", event.target.value)}
                      placeholder="Ex: Ver mais categorias ({{proxima_pagina}}/{{total_paginas}})"
                      required
                    />
                  </Form.Group>
                </div>
              </div>

              <Form.Group controlId="bot-list-empty">
                <Form.Label>Mensagem sem categorias ativas</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={formState.categoryListEmptyText}
                  onChange={(event) => handleFieldChange("categoryListEmptyText", event.target.value)}
                  placeholder="Texto enviado quando não há categorias disponíveis"
                  required
                />
              </Form.Group>
            </section>

            <section className="d-flex flex-column gap-3">
              <h3 className="h5 mb-1">Detalhes da categoria</h3>
              <Form.Text className="text-secondary">
                Mensagens enviadas quando o cliente seleciona uma categoria específica.
              </Form.Text>

              <Form.Group controlId="bot-detail-body">
                <Form.Label>Descrição detalhada</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  value={formState.categoryDetailBodyText}
                  onChange={(event) => handleFieldChange("categoryDetailBodyText", event.target.value)}
                  placeholder="Conteúdo exibido no cartão com imagem da categoria"
                  required
                />
              </Form.Group>

              <Form.Group controlId="bot-detail-footer">
                <Form.Label>Rodapé do cartão</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={formState.categoryDetailFooterText}
                  onChange={(event) => handleFieldChange("categoryDetailFooterText", event.target.value)}
                  placeholder="Mensagem exibida abaixo do botão de compra"
                />
                <Form.Text className="text-secondary">Deixe vazio para não exibir rodapé.</Form.Text>
              </Form.Group>

              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <Form.Group controlId="bot-detail-button">
                    <Form.Label>Texto do botão de compra</Form.Label>
                    <Form.Control
                      value={formState.categoryDetailButtonText}
                      onChange={(event) => handleFieldChange("categoryDetailButtonText", event.target.value)}
                      placeholder="Ex: Comprar"
                      required
                    />
                  </Form.Group>
                </div>
                <div className="col-12 col-md-6">
                  <Form.Group controlId="bot-detail-caption">
                    <Form.Label>Legenda do anexo do produto</Form.Label>
                    <Form.Control
                      value={formState.categoryDetailFileCaption}
                      onChange={(event) => handleFieldChange("categoryDetailFileCaption", event.target.value)}
                      placeholder="Ex: {{nome_categoria}} - dados complementares"
                    />
                    <Form.Text className="text-secondary">Deixe vazio para não enviar legenda.</Form.Text>
                  </Form.Group>
                </div>
              </div>
            </section>

            <section className="d-flex flex-column gap-3">
              <h3 className="h5 mb-1">Respostas automáticas</h3>
              <Form.Text className="text-secondary">
                Mensagens enviadas quando o cliente solicita adicionar saldo ou aciona o suporte.
              </Form.Text>

              <Form.Group controlId="bot-reply-balance">
                <Form.Label>Mensagem para adicionar saldo</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={formState.addBalanceReplyText}
                  onChange={(event) => handleFieldChange("addBalanceReplyText", event.target.value)}
                  placeholder="Orientações para o cliente adicionar saldo"
                  required
                />
              </Form.Group>

              <Form.Group controlId="bot-reply-support">
                <Form.Label>Mensagem de suporte</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={formState.supportReplyText}
                  onChange={(event) => handleFieldChange("supportReplyText", event.target.value)}
                  placeholder="Mensagem enviada ao acionar o suporte"
                  required
                />
              </Form.Group>
            </section>

            <section className="d-flex flex-column gap-3">
              <h3 className="h5 mb-1">Variáveis personalizadas</h3>
              <Form.Text className="text-secondary">
                Separe as variáveis por vírgulas ou linhas. Elas serão substituídas automaticamente ao
                enviar qualquer mensagem configurada acima.
              </Form.Text>

              <Form.Group controlId="bot-menu-variables">
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={formState.variables}
                  onChange={(event) => handleFieldChange("variables", event.target.value)}
                  placeholder="{{nome_cliente}}, {{numero_cliente}}"
                />
              </Form.Group>
            </section>

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
            Você pode utilizar as variáveis abaixo em qualquer mensagem configurada acima. Elas serão
            substituídas dinamicamente quando a resposta for disparada pelo webhook da Meta Cloud API.
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
