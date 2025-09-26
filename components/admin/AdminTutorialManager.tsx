"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { Alert, Button, Card, Col, Form, Row } from "react-bootstrap";
import { IconPhoto, IconVideo } from "@tabler/icons-react";

import type { FieldTutorial, FieldTutorialMap } from "types/tutorials";
import { WEBHOOK_TUTORIAL_FIELDS } from "types/tutorials";

type Feedback = { type: "success" | "danger"; message: string } | null;

type TutorialFormState = {
  title: string;
  description: string;
  mediaType: "image" | "video" | "";
  file: File | null;
  feedback: Feedback;
  isSubmitting: boolean;
};

const DEFAULT_DESCRIPTION = "Preencha as instruções que serão apresentadas aos usuários nesta etapa.";

const createInitialState = (
  tutorials: FieldTutorialMap,
  slug: string,
  fallbackTitle: string,
): TutorialFormState => {
  const tutorial = tutorials[slug];
  return {
    title: tutorial?.title ?? fallbackTitle,
    description: tutorial?.description ?? "",
    mediaType: tutorial?.mediaType ?? (tutorial?.mediaUrl ? "image" : ""),
    file: null,
    feedback: null,
    isSubmitting: false,
  };
};

type Props = {
  tutorials: FieldTutorialMap;
};

