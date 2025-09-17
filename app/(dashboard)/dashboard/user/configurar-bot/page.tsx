import { Fragment } from "react";
import { Metadata } from "next";

import UserBotMenuEditor from "components/bot/UserBotMenuEditor";
import { getCurrentUser } from "lib/auth";
import { getBotMenuConfigForUser } from "lib/bot-config";

export const metadata: Metadata = {
  title: "Configurar bot | StoreBot Dashboard",
  description:
    "Personalize a mensagem automática enviada pelo seu chatbot na Meta Cloud API com texto, variáveis e mídia opcional.",
};

const UserBotConfigPage = async () => {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const config = await getBotMenuConfigForUser(user.id);

  return (
    <Fragment>
      <div className="mb-6">
        <h1 className="mb-2">Configurar bot</h1>
        <p className="text-secondary mb-0">
          Defina o texto base, variáveis e a mídia que serão respondidos automaticamente a cada mensagem
          recebida no seu webhook.
        </p>
      </div>

      <UserBotMenuEditor config={config} />
    </Fragment>
  );
};

export default UserBotConfigPage;
