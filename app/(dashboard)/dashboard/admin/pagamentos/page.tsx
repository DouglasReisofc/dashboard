import { Fragment } from "react";
import { Metadata } from "next";

import UserPaymentsConfig from "components/payments/UserPaymentsConfig";
import {
  getAdminMercadoPagoCheckoutConfig,
  getAdminMercadoPagoPixConfig,
  getAdminPaymentConfirmationConfig,
} from "lib/admin-payments";

export const metadata: Metadata = {
  title: "Pagamentos das assinaturas | Painel administrativo",
  description:
    "Defina as integrações do Mercado Pago que serão usadas nas assinaturas dos planos e personalize a mensagem pós-pagamento.",
};

export const dynamic = "force-dynamic";

const AdminPaymentsPage = async () => {
  const [pixConfig, checkoutConfig, confirmationConfig] = await Promise.all([
    getAdminMercadoPagoPixConfig(),
    getAdminMercadoPagoCheckoutConfig(),
    getAdminPaymentConfirmationConfig(),
  ]);

  return (
    <Fragment>
      <div className="mb-6">
        <h1 className="mb-2">Pagamentos das assinaturas</h1>
        <p className="text-secondary mb-0">
          Configure o Mercado Pago para habilitar as cobranças dos planos e ajuste a experiência de confirmação enviada aos usuários.
        </p>
      </div>

      <UserPaymentsConfig
        pixConfig={pixConfig}
        checkoutConfig={checkoutConfig}
        confirmationConfig={confirmationConfig}
        cardTitle="Pagamentos recorrentes"
        cardDescription="Escolha a modalidade de pagamento que deseja configurar para liberar as assinaturas dos planos do site."
        endpoints={{
          pix: "/api/admin/payments/mercadopago",
          checkout: "/api/admin/payments/mercadopago/checkout",
          confirmation: "/api/admin/payments/confirmation",
        }}
        viewOptionsOverride={{
          pix: {
            description:
              "Configure o Pix do Mercado Pago para gerar cobranças das assinaturas e liberar acesso automaticamente.",
          },
          checkout: {
            description:
              "Ative o checkout transparente para aceitar cartões, Pix e boleto nas páginas de assinatura.",
          },
          confirmation: {
            description:
              "Personalize a mensagem enviada após a confirmação automática do pagamento de cada assinatura.",
          },
        }}
      />
    </Fragment>
  );
};

export default AdminPaymentsPage;