const AdminTutorialManager = ({ tutorials }: Props) => {
  const [tutorialMap, setTutorialMap] = useState<FieldTutorialMap>(() => ({ ...tutorials }));
  const [formState, setFormState] = useState<Record<string, TutorialFormState>>(() => {
    const nextState: Record<string, TutorialFormState> = {};
    for (const field of WEBHOOK_TUTORIAL_FIELDS) {
      nextState[field.slug] = createInitialState(tutorials, field.slug, field.label);
    }
    return nextState;
  });

  const totalConfigured = useMemo(
    () => Object.values(tutorialMap).filter((tutorial) => Boolean(tutorial?.description)).length,
    [tutorialMap],
  );

  const updateFormState = (slug: string, patch: Partial<TutorialFormState>) => {
    setFormState((previous) => ({
      ...previous,
      [slug]: { ...previous[slug], ...patch },
    }));
  };

  const handleInputChange = (slug: string, field: "title" | "description") =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.currentTarget.value;
      updateFormState(slug, { [field]: value } as Partial<TutorialFormState>);
    };

  const handleMediaTypeChange = (slug: string) =>
    (event: ChangeEvent<HTMLSelectElement>) => {
      const value = event.currentTarget.value;
      if (value !== "image" && value !== "video" && value !== "") {
        return;
      }
      updateFormState(slug, { mediaType: value as TutorialFormState["mediaType"] });
    };

  const handleFileChange = (slug: string) => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null;
    const detectedType = file?.type.startsWith("video/")
      ? "video"
      : file?.type.startsWith("image/")
      ? "image"
      : "";
    updateFormState(slug, { file, mediaType: detectedType });
  };

  const sendRequest = async (
    slug: string,
    bodyBuilder: (formData: FormData) => void,
  ): Promise<Response> => {
    const formData = new FormData();
    bodyBuilder(formData);
    return fetch(`/api/admin/tutorials/${slug}`, {
      method: "PUT",
      body: formData,
    });
  };

  const handleSubmit = (slug: string) => async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const state = formState[slug];
    if (!state) {
      return;
    }

    updateFormState(slug, { isSubmitting: true, feedback: null });

    try {
      const response = await sendRequest(slug, (formData) => {
        formData.append("title", state.title);
        formData.append("description", state.description || DEFAULT_DESCRIPTION);
        formData.append("mediaType", state.mediaType ?? "");
        if (state.file) {
          formData.append("media", state.file);
        }
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message = payload?.message ?? "Não foi possível salvar o tutorial.";
        updateFormState(slug, {
          feedback: { type: "danger", message },
          isSubmitting: false,
        });
        return;
      }

      const tutorial = payload?.tutorial as FieldTutorial | undefined;
      if (tutorial) {
        setTutorialMap((previous) => ({ ...previous, [tutorial.slug]: tutorial }));
        updateFormState(slug, {
          title: tutorial.title,
          description: tutorial.description,
          mediaType: tutorial.mediaType ?? "",
          file: null,
          feedback: { type: "success", message: payload?.message ?? "Tutorial salvo com sucesso." },
          isSubmitting: false,
        });
      } else {
        updateFormState(slug, {
          feedback: { type: "success", message: payload?.message ?? "Tutorial salvo com sucesso." },
          isSubmitting: false,
        });
      }
    } catch (error) {
      console.error("Failed to submit tutorial", error);
      updateFormState(slug, {
        feedback: {
          type: "danger",
          message: "Não foi possível salvar o tutorial. Tente novamente em instantes.",
        },
        isSubmitting: false,
      });
    }
  };

  const handleRemoveMedia = (slug: string) => async () => {
    const state = formState[slug];
    if (!state) {
      return;
    }

    updateFormState(slug, { isSubmitting: true, feedback: null });

    try {
      const response = await sendRequest(slug, (formData) => {
        formData.append("title", state.title);
        formData.append("description", state.description || DEFAULT_DESCRIPTION);
        formData.append("removeMedia", "true");
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message = payload?.message ?? "Não foi possível remover a mídia.";
        updateFormState(slug, {
          feedback: { type: "danger", message },
          isSubmitting: false,
        });
        return;
      }

      const tutorial = payload?.tutorial as FieldTutorial | undefined;
      setTutorialMap((previous) => {
        if (tutorial) {
          return { ...previous, [slug]: tutorial };
        }

        const existing = previous[slug];
        if (!existing) {
          return previous;
        }

        return {
          ...previous,
          [slug]: {
            ...existing,
            mediaUrl: null,
            mediaPath: null,
            mediaType: null,
            updatedAt: new Date().toISOString(),
          },
        };
      });

      updateFormState(slug, {
        mediaType: "",
        file: null,
        feedback: { type: "success", message: payload?.message ?? "Mídia removida com sucesso." },
        isSubmitting: false,
      });
    } catch (error) {
      console.error("Failed to remove tutorial media", error);
      updateFormState(slug, {
        feedback: {
          type: "danger",
          message: "Não foi possível remover a mídia. Tente novamente em instantes.",
        },
        isSubmitting: false,
      });
    }
  };

  const renderMediaPreview = (tutorial?: FieldTutorial) => {
    if (!tutorial?.mediaUrl) {
      return null;
    }

    if (tutorial.mediaType === "video") {
      return (
        <video
          controls
          className="w-100 rounded border"
          src={tutorial.mediaUrl}
          aria-label="Pré-visualização do vídeo do tutorial"
        />
      );
    }

    return (
      <img
        src={tutorial.mediaUrl}
        alt="Pré-visualização do tutorial"
        className="img-fluid rounded border"
      />
    );
  };

  return (
    <div className="d-flex flex-column gap-4">
      <div>
        <h2 className="h4 mb-1">Tutoriais de configuração do webhook</h2>
        <p className="text-secondary mb-0">
          Cadastre vídeos ou imagens com instruções específicas para cada campo das credenciais do
          webhook. Os usuários visualizarão esses tutoriais em modais contextuais.
        </p>
        <p className="text-secondary small mb-0 mt-2">
          {totalConfigured > 0
            ? `${totalConfigured} campo(s) possuem tutoriais configurados.`
            : "Nenhum tutorial configurado até o momento."}
        </p>
      </div>

      <Row className="g-4">
        {WEBHOOK_TUTORIAL_FIELDS.map((field) => {
          const tutorial = tutorialMap[field.slug];
          const state = formState[field.slug];
          const hasMedia = Boolean(tutorial?.mediaUrl);

          return (
            <Col key={field.slug} xs={12} xl={6}>
              <Card className="h-100">
                <Card.Header>
                  <Card.Title as="h3" className="h5 mb-0">
                    {field.label}
                  </Card.Title>
                  <Card.Text className="text-secondary small mb-0 mt-1">
                    {field.description}
                  </Card.Text>
                </Card.Header>
                <Card.Body>
                  <Form onSubmit={handleSubmit(field.slug)} className="d-flex flex-column gap-3">
                    {state?.feedback && (
                      <Alert
                        variant={state.feedback.type === "success" ? "success" : "danger"}
                        onClose={() => updateFormState(field.slug, { feedback: null })}
                        dismissible
                        className="mb-0"
                      >
                        {state.feedback.message}
                      </Alert>
                    )}

                    <Form.Group controlId={`${field.slug}-title`}>
                      <Form.Label>Título do tutorial</Form.Label>
                      <Form.Control
                        value={state?.title ?? ""}
                        onChange={handleInputChange(field.slug, "title")}
                        placeholder="Ex.: Como preencher este campo"
                        disabled={state?.isSubmitting}
                        required
                      />
                    </Form.Group>

                    <Form.Group controlId={`${field.slug}-description`}>
                      <Form.Label>Descrição detalhada</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={4}
                        value={state?.description ?? ""}
                        onChange={handleInputChange(field.slug, "description")}
                        placeholder={DEFAULT_DESCRIPTION}
                        disabled={state?.isSubmitting}
                        required
                      />
                    </Form.Group>

                    <div className="d-flex flex-column gap-2">
                      <Form.Label className="mb-0">Mídia de apoio</Form.Label>
                      {renderMediaPreview(tutorial)}

                      <div className="d-flex flex-column flex-md-row gap-2">
                        <Form.Group controlId={`${field.slug}-media-type`} className="flex-grow-1">
                          <Form.Select
                            value={state?.mediaType ?? ""}
                            onChange={handleMediaTypeChange(field.slug)}
                            disabled={state?.isSubmitting}
                          >
                            <option value="">Selecionar tipo de mídia</option>
                            <option value="image">Imagem</option>
                            <option value="video">Vídeo</option>
                          </Form.Select>
                        </Form.Group>
                        <Form.Group controlId={`${field.slug}-media`} className="flex-grow-1">
                          <Form.Control
                            type="file"
                            accept="image/*,video/*"
                            onChange={handleFileChange(field.slug)}
                            disabled={state?.isSubmitting}
                          />
                          {state?.file && (
                            <Form.Text className="text-truncate d-block">
                              Arquivo selecionado: {state.file.name}
                            </Form.Text>
                          )}
                        </Form.Group>
                      </div>

                      <Form.Text className="text-secondary">
                        Utilize imagens (JPG, PNG, WebP) ou vídeos (MP4, MOV, WEBM). Arquivos são exibidos
                        exatamente como enviados.
                      </Form.Text>
                    </div>

                    <div className="d-flex flex-column flex-md-row gap-2">
                      <Button type="submit" disabled={state?.isSubmitting}>
                        {state?.isSubmitting ? "Salvando..." : "Salvar tutorial"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline-danger"
                        disabled={state?.isSubmitting || !hasMedia}
                        onClick={handleRemoveMedia(field.slug)}
                      >
                        Remover mídia
                      </Button>
                    </div>
                  </Form>
                </Card.Body>
                {hasMedia && (
                  <Card.Footer className="d-flex align-items-center gap-2 small text-secondary">
                    {tutorial?.mediaType === "video" ? (
                      <IconVideo size={16} strokeWidth={1.75} />
                    ) : (
                      <IconPhoto size={16} strokeWidth={1.75} />
                    )}
                    Última atualização em {tutorial?.updatedAt ? new Date(tutorial.updatedAt).toLocaleString() : "-"}
                  </Card.Footer>
                )}
              </Card>
            </Col>
          );
        })}
      </Row>
    </div>
  );
};

export default AdminTutorialManager;
