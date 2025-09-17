import { Fragment } from "react";
import { Metadata } from "next";

import { getCurrentUser } from "lib/auth";
import { getRecentWebhookEvents, getWebhookForUser } from "lib/webhooks";
import UserWebhookDetails from "components/webhooks/UserWebhookDetails";

export const metadata: Metadata = {
  title: "Webhook | StoreBot Dashboard",
  description:
    "Consulte o endpoint dedicado da Meta Cloud API, tokens de verificação e eventos recentes recebidos pelo chatbot.",
};

const UserWebhookPage = async () => {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const [webhook, events] = await Promise.all([
    getWebhookForUser(user.id),
    getRecentWebhookEvents(user.id, 25),
  ]);

  return (
    <Fragment>
      <div className="mb-6">
        <h1 className="mb-2">Webhook</h1>
        <p className="text-secondary mb-0">
          Visualize o endpoint exclusivo gerado para sua conta e acompanhe as últimas notificações
          recebidas da Meta Cloud API.
        </p>
      </div>

      {webhook ? (
        <UserWebhookDetails webhook={webhook} events={events} />
      ) : (
        <p className="text-secondary">Não foi possível carregar as informações do webhook.</p>
      )}
    </Fragment>
  );
};

export default UserWebhookPage;
