"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useMemo, useState, useTransition } from "react";

import type { AdminSiteSettings, AdminSiteSettingsPayload } from "types/admin-site";

interface AdminSiteSettingsFormProps {
  initialSettings: AdminSiteSettings;
}

type FormState = AdminSiteSettingsPayload;

type FeedbackState = { type: "success" | "error"; message: string } | null;

const mapSettingsToFormState = (settings: AdminSiteSettings): FormState => ({
  siteName: settings.siteName,
  tagline: settings.tagline,
  supportEmail: settings.supportEmail,
  supportPhone: settings.supportPhone,
  heroTitle: settings.heroTitle,
  heroSubtitle: settings.heroSubtitle,
  heroButtonLabel: settings.heroButtonLabel,
  heroButtonUrl: settings.heroButtonUrl,
  seoTitle: settings.seoTitle,
  seoDescription: settings.seoDescription,
  footerText: settings.footerText,
});

const AdminSiteSettingsForm = ({ initialSettings }: AdminSiteSettingsFormProps) => {
  const [formState, setFormState] = useState<FormState>(() => mapSettingsToFormState(initialSettings));
  const [persistedSettings, setPersistedSettings] = useState<AdminSiteSettings>(initialSettings);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [isPending, startTransition] = useTransition();

  const updatedAtLabel = useMemo(() => {
    if (!persistedSettings.updatedAt) {
      return null;
    }

    try {
      return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(persistedSettings.updatedAt));
    } catch {
      return null;
    }
  }, [persistedSettings.updatedAt]);

  const handleSiteNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setFormState((current) => ({ ...current, siteName: value }));
  };

  type OptionalField = Exclude<keyof FormState, "siteName">;

  const handleOptionalChange = (
    field: OptionalField,
  ) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { value } = event.target;
    setFormState((current) => ({ ...current, [field]: value === "" ? null : value }));
  };

  const resetForm = () => {
    setFormState(mapSettingsToFormState(persistedSettings));
    setFeedback(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/site", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formState),
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          const message = payload?.message ?? "Não foi possível atualizar as configurações do site.";
          throw new Error(message);
        }

        const nextSettings = payload?.settings as AdminSiteSettings | undefined;
        if (nextSettings) {
          setPersistedSettings(nextSettings);
          setFormState(mapSettingsToFormState(nextSettings));
        }

        setFeedback({
          type: "success",
          message: payload?.message ?? "Configurações atualizadas com sucesso.",
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar as configurações do site.";
        setFeedback({ type: "error", message });
      }
    });
  };

  return (
    <form className="d-flex flex-column gap-4" onSubmit={handleSubmit}>
      {feedback && (
        <div
          className={`alert ${feedback.type === "success" ? "alert-success" : "alert-danger"}`}
          role="alert"
        >
          {feedback.message}
        </div>
      )}

      <section className="card">
        <div className="card-header">
          <h2 className="h5 mb-0">Identidade e contato</h2>
        </div>
        <div className="card-body d-flex flex-column gap-3">
          <div>
            <label className="form-label" htmlFor="siteName">
              Nome do site
            </label>
            <input
              id="siteName"
              name="siteName"
              type="text"
              required
              maxLength={120}
              className="form-control"
              value={formState.siteName}
              onChange={handleSiteNameChange}
              placeholder="StoreBot"
              disabled={isPending}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="tagline">
              Slogan ou frase de impacto
            </label>
            <input
              id="tagline"
              name="tagline"
              type="text"
              maxLength={160}
              className="form-control"
              value={formState.tagline ?? ""}
              onChange={handleOptionalChange("tagline")}
              placeholder="Automatize suas vendas no WhatsApp"
              disabled={isPending}
            />
          </div>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label" htmlFor="supportEmail">
                E-mail de contato
              </label>
              <input
                id="supportEmail"
                name="supportEmail"
                type="email"
                maxLength={160}
                className="form-control"
                value={formState.supportEmail ?? ""}
                onChange={handleOptionalChange("supportEmail")}
                placeholder="contato@suaempresa.com"
                disabled={isPending}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="supportPhone">
                Telefone ou WhatsApp
              </label>
              <input
                id="supportPhone"
                name="supportPhone"
                type="tel"
                inputMode="tel"
                maxLength={40}
                className="form-control"
                value={formState.supportPhone ?? ""}
                onChange={handleOptionalChange("supportPhone")}
                placeholder="(+55) 11 99999-0000"
                disabled={isPending}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2 className="h5 mb-0">Página inicial</h2>
        </div>
        <div className="card-body d-flex flex-column gap-3">
          <div>
            <label className="form-label" htmlFor="heroTitle">
              Título principal
            </label>
            <input
              id="heroTitle"
              name="heroTitle"
              type="text"
              maxLength={160}
              className="form-control"
              value={formState.heroTitle ?? ""}
              onChange={handleOptionalChange("heroTitle")}
              placeholder="Transforme conversas em vendas"
              disabled={isPending}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="heroSubtitle">
              Descrição principal
            </label>
            <textarea
              id="heroSubtitle"
              name="heroSubtitle"
              rows={3}
              maxLength={240}
              className="form-control"
              value={formState.heroSubtitle ?? ""}
              onChange={handleOptionalChange("heroSubtitle")}
              placeholder="Explique em poucas palavras como o seu produto ajuda os clientes."
              disabled={isPending}
            />
          </div>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label" htmlFor="heroButtonLabel">
                Texto do botão principal
              </label>
              <input
                id="heroButtonLabel"
                name="heroButtonLabel"
                type="text"
                maxLength={60}
                className="form-control"
                value={formState.heroButtonLabel ?? ""}
                onChange={handleOptionalChange("heroButtonLabel")}
                placeholder="Começar agora"
                disabled={isPending}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="heroButtonUrl">
                URL do botão principal
              </label>
              <input
                id="heroButtonUrl"
                name="heroButtonUrl"
                type="url"
                maxLength={300}
                className="form-control"
                value={formState.heroButtonUrl ?? ""}
                onChange={handleOptionalChange("heroButtonUrl")}
                placeholder="https://suaempresa.com/contato"
                disabled={isPending}
              />
            </div>
          </div>
          <p className="text-secondary small mb-0">
            Informe o texto e a URL apenas se quiser destacar uma chamada para ação no topo do site.
          </p>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2 className="h5 mb-0">SEO e rodapé</h2>
        </div>
        <div className="card-body d-flex flex-column gap-3">
          <div>
            <label className="form-label" htmlFor="seoTitle">
              Título para mecanismos de busca
            </label>
            <input
              id="seoTitle"
              name="seoTitle"
              type="text"
              maxLength={160}
              className="form-control"
              value={formState.seoTitle ?? ""}
              onChange={handleOptionalChange("seoTitle")}
              placeholder="Automação inteligente para vendas no WhatsApp"
              disabled={isPending}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="seoDescription">
              Descrição (meta description)
            </label>
            <textarea
              id="seoDescription"
              name="seoDescription"
              rows={3}
              maxLength={320}
              className="form-control"
              value={formState.seoDescription ?? ""}
              onChange={handleOptionalChange("seoDescription")}
              placeholder="Escreva um resumo convidativo para aparecer nos resultados de busca."
              disabled={isPending}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="footerText">
              Texto do rodapé
            </label>
            <textarea
              id="footerText"
              name="footerText"
              rows={3}
              maxLength={600}
              className="form-control"
              value={formState.footerText ?? ""}
              onChange={handleOptionalChange("footerText")}
              placeholder="Informe direitos autorais, dados legais ou informações adicionais."
              disabled={isPending}
            />
          </div>
        </div>
      </section>

      <div className="d-flex flex-column flex-md-row align-items-md-center gap-3">
        <div className="d-flex gap-2">
          <button type="submit" className="btn btn-primary" disabled={isPending}>
            {isPending ? "Salvando..." : "Salvar alterações"}
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={resetForm} disabled={isPending}>
            Desfazer mudanças
          </button>
        </div>
        {updatedAtLabel && (
          <span className="text-secondary small ms-md-auto">
            Última atualização em {updatedAtLabel}
          </span>
        )}
      </div>
    </form>
  );
};

export default AdminSiteSettingsForm;
