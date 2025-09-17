import { Fragment } from "react";
import { Metadata } from "next";

import MercadoPagoPixForm from "components/payments/MercadoPagoPixForm";
import { getCurrentUser } from "lib/auth";
import { getMercadoPagoPixConfigForUser } from "lib/payments";

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

  const pixConfig = await getMercadoPagoPixConfigForUser(user.id);

  return (
    <Fragment>
      <div className="mb-6">
        <h1 className="mb-2">Config. de pagamentos</h1>
        <p className="text-secondary mb-0">
          Integre o Mercado Pago Pix para enviar cobranças com QR Code e código copia e cola diretamente pelo bot.
        </p>
      </div>

      <div className="d-flex flex-column gap-4">
        <MercadoPagoPixForm config={pixConfig} />
      </div>
    </Fragment>
  );
};

export default UserPaymentsConfigPage;
