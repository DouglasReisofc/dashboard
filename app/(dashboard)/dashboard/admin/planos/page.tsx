import { Fragment } from "react";
import { Metadata } from "next";

import AdminPlanManager from "components/admin/AdminPlanManager";
import { getAllSubscriptionPlans } from "lib/plans";

export const metadata: Metadata = {
  title: "Planos de assinatura | Painel administrativo",
  description:
    "Gerencie os planos disponíveis para os usuários, defina preços, limites de categorias e tempo de acesso.",
};

export const dynamic = "force-dynamic";

const AdminPlansPage = async () => {
  const plans = await getAllSubscriptionPlans();

  return (
    <Fragment>
      <div className="mb-6">
        <h1 className="mb-2">Planos de assinatura</h1>
        <p className="text-secondary mb-0">
          Estruture a oferta de planos do StoreBot definindo limites de categorias, duração de acesso e preço de cada opção.
        </p>
      </div>

      <AdminPlanManager plans={plans} />
    </Fragment>
  );
};

export default AdminPlansPage;
