import { Fragment } from "react";
import { Metadata } from "next";

import UserSiteSettingsForm from "components/site/UserSiteSettingsForm";
import { getCurrentUser } from "lib/auth";
import { getSiteSettingsForUser } from "lib/site";

export const metadata: Metadata = {
  title: "Configurações do site | StoreBot Dashboard",
  description:
    "Gerencie nome, identidade visual, SEO e conteúdo do rodapé do seu site diretamente pelo painel.",
};

const UserSiteSettingsPage = async () => {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const settings = await getSiteSettingsForUser(user.id);

  return (
    <Fragment>
      <div className="mb-6">
        <h1 className="mb-2">Config. do site</h1>
        <p className="text-secondary mb-0">
          Centralize a personalização da identidade visual, metadados e links exibidos para seus clientes.
        </p>
      </div>

      <UserSiteSettingsForm settings={settings} />
    </Fragment>
  );
};

export default UserSiteSettingsPage;
