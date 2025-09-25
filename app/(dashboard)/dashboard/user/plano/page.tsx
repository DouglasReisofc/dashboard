import { Fragment } from "react";
import { Metadata } from "next";
import { redirect } from "next/navigation";

import UserPlanManager from "components/plans/UserPlanManager";
import { getCurrentUser } from "lib/auth";
import { getAllSubscriptionPlans, getUserPlanStatus } from "lib/plans";
import { getUserBalanceById } from "lib/users";

export const metadata: Metadata = {
  title: "Meu plano | StoreBot Dashboard",
  description: "Visualize o status da sua assinatura, renove o plano ativo e libere o gerenciamento completo do painel.",
};

export const dynamic = "force-dynamic";

const UserPlanPage = async () => {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const [plans, planStatus, balance] = await Promise.all([
    getAllSubscriptionPlans(),
    getUserPlanStatus(user.id),
    getUserBalanceById(user.id),
  ]);

  return (
    <Fragment>
      <div className="mb-6">
        <h1 className="mb-2">Meu plano</h1>
        <p className="text-secondary mb-0">
          Escolha o plano ideal para o seu negócio, acompanhe a data de expiração e gere um novo pagamento quando precisar renovar.
        </p>
      </div>

      <UserPlanManager
        plans={plans}
        status={planStatus}
        userName={user.name}
        userEmail={user.email}
        balance={balance}
      />
    </Fragment>
  );
};

export default UserPlanPage;
