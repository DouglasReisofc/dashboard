import { Fragment } from "react";
import { Metadata } from "next";

import UserCustomerManager from "components/customers/UserCustomerManager";
import { getCurrentUser } from "lib/auth";
import { getCustomersForUser } from "lib/customers";

export const metadata: Metadata = {
  title: "Clientes do robô | StoreBot Dashboard",
  description:
    "Visualize todos os contatos que interagiram com o seu robô do WhatsApp e ajuste saldo, bloqueios e observações.",
};

const UserCustomersPage = async () => {
  const user = await getCurrentUser();
  const customers = user ? await getCustomersForUser(user.id) : [];

  return (
    <Fragment>
      <div className="mb-6">
        <h1 className="mb-2">Clientes</h1>
        <p className="text-secondary mb-0">
          Acompanhe o histórico de contatos que conversaram com o seu robô, ajuste saldos e controle bloqueios individuais.
        </p>
      </div>
      <UserCustomerManager customers={customers} />
    </Fragment>
  );
};

export default UserCustomersPage;
