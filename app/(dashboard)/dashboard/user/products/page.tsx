import { Fragment } from "react";
import { Metadata } from "next";

import UserProductManager from "components/catalog/UserProductManager";
import { getCurrentUser } from "lib/auth";
import { getCategoriesForUser, getProductsForUser } from "lib/catalog";
import { getUserPlanStatus } from "lib/plans";

export const metadata: Metadata = {
  title: "Gerenciar produtos digitais | StoreBot Dashboard",
  description: "Publique novos produtos digitais, faça upload de anexos e controle limites de revenda.",
};

const UserProductsPage = async () => {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const [categories, products, planStatus] = await Promise.all([
    getCategoriesForUser(user.id),
    getProductsForUser(user.id),
    getUserPlanStatus(user.id),
  ]);

  return (
    <Fragment>
      <div className="mb-6">
        <h1 className="mb-2">Produtos digitais</h1>
        <p className="text-secondary mb-0">
          Cadastre conteúdos secretos, organize anexos opcionais e defina o limite de revendas de cada produto.
        </p>
      </div>
      <UserProductManager categories={categories} products={products} planStatus={planStatus} />
    </Fragment>
  );
};

export default UserProductsPage;
