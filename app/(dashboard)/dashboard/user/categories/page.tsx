import { Fragment } from "react";
import { Metadata } from "next";

import UserCategoryManager from "components/catalog/UserCategoryManager";
import { getCurrentUser } from "lib/auth";
import { getCategoriesForUser } from "lib/catalog";

export const metadata: Metadata = {
  title: "Gerenciar categorias | StoreBot Dashboard",
  description: "Crie, edite e remova categorias digitais diretamente do painel do usuário.",
};

const UserCategoriesPage = async () => {
  const user = await getCurrentUser();
  const categories = user ? await getCategoriesForUser(user.id) : [];

  return (
    <Fragment>
      <div className="mb-6">
        <h1 className="mb-2">Categorias</h1>
        <p className="text-secondary mb-0">
          Centralize nomes, valores, descrições e status das categorias que organizam seus produtos digitais.
        </p>
      </div>
      <UserCategoryManager categories={categories} />
    </Fragment>
  );
};

export default UserCategoriesPage;
