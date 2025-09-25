import { Fragment } from "react";
import { Metadata } from "next";

import UserCategoryManager from "components/catalog/UserCategoryManager";
import { getCurrentUser } from "lib/auth";
import { getCategoriesForUser } from "lib/catalog";
import { getUserPlanStatus } from "lib/plans";

export const metadata: Metadata = {
  title: "Gerenciar categorias | StoreBot Dashboard",
  description: "Crie, edite e remova categorias digitais diretamente do painel do usuário.",
};

const UserCategoriesPage = async () => {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const [categories, planStatus] = await Promise.all([
    getCategoriesForUser(user.id),
    getUserPlanStatus(user.id),
  ]);

  return (
    <Fragment>
      <div className="mb-6">
        <h1 className="mb-2">Categorias</h1>
        <p className="text-secondary mb-0">
          Centralize nomes, valores, descrições e status das categorias que organizam seus produtos digitais.
        </p>
      </div>
      <UserCategoryManager categories={categories} planStatus={planStatus} />
    </Fragment>
  );
};

export default UserCategoriesPage;
