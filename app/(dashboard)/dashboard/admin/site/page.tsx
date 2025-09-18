import { Fragment } from "react";
import { Metadata } from "next";

import AdminSiteSettingsForm from "components/admin/AdminSiteSettingsForm";
import { getAdminSiteSettings } from "lib/admin-site";

export const metadata: Metadata = {
  title: "Configurações do site | Painel administrativo",
  description:
    "Gerencie a identidade visual, conteúdos principais e informações institucionais exibidas no site público.",
};

export const dynamic = "force-dynamic";

const AdminSiteSettingsPage = async () => {
  const settings = await getAdminSiteSettings();

  return (
    <Fragment>
      <div className="mb-6">
        <h1 className="mb-2">Configurações do site</h1>
        <p className="text-secondary mb-0">
          Ajuste textos institucionais, dados de contato e destaques da página inicial que ficam visíveis para todos os
          visitantes.
        </p>
      </div>
      <AdminSiteSettingsForm initialSettings={settings} />
    </Fragment>
  );
};

export default AdminSiteSettingsPage;
