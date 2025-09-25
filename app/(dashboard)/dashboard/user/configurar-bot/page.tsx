import { Fragment } from "react";
import { Metadata } from "next";

import UserBotConfigPanel from "components/bot/UserBotConfigPanel";
import { getCurrentUser } from "lib/auth";
import { getBotMenuConfigForUser } from "lib/bot-config";
import { fetchMetaBusinessProfile } from "lib/meta-profile";
import { getWebhookRowForUser } from "lib/webhooks";

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
  const webhook = await getWebhookRowForUser(user.id);
  const profile = await fetchMetaBusinessProfile(webhook);
  const hasWebhookCredentials = Boolean(webhook?.access_token && webhook.phone_number_id);

  return (
    <Fragment>
      <div className="mb-6">
        <h1 className="mb-2">Configurar bot</h1>
        <p className="text-secondary mb-0">
          Defina mensagens automáticas, variáveis, mídias e também ajuste o perfil comercial exibido no
          WhatsApp diretamente pelo painel.
        </p>
      </div>

      <UserBotConfigPanel
        menuConfig={config}
        profile={profile}
        hasWebhookCredentials={hasWebhookCredentials}
      />
    </Fragment>
  );
};

export default UserBotConfigPage;
