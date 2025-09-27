import { Fragment } from "react";
import { Metadata } from "next";

import AdminTutorialManager from "components/admin/AdminTutorialManager";
import { getWebhookTutorials } from "lib/tutorials";

export const metadata: Metadata = {
  title: "Tutoriais | StoreBot Dashboard",
  description:
    "Gerencie vídeos e imagens explicativas exibidas nas etapas de configuração do webhook pelos usuários.",
};

const AdminTutorialsPage = async () => {
  const tutorials = await getWebhookTutorials();

  return (
    <Fragment>
      <div className="mb-6">
        <h1 className="mb-2">Tutoriais</h1>
        <p className="text-secondary mb-0">
          Configure materiais de apoio que aparecerão ao lado dos campos sensíveis do webhook para
          orientar os clientes durante a integração com a Meta.
        </p>
      </div>

      <AdminTutorialManager tutorials={tutorials} />
    </Fragment>
  );
};

export default AdminTutorialsPage;
