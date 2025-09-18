import { Fragment } from "react";
import { Metadata } from "next";

import UserPaymentsConfig from "components/payments/UserPaymentsConfig";
import { getCurrentUser } from "lib/auth";
import {
  getPaymentConfirmationConfigForUser,
  getMercadoPagoCheckoutConfigForUser,
  getMercadoPagoPixConfigForUser,
} from "lib/payments";

export const metadata: Metadata = {
  title: "Configuração de pagamentos | StoreBot Dashboard",
  description:
    "Conecte o Mercado Pago Pix para liberar pagamentos automáticos de saldo via chatbot.",
};

const UserPaymentsConfigPage = async () => {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const [pixConfig, checkoutConfig, confirmationConfig] = await Promise.all([
    getMercadoPagoPixConfigForUser(user.id),
    getMercadoPagoCheckoutConfigForUser(user.id),
    getPaymentConfirmationConfigForUser(user.id),
  ]);

  return (
    <Fragment>
      <div className="mb-6">
        <h1 className="mb-2">Config. de pagamentos</h1>
        <p className="text-secondary mb-0">
          Integre o Mercado Pago Pix para enviar cobranças com QR Code e código copia e cola diretamente pelo bot.
        </p>
      </div>

      <UserPaymentsConfig
        pixConfig={pixConfig}
        checkoutConfig={checkoutConfig}
        confirmationConfig={confirmationConfig}
      />
    </Fragment>
  );
};

export default UserPaymentsConfigPage;
