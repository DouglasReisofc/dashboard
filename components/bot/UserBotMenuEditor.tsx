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
  categoryTemplateTokens,
  defaultMenuButtonLabels,
  defaultMenuFooterText,
  defaultMenuText,
  defaultMenuVariables,
  defaultSupportReplyText,
} from "lib/bot-menu";
import {
  META_INTERACTIVE_BODY_LIMIT,
  META_INTERACTIVE_BUTTON_LIMIT,
  META_INTERACTIVE_FOOTER_LIMIT,
  META_INTERACTIVE_HEADER_LIMIT,
  META_INTERACTIVE_ROW_DESCRIPTION_LIMIT,
  META_INTERACTIVE_ROW_TITLE_LIMIT,
  META_INTERACTIVE_SECTION_TITLE_LIMIT,
  META_MEDIA_CAPTION_LIMIT,
} from "lib/meta-limits";

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

type ViewId = "menu" | "categoryList" | "categoryDetail" | "autoReplies" | "variables";

type VariableGroupId = "global" | "categoryDetail";

type VariableDefinition = {
  token: string;
  description: string;
};

const VARIABLE_DESCRIPTIONS: Record<string, string> = {
  "{{nome_cliente}}": "Substitui pelo nome exibido no contato recebido pelo webhook.",
  "{{numero_cliente}}": "Substitui pelo número de WhatsApp do cliente.",
  "{{saldo_cliente}}": "Exibe o saldo atual salvo para o cliente no painel de Clientes.",
  "{{id_categoria}}": "Permite informar a categoria atual quando um produto estiver vinculado.",
  "{{nome_categoria}}": "Mostra o título da categoria selecionada pelo cliente.",
  "{{preco_categoria}}": "Exibe o valor configurado para a categoria atual com formatação monetária.",
  "{{descricao_categoria}}": "Inclui a descrição detalhada da categoria, se disponível.",
};

const toVariableDefinitions = (tokens: readonly string[]): VariableDefinition[] =>
  Array.from(new Set(tokens)).map((token) => ({
    token,
    description:
      VARIABLE_DESCRIPTIONS[token] ??
      "Essa variável será substituída automaticamente quando o bot enviar a mensagem.",
  }));

const VARIABLE_GROUPS: Record<VariableGroupId, {
  title: string;
  description: string;
  tokens: VariableDefinition[];
}> = {
  global: {
    title: "Variáveis globais",
    description: "Disponíveis em qualquer mensagem enviada pelo bot.",
    tokens: toVariableDefinitions(defaultMenuVariables),
  },
  categoryDetail: {
    title: "Detalhes da categoria",
    description: "Aplicam-se aos cartões com imagem e botão 'Comprar' de cada categoria.",
    tokens: toVariableDefinitions(categoryTemplateTokens),
  },
};

const VIEW_VARIABLE_GROUPS: Record<ViewId, VariableGroupId[]> = {
  menu: ["global"],
  categoryList: ["global"],
  categoryDetail: ["global", "categoryDetail"],
  autoReplies: ["global"],
  variables: ["global", "categoryDetail"],
};

interface ViewOption {
  id: ViewId;
  label: string;
  description: string;
}

interface UserBotMenuEditorProps {
  config: BotMenuConfig | null;
}

