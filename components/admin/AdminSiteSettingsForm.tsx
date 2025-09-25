"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { AdminSiteSettings, AdminSiteSettingsPayload } from "types/admin-site";

interface AdminSiteSettingsFormProps {
  initialSettings: AdminSiteSettings;
}

type FormState = AdminSiteSettingsPayload & {
  logoUrl: string | null;
  seoImageUrl: string | null;
};

type FeedbackState = { type: "success" | "error"; message: string } | null;

type ViewId = "branding" | "homepage" | "seo";

type ViewOption = {
  id: ViewId;
  label: string;
  description: string;
};

const VIEW_OPTIONS: readonly ViewOption[] = [
  {
    id: "branding",
    label: "Identidade visual",
    description:
      "Defina nome, slogan, logo e dados de contato exibidos em todas as páginas do site.",
  },
  {
    id: "homepage",
    label: "Página inicial",
    description: "Ajuste o destaque principal da home com título, descrição e chamada para ação.",
  },
  {
    id: "seo",
    label: "SEO e rodapé",
    description: "Configure metadados de busca e o texto institucional mostrado no rodapé.",
  },
];

const mapSettingsToFormState = (settings: AdminSiteSettings): FormState => ({
  siteName: settings.siteName,
  tagline: settings.tagline,
  logoUrl: settings.logoUrl,
  supportEmail: settings.supportEmail,
  supportPhone: settings.supportPhone,
  heroTitle: settings.heroTitle,
  heroSubtitle: settings.heroSubtitle,
  heroButtonLabel: settings.heroButtonLabel,
  heroButtonUrl: settings.heroButtonUrl,
  seoTitle: settings.seoTitle,
  seoDescription: settings.seoDescription,
  seoImageUrl: settings.seoImageUrl,
  footerText: settings.footerText,
});

