import { Fragment } from "react";
import { Metadata } from "next";

import AdminWebhookManager from "components/admin/AdminWebhookManager";
import AdminBotMenuEditor from "components/admin/AdminBotMenuEditor";
import { getAdminBotConfig } from "lib/admin-bot-config";
import { getAdminWebhookDetails, getRecentAdminWebhookEvents } from "lib/admin-webhooks";

export const metadata: Metadata = {
  title: "Bot administrativo | Painel administrativo",
  description:
    "Configure o chatbot administrativo da plataforma, conectando a Meta Cloud API e acompanhando os eventos recebidos pelo WhatsApp.",
};

export const dynamic = "force-dynamic";

const AdminBotPage = async () => {
  const [botConfig, webhook, events] = await Promise.all([
    getAdminBotConfig(),
    getAdminWebhookDetails(),
    getRecentAdminWebhookEvents(25),
  ]);

  return (
    <Fragment>
      <div className="mb-6">
        <h1 className="mb-2">Bot administrativo</h1>
        <p className="text-secondary mb-0">
          Conecte o número oficial do WhatsApp da plataforma, acompanhe os eventos recebidos pela Meta Cloud
          API e habilite o chatbot que auxilia os lojistas diretamente no aplicativo.
        </p>
      </div>

      <AdminBotMenuEditor config={botConfig} />

      <AdminWebhookManager webhook={webhook} events={events} />
    </Fragment>
  );
};

export default AdminBotPage;
