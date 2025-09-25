import { Fragment } from "react";
import { Metadata } from "next";

import AdminSmtpSettingsForm from "components/admin/AdminSmtpSettingsForm";
import AdminEmailTemplatesManager from "components/admin/AdminEmailTemplatesManager";
import AdminNotificationBroadcastForm from "components/admin/AdminNotificationBroadcastForm";
import { getAdminSmtpSettings } from "lib/admin-smtp";
import { getAllAdminEmailTemplates } from "lib/admin-email-templates";
import { getAdminUsers } from "lib/users";

export const metadata: Metadata = {
  title: "Notificações por e-mail | Painel administrativo",
  description:
    "Configure o servidor SMTP utilizado para enviar notificações automáticas sobre pagamentos de planos e vendas no bot.",
};

export const dynamic = "force-dynamic";

const AdminNotificationsPage = async () => {
  const [settings, templates, adminUsers] = await Promise.all([
    getAdminSmtpSettings(),
    getAllAdminEmailTemplates(),
    getAdminUsers(),
  ]);

  const recipientOptions = adminUsers.map((userSummary) => ({
    id: userSummary.id,
    name: userSummary.name,
    email: userSummary.email,
  }));

  return (
    <Fragment>
      <div className="mb-6">
        <h1 className="mb-2">Notificações por e-mail</h1>
        <p className="text-secondary mb-0">
          Defina o servidor SMTP responsável por enviar alertas de assinaturas e vendas para administradores e vendedores.
        </p>
      </div>

      <AdminNotificationBroadcastForm users={recipientOptions} />
      <AdminSmtpSettingsForm initialSettings={settings} />
      <AdminEmailTemplatesManager templates={templates} />
   </Fragment>
 );
};

export default AdminNotificationsPage;