const AdminSiteSettingsForm = ({ initialSettings }: AdminSiteSettingsFormProps) => {
  const router = useRouter();
  const [formState, setFormState] = useState<FormState>(() => mapSettingsToFormState(initialSettings));
  const [persistedSettings, setPersistedSettings] = useState<AdminSiteSettings>(initialSettings);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [activeView, setActiveView] = useState<ViewId>("branding");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [seoImageFile, setSeoImageFile] = useState<File | null>(null);
  const [seoImagePreview, setSeoImagePreview] = useState<string | null>(null);
  const [removeSeoImage, setRemoveSeoImage] = useState(false);
  const [isPending, startTransition] = useTransition();

  const activeOption = useMemo(
    () => VIEW_OPTIONS.find((option) => option.id === activeView) ?? VIEW_OPTIONS[0],
    [activeView],
  );

  const updatedAtLabel = useMemo(() => {
    if (!persistedSettings.updatedAt) {
      return null;
    }

    try {
      return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(persistedSettings.updatedAt));
    } catch {
      return null;
    }
  }, [persistedSettings.updatedAt]);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(null);
      return () => {};
    }

    const previewUrl = URL.createObjectURL(logoFile);
    setLogoPreview(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [logoFile]);

  useEffect(() => {
    if (!seoImageFile) {
      setSeoImagePreview(null);
      return () => {};
    }

    const previewUrl = URL.createObjectURL(seoImageFile);
    setSeoImagePreview(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [seoImageFile]);

  const handleSiteNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setFormState((current) => ({ ...current, siteName: value }));
  };

  type OptionalField = Exclude<keyof AdminSiteSettingsPayload, "siteName">;

  const handleOptionalChange = (
    field: OptionalField,
  ) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { value } = event.target;
    setFormState((current) => ({ ...current, [field]: value === "" ? null : value }));
  };

  const handleLogoFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files && event.target.files.length > 0 ? event.target.files[0] : null;

    if (!file) {
      setLogoFile(null);
      return;
    }

    setLogoFile(file);
    setRemoveLogo(false);
  };

  const handleSeoImageFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files && event.target.files.length > 0 ? event.target.files[0] : null;

    if (!file) {
      setSeoImageFile(null);
      return;
    }

    setSeoImageFile(file);
    setRemoveSeoImage(false);
  };

  const handleClearLogoFile = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogo(false);
    setFormState((current) => ({ ...current, logoUrl: persistedSettings.logoUrl }));
  };

  const handleClearSeoImageFile = () => {
    setSeoImageFile(null);
    setSeoImagePreview(null);
    setRemoveSeoImage(false);
    setFormState((current) => ({ ...current, seoImageUrl: persistedSettings.seoImageUrl }));
  };

  const handleRemoveLogoClick = () => {
    setRemoveLogo(true);
    setLogoFile(null);
    setLogoPreview(null);
    setFormState((current) => ({ ...current, logoUrl: null }));
  };

  const handleRemoveSeoImageClick = () => {
    setRemoveSeoImage(true);
    setSeoImageFile(null);
    setSeoImagePreview(null);
    setFormState((current) => ({ ...current, seoImageUrl: null }));
  };

  const handleCancelLogoRemoval = () => {
    setRemoveLogo(false);
    setFormState((current) => ({ ...current, logoUrl: persistedSettings.logoUrl }));
  };

  const handleCancelSeoImageRemoval = () => {
    setRemoveSeoImage(false);
    setFormState((current) => ({ ...current, seoImageUrl: persistedSettings.seoImageUrl }));
  };

  const resetForm = () => {
    setFormState(mapSettingsToFormState(persistedSettings));
    setFeedback(null);
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogo(false);
    setSeoImageFile(null);
    setSeoImagePreview(null);
    setRemoveSeoImage(false);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      try {
        const payloadToSend = new FormData();
        payloadToSend.set("siteName", formState.siteName);
        payloadToSend.set("tagline", formState.tagline ?? "");
        payloadToSend.set("supportEmail", formState.supportEmail ?? "");
        payloadToSend.set("supportPhone", formState.supportPhone ?? "");
        payloadToSend.set("heroTitle", formState.heroTitle ?? "");
        payloadToSend.set("heroSubtitle", formState.heroSubtitle ?? "");
        payloadToSend.set("heroButtonLabel", formState.heroButtonLabel ?? "");
        payloadToSend.set("heroButtonUrl", formState.heroButtonUrl ?? "");
        payloadToSend.set("seoTitle", formState.seoTitle ?? "");
        payloadToSend.set("seoDescription", formState.seoDescription ?? "");
        payloadToSend.set("footerText", formState.footerText ?? "");
        payloadToSend.set("removeLogo", String(removeLogo));
        payloadToSend.set("removeSeoImage", String(removeSeoImage));

        if (logoFile) {
          payloadToSend.set("logo", logoFile);
        }

        if (seoImageFile) {
          payloadToSend.set("seoImage", seoImageFile);
        }

        const response = await fetch("/api/admin/site", {
          method: "PUT",
          body: payloadToSend,
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
          setRemoveLogo(false);
          setRemoveSeoImage(false);
          setLogoFile(null);
          setLogoPreview(null);
          setSeoImageFile(null);
          setSeoImagePreview(null);
          router.refresh();
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

  const currentLogoUrl = removeLogo ? null : formState.logoUrl;
  const displayLogo = logoPreview ?? currentLogoUrl;
  const showCancelRemoval = removeLogo && Boolean(persistedSettings.logoUrl);
  const currentSeoImageUrl = removeSeoImage ? null : formState.seoImageUrl;
  const displaySeoImage = seoImagePreview ?? currentSeoImageUrl;
  const showCancelSeoRemoval = removeSeoImage && Boolean(persistedSettings.seoImageUrl);

  return (
    <div className="d-flex flex-column gap-4">
      <section className="card">
        <div className="card-body">
          <h2 className="h5 mb-2">Escolha o que deseja configurar</h2>
          <p className="text-secondary mb-3">
            Use os botões abaixo para navegar entre identidade visual, conteúdo da página inicial e ajustes de SEO.
          </p>
          <div className="d-flex flex-wrap gap-2">
            {VIEW_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`btn ${activeView === option.id ? "btn-primary" : "btn-outline-primary"}`}
                onClick={() => setActiveView(option.id)}
                disabled={isPending}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="text-secondary small mb-0 mt-3">{activeOption.description}</p>
        </div>
      </section>

      <form
        className="d-flex flex-column gap-4"
        encType="multipart/form-data"
        onSubmit={handleSubmit}
      >
        {feedback && (
          <div
            className={`alert ${feedback.type === "success" ? "alert-success" : "alert-danger"}`}
            role="alert"
          >
            {feedback.message}
          </div>
        )}

      {activeView === "branding" && (
        <>
          <section className="card">
            <div className="card-header">
              <h2 className="h5 mb-0">Identidade visual</h2>
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
              <div>
                <label className="form-label" htmlFor="siteLogo">
                  Logo do site
                </label>
                {displayLogo && (
                  <div className="d-flex align-items-start gap-3 mb-3">
                    <img
                      src={displayLogo ?? ""}
                      alt="Prévia da logo do site"
                      className="rounded border bg-white p-2"
                      style={{ width: "96px", height: "96px", objectFit: "contain" }}
                    />
                    <div className="d-flex flex-column gap-2">
                      <span className="text-secondary small">
                        {logoPreview
                          ? "Prévia da nova logo (ainda não salva)."
                          : "Logo atual exibida no site público."}
                      </span>
                      <div className="d-flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm"
                          onClick={handleRemoveLogoClick}
                          disabled={isPending}
                        >
                          Remover logo
                        </button>
                        {logoPreview && (
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            onClick={handleClearLogoFile}
                            disabled={isPending}
                          >
                            Descartar imagem nova
                          </button>
                        )}
                        {showCancelRemoval && (
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            onClick={handleCancelLogoRemoval}
                            disabled={isPending}
                          >
                            Cancelar remoção
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {!displayLogo && (
                  <p className="text-secondary small mb-3">
                    Envie uma imagem quadrada (PNG, JPG, WEBP ou SVG) de até 5 MB para personalizar o topo do site.
                  </p>
                )}
                <input
                  id="siteLogo"
                  name="logo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="form-control"
                  onChange={handleLogoFileChange}
                  disabled={isPending}
                />
                {removeLogo && !logoPreview && (
                  <p className="text-secondary small mb-0 mt-2">
                    A logo atual será removida ao salvar.
                  </p>
                )}
                {showCancelRemoval && !logoPreview && (
                  <div className="d-flex flex-wrap gap-2 mt-2">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={handleCancelLogoRemoval}
                      disabled={isPending}
                    >
                      Cancelar remoção
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <h2 className="h5 mb-0">Contato</h2>
            </div>
            <div className="card-body d-flex flex-column gap-3">
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
        </>
      )}

      {activeView === "homepage" && (
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
      )}

      {activeView === "seo" && (
        <section className="card">
          <div className="card-header">
            <h2 className="h5 mb-0">SEO e rodapé</h2>
          </div>
          <div className="card-body d-flex flex-column gap-3">
            <div>
              <label className="form-label" htmlFor="seoPreviewImage">
                Imagem de pré-visualização (Open Graph)
              </label>
              {displaySeoImage && (
                <div className="d-flex align-items-start gap-3 mb-3">
                  <img
                    src={displaySeoImage ?? ""}
                    alt="Prévia da imagem para redes sociais"
                    className="rounded border bg-white"
                    style={{ width: "200px", height: "120px", objectFit: "cover" }}
                  />
                  <div className="d-flex flex-column gap-2">
                    <span className="text-secondary small">
                      {seoImagePreview
                        ? "Prévia da nova imagem (ainda não salva)."
                        : "Imagem atual usada nas pré-visualizações de link."}
                    </span>
                    <div className="d-flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        onClick={handleRemoveSeoImageClick}
                        disabled={isPending}
                      >
                        Remover imagem
                      </button>
                      {seoImagePreview && (
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={handleClearSeoImageFile}
                          disabled={isPending}
                        >
                          Descartar imagem nova
                        </button>
                      )}
                      {showCancelSeoRemoval && (
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={handleCancelSeoImageRemoval}
                          disabled={isPending}
                        >
                          Cancelar remoção
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {!displaySeoImage && (
                <p className="text-secondary small mb-3">
                  Envie uma arte 1200×630 px (JPG, PNG ou WEBP) de até 3 MB para aparecer nas prévias de redes sociais.
                </p>
              )}
              <input
                id="seoPreviewImage"
                name="seoImage"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="form-control"
                onChange={handleSeoImageFileChange}
                disabled={isPending}
              />
              {removeSeoImage && !seoImagePreview && (
                <p className="text-secondary small mb-0 mt-2">
                  A imagem atual será removida ao salvar.
                </p>
              )}
              {showCancelSeoRemoval && !seoImagePreview && (
                <div className="d-flex flex-wrap gap-2 mt-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={handleCancelSeoImageRemoval}
                    disabled={isPending}
                  >
                    Cancelar remoção
                  </button>
                </div>
              )}
            </div>
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
      )}

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
    </div>
  );
};

export default AdminSiteSettingsForm;