const UserBotMenuEditor = ({ config }: UserBotMenuEditorProps) => {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeView, setActiveView] = useState<ViewId>("menu");
  const [formState, setFormState] = useState<FormState>({
    menuText: config?.menuText ?? defaultMenuText,
    menuFooterText: config?.menuFooterText ?? defaultMenuFooterText,
    menuButtonBuyText: config?.menuButtonBuyText ?? defaultMenuButtonLabels.buy,
    menuButtonAddBalanceText: config?.menuButtonAddBalanceText ?? defaultMenuButtonLabels.addBalance,
    menuButtonSupportText: config?.menuButtonSupportText ?? defaultMenuButtonLabels.support,
    categoryListHeaderText: config?.categoryListHeaderText ?? defaultCategoryListHeaderText,
    categoryListBodyText: config?.categoryListBodyText ?? defaultCategoryListBodyText,
    categoryListFooterText: config?.categoryListFooterText ?? defaultCategoryListFooterText,
    categoryListFooterMoreText:
      config?.categoryListFooterMoreText ?? defaultCategoryListFooterMoreText,
    categoryListButtonText: config?.categoryListButtonText ?? defaultCategoryListButtonText,
    categoryListSectionTitle: config?.categoryListSectionTitle ?? defaultCategoryListSectionTitle,
    categoryListNextTitle: config?.categoryListNextTitle ?? defaultCategoryListNextTitle,
    categoryListNextDescription:
      config?.categoryListNextDescription ?? defaultCategoryListNextDescription,
    categoryListEmptyText: config?.categoryListEmptyText ?? defaultCategoryListEmptyText,
    categoryDetailBodyText: config?.categoryDetailBodyText ?? defaultCategoryDetailBodyText,
    categoryDetailFooterText:
      config?.categoryDetailFooterText ?? defaultCategoryDetailFooterText,
    categoryDetailButtonText: config?.categoryDetailButtonText ?? defaultCategoryDetailButtonText,
    categoryDetailFileCaption:
      config?.categoryDetailFileCaption ?? defaultCategoryDetailFileCaption,
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

  const viewOptions = useMemo<ViewOption[]>(
    () => [
      {
        id: "menu",
        label: "Menu principal",
        description:
          "Personalize a mensagem formal, o rodapé, a mídia e os botões exibidos sempre que o cliente receber o menu principal.",
      },
      {
        id: "categoryList",
        label: "Lista de categorias",
        description:
          "Defina títulos, descrições e mensagens de navegação utilizados quando o bot envia a lista interativa de categorias.",
      },
      {
        id: "categoryDetail",
        label: "Detalhes da categoria",
        description:
          "Ajuste os textos dos cartões com imagem, botão de compra e rodapés enviados ao selecionar uma categoria.",
      },
      {
        id: "autoReplies",
        label: "Respostas automáticas",
        description:
          "Configure as mensagens de saldo e suporte respondidas quando o cliente interage com os botões do menu.",
      },
      {
        id: "variables",
        label: "Variáveis",
        description:
          "Gerencie as variáveis disponíveis para personalizar qualquer mensagem enviada pelo chatbot.",
      },
    ],
    [],
  );

  const activeOption = useMemo(
    () => viewOptions.find((option) => option.id === activeView) ?? viewOptions[0],
    [activeView, viewOptions],
  );

  const renderVariableHelper = (view: ViewId) => {
    const groupIds = VIEW_VARIABLE_GROUPS[view] ?? [];

    if (groupIds.length === 0) {
      return null;
    }

    const isVariablesView = view === "variables";

    return (
      <div className="bg-light border rounded p-3">
        <p className="text-secondary small mb-3">
          {isVariablesView
            ? "Confira as variáveis disponíveis por contexto antes de adicionar novas personalizações."
            : "Variáveis disponíveis para personalizar este menu."}
        </p>

        {groupIds.map((groupId, index) => {
          const group = VARIABLE_GROUPS[groupId];

          if (!group || group.tokens.length === 0) {
            return null;
          }

          const marginClass = index === groupIds.length - 1 ? "mb-0" : "mb-3";

          return (
            <div key={groupId} className={marginClass}>
              <h3 className="h6 mb-2">{group.title}</h3>
              <p className="text-secondary small mb-2">{group.description}</p>

              <ul className="list-unstyled d-flex flex-column gap-2 mb-0">
                {group.tokens.map((variable) => (
                  <li key={variable.token}>
                    <strong className="d-block">{variable.token}</strong>
                    <span className="text-secondary small">{variable.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    );
  };

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
        <Card.Body className="d-flex flex-column gap-4">
          <div>
            <Card.Title as="h2" className="h4">
              Personalização do bot
            </Card.Title>
            <Card.Text className="text-secondary mb-3">
              Ajuste o menu principal, a lista de categorias e as respostas automáticas enviadas pelo chatbot
              da Meta Cloud API. Utilize as variáveis para manter cada mensagem personalizada.
            </Card.Text>

            <div className="d-flex flex-wrap gap-2">
              {viewOptions.map((option) => (
                <Button
                  key={option.id}
                  variant={activeView === option.id ? "primary" : "outline-primary"}
                  onClick={() => setActiveView(option.id)}
                >
                  {option.label}
                </Button>
              ))}
            </div>

            <Card.Text className="text-secondary mb-0 mt-3">{activeOption.description}</Card.Text>
          </div>

          {feedback && (
            <Alert variant={feedback.type} onClose={() => setFeedback(null)} dismissible>
              {feedback.message}
            </Alert>
          )}

          <Form onSubmit={handleSubmit} className="d-flex flex-column gap-4">
            {activeView === "menu" && (
              <section className="d-flex flex-column gap-3">
                <Form.Text className="text-secondary">
                  Personalize a mensagem formal enviada automaticamente logo após qualquer interação, incluindo
                  botões e imagem de destaque.
                </Form.Text>

                {renderVariableHelper("menu")}

                <Form.Group controlId="bot-menu-text">
                  <Form.Label>Texto do menu</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={6}
                    value={formState.menuText}
                    onChange={(event) => handleFieldChange("menuText", event.target.value)}
                    placeholder="Escreva a mensagem que será enviada automaticamente"
                    maxLength={META_INTERACTIVE_BODY_LIMIT}
                    required
                  />
                  <Form.Text className="text-secondary">
                    Máximo de {META_INTERACTIVE_BODY_LIMIT} caracteres exibidos no corpo do menu interativo.
                  </Form.Text>
                </Form.Group>

                <Form.Group controlId="bot-menu-footer">
                  <Form.Label>Rodapé do menu</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={formState.menuFooterText}
                    onChange={(event) => handleFieldChange("menuFooterText", event.target.value)}
                    placeholder="Texto exibido abaixo dos botões do menu principal"
                    maxLength={META_INTERACTIVE_FOOTER_LIMIT}
                  />
                  <Form.Text className="text-secondary">
                    Máximo de {META_INTERACTIVE_FOOTER_LIMIT} caracteres. Deixe em branco para ocultar o rodapé.
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
                        maxLength={META_INTERACTIVE_BUTTON_LIMIT}
                        required
                      />
                      <Form.Text className="text-secondary">
                        Máximo de {META_INTERACTIVE_BUTTON_LIMIT} caracteres. Opção exibida para iniciar uma compra.
                      </Form.Text>
                    </div>
                    <div className="col-12 col-md-4">
                      <Form.Control
                        value={formState.menuButtonAddBalanceText}
                        onChange={(event) => handleFieldChange("menuButtonAddBalanceText", event.target.value)}
                        placeholder="Botão para adicionar saldo"
                        maxLength={META_INTERACTIVE_BUTTON_LIMIT}
                        required
                      />
                      <Form.Text className="text-secondary">
                        Máximo de {META_INTERACTIVE_BUTTON_LIMIT} caracteres. Texto utilizado no botão de saldo.
                      </Form.Text>
                    </div>
                    <div className="col-12 col-md-4">
                      <Form.Control
                        value={formState.menuButtonSupportText}
                        onChange={(event) => handleFieldChange("menuButtonSupportText", event.target.value)}
                        placeholder="Botão de suporte"
                        maxLength={META_INTERACTIVE_BUTTON_LIMIT}
                        required
                      />
                      <Form.Text className="text-secondary">
                        Máximo de {META_INTERACTIVE_BUTTON_LIMIT} caracteres. Descrição do atalho para suporte.
                      </Form.Text>
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
            )}

            {activeView === "categoryList" && (
              <section className="d-flex flex-column gap-3">
                <Form.Text className="text-secondary">
                  Ajuste os textos exibidos quando o cliente abre a lista interativa de categorias e quando
                  há mais páginas disponíveis.
                </Form.Text>

                {renderVariableHelper("categoryList")}

                <Form.Group controlId="bot-list-header">
                  <Form.Label>Título da lista</Form.Label>
                  <Form.Control
                    value={formState.categoryListHeaderText}
                    onChange={(event) => handleFieldChange("categoryListHeaderText", event.target.value)}
                    placeholder="Ex: Comprar contas"
                    maxLength={META_INTERACTIVE_HEADER_LIMIT}
                    required
                  />
                  <Form.Text className="text-secondary">
                    Máximo de {META_INTERACTIVE_HEADER_LIMIT} caracteres exibidos no topo da lista.
                  </Form.Text>
                </Form.Group>

                <Form.Group controlId="bot-list-body">
                  <Form.Label>Descrição da lista</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={formState.categoryListBodyText}
                    onChange={(event) => handleFieldChange("categoryListBodyText", event.target.value)}
                    placeholder="Ex: Selecione a categoria que deseja comprar."
                    maxLength={META_INTERACTIVE_BODY_LIMIT}
                    required
                  />
                  <Form.Text className="text-secondary">
                    Máximo de {META_INTERACTIVE_BODY_LIMIT} caracteres mostrados na descrição da lista interativa.
                  </Form.Text>
                </Form.Group>

                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <Form.Group controlId="bot-list-button">
                      <Form.Label>Texto do botão da lista</Form.Label>
                      <Form.Control
                        value={formState.categoryListButtonText}
                        onChange={(event) => handleFieldChange("categoryListButtonText", event.target.value)}
                        placeholder="Ex: Ver categorias"
                        maxLength={META_INTERACTIVE_BUTTON_LIMIT}
                        required
                      />
                      <Form.Text className="text-secondary">
                        Máximo de {META_INTERACTIVE_BUTTON_LIMIT} caracteres no botão que abre a lista.
                      </Form.Text>
                    </Form.Group>
                  </div>
                  <div className="col-12 col-md-6">
                    <Form.Group controlId="bot-list-section">
                      <Form.Label>Título da seção</Form.Label>
                      <Form.Control
                        value={formState.categoryListSectionTitle}
                        onChange={(event) => handleFieldChange("categoryListSectionTitle", event.target.value)}
                        placeholder="Ex: Categorias disponíveis"
                        maxLength={META_INTERACTIVE_SECTION_TITLE_LIMIT}
                        required
                      />
                      <Form.Text className="text-secondary">
                        Máximo de {META_INTERACTIVE_SECTION_TITLE_LIMIT} caracteres para o título da seção da lista.
                      </Form.Text>
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
                    maxLength={META_INTERACTIVE_FOOTER_LIMIT}
                  />
                  <Form.Text className="text-secondary">
                    Máximo de {META_INTERACTIVE_FOOTER_LIMIT} caracteres. Deixe em branco para ocultar.
                  </Form.Text>
                </Form.Group>

                <Form.Group controlId="bot-list-footer-more">
                  <Form.Label>Rodapé quando houver mais páginas</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={formState.categoryListFooterMoreText}
                    onChange={(event) => handleFieldChange("categoryListFooterMoreText", event.target.value)}
                    placeholder="Instruções para acessar a próxima página"
                    maxLength={META_INTERACTIVE_FOOTER_LIMIT}
                  />
                  <Form.Text className="text-secondary">
                    Máximo de {META_INTERACTIVE_FOOTER_LIMIT} caracteres. Deixe em branco para usar o rodapé padrão.
                  </Form.Text>
                </Form.Group>

                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <Form.Group controlId="bot-list-next-title">
                      <Form.Label>Título do item &quot;próxima lista&quot;</Form.Label>
                      <Form.Control
                        value={formState.categoryListNextTitle}
                        onChange={(event) => handleFieldChange("categoryListNextTitle", event.target.value)}
                        placeholder="Ex: Próxima lista ▶️"
                        maxLength={META_INTERACTIVE_ROW_TITLE_LIMIT}
                        required
                      />
                      <Form.Text className="text-secondary">
                        Máximo de {META_INTERACTIVE_ROW_TITLE_LIMIT} caracteres para o item que carrega a próxima página.
                      </Form.Text>
                    </Form.Group>
                  </div>
                  <div className="col-12 col-md-6">
                    <Form.Group controlId="bot-list-next-description">
                      <Form.Label>Descrição do item &quot;próxima lista&quot;</Form.Label>
                      <Form.Control
                        value={formState.categoryListNextDescription}
                        onChange={(event) => handleFieldChange("categoryListNextDescription", event.target.value)}
                        placeholder="Ex: Visualizar mais categorias"
                        maxLength={META_INTERACTIVE_ROW_DESCRIPTION_LIMIT}
                        required
                      />
                      <Form.Text className="text-secondary">
                        Máximo de {META_INTERACTIVE_ROW_DESCRIPTION_LIMIT} caracteres para a descrição do item de próxima lista.
                      </Form.Text>
                    </Form.Group>
                  </div>
                </div>

                <Form.Group controlId="bot-list-empty">
                  <Form.Label>Mensagem quando não houver categorias</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={formState.categoryListEmptyText}
                    onChange={(event) => handleFieldChange("categoryListEmptyText", event.target.value)}
                    placeholder="Texto exibido quando nenhuma categoria está disponível"
                    maxLength={META_INTERACTIVE_BODY_LIMIT}
                    required
                  />
                  <Form.Text className="text-secondary">
                    Máximo de {META_INTERACTIVE_BODY_LIMIT} caracteres usados quando não há itens na lista.
                  </Form.Text>
                </Form.Group>
              </section>
            )}

            {activeView === "categoryDetail" && (
              <section className="d-flex flex-column gap-3">
                <Form.Text className="text-secondary">
                  Defina o conteúdo dos cartões enviados com imagem e botão interativo sempre que uma
                  categoria for selecionada.
                </Form.Text>

                {renderVariableHelper("categoryDetail")}

                <Form.Group controlId="bot-detail-body">
                  <Form.Label>Descrição do cartão</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={5}
                    value={formState.categoryDetailBodyText}
                    onChange={(event) => handleFieldChange("categoryDetailBodyText", event.target.value)}
                    placeholder="Texto mostrado junto com a imagem da categoria"
                    maxLength={META_INTERACTIVE_BODY_LIMIT}
                    required
                  />
                  <Form.Text className="text-secondary">
                    Máximo de {META_INTERACTIVE_BODY_LIMIT} caracteres exibidos no corpo do cartão interativo.
                  </Form.Text>
                </Form.Group>

                <Form.Group controlId="bot-detail-footer">
                  <Form.Label>Rodapé do cartão</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={formState.categoryDetailFooterText}
                    onChange={(event) => handleFieldChange("categoryDetailFooterText", event.target.value)}
                    placeholder="Mensagem exibida abaixo do botão de compra"
                    maxLength={META_INTERACTIVE_FOOTER_LIMIT}
                  />
                  <Form.Text className="text-secondary">
                    Máximo de {META_INTERACTIVE_FOOTER_LIMIT} caracteres. Deixe vazio para não exibir rodapé.
                  </Form.Text>
                </Form.Group>

                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <Form.Group controlId="bot-detail-button">
                      <Form.Label>Texto do botão de compra</Form.Label>
                      <Form.Control
                        value={formState.categoryDetailButtonText}
                        onChange={(event) => handleFieldChange("categoryDetailButtonText", event.target.value)}
                        placeholder="Ex: Comprar"
                        maxLength={META_INTERACTIVE_BUTTON_LIMIT}
                        required
                      />
                      <Form.Text className="text-secondary">
                        Máximo de {META_INTERACTIVE_BUTTON_LIMIT} caracteres exibidos no botão interativo.
                      </Form.Text>
                    </Form.Group>
                  </div>
                  <div className="col-12 col-md-6">
                    <Form.Group controlId="bot-detail-caption">
                      <Form.Label>Legenda do anexo do produto</Form.Label>
                      <Form.Control
                        value={formState.categoryDetailFileCaption}
                        onChange={(event) => handleFieldChange("categoryDetailFileCaption", event.target.value)}
                        placeholder="Ex: {{nome_categoria}} - dados complementares"
                        maxLength={META_MEDIA_CAPTION_LIMIT}
                      />
                      <Form.Text className="text-secondary">
                        Máximo de {META_MEDIA_CAPTION_LIMIT} caracteres utilizados como legenda do anexo enviado.
                      </Form.Text>
                    </Form.Group>
                  </div>
                </div>
              </section>
            )}

            {activeView === "autoReplies" && (
              <section className="d-flex flex-column gap-3">
                <Form.Text className="text-secondary">
                  Configure as respostas rápidas utilizadas quando o cliente toca nos botões de adicionar
                  saldo ou suporte.
                </Form.Text>

                {renderVariableHelper("autoReplies")}

                <Form.Group controlId="bot-reply-balance">
                  <Form.Label>Mensagem para adicionar saldo</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={formState.addBalanceReplyText}
                    onChange={(event) => handleFieldChange("addBalanceReplyText", event.target.value)}
                    placeholder="Orientações para o cliente adicionar saldo"
                    maxLength={META_INTERACTIVE_BODY_LIMIT}
                    required
                  />
                  <Form.Text className="text-secondary">
                    Máximo de {META_INTERACTIVE_BODY_LIMIT} caracteres enviados na resposta automática de saldo.
                  </Form.Text>
                </Form.Group>

                <Form.Group controlId="bot-reply-support">
                  <Form.Label>Mensagem de suporte</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={formState.supportReplyText}
                    onChange={(event) => handleFieldChange("supportReplyText", event.target.value)}
                    placeholder="Mensagem enviada ao acionar o suporte"
                    maxLength={META_INTERACTIVE_BODY_LIMIT}
                    required
                  />
                  <Form.Text className="text-secondary">
                    Máximo de {META_INTERACTIVE_BODY_LIMIT} caracteres respondidos automaticamente no suporte.
                  </Form.Text>
                </Form.Group>
              </section>
            )}

            {activeView === "variables" && (
              <section className="d-flex flex-column gap-3">
                {renderVariableHelper("variables")}

                <Form.Group controlId="bot-menu-variables">
                  <Form.Label>Variáveis personalizadas</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    value={formState.variables}
                    onChange={(event) => handleFieldChange("variables", event.target.value)}
                    placeholder="{{nome_cliente}}, {{numero_cliente}}"
                  />
                  <Form.Text className="text-secondary">
                    Separe as variáveis por vírgulas ou linhas. As variáveis globais (nome, número e saldo)
                    já ficam disponíveis em todos os menus.
                  </Form.Text>
                </Form.Group>
              </section>
            )}

            <div className="d-flex justify-content-end">
              <Button type="submit" variant="primary" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>

    </section>
  );
};

export default UserBotMenuEditor;
