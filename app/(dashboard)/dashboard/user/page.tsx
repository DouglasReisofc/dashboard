import { Fragment } from "react";
import { Metadata } from "next";

import UserCatalogManager from "components/catalog/UserCatalogManager";
import { getCurrentUser } from "lib/auth";
import { getCategoriesForUser, getProductsForUser } from "lib/catalog";

export const metadata: Metadata = {
  title: "Gestão de catálogo | StoreBot Dashboard",
  description:
    "Crie categorias, publique produtos digitais e controle o limite de revendas diretamente do painel StoreBot.",
};

const UserDashboard = async () => {
  const user = await getCurrentUser();

  const [categories, products] = user
    ? await Promise.all([getCategoriesForUser(user.id), getProductsForUser(user.id)])
    : [[], []];

  return (
    <Fragment>
      <div className="mb-6">
        <h1 className="mb-2">Meu catálogo digital</h1>
        <p className="text-secondary mb-0">
          {user ? `${user.name}, ` : ""}
          centralize a criação de categorias e produtos digitais, defina preços e limite o número de revendas.
        </p>
      </div>
      <UserCatalogManager categories={categories} products={products} />
    </Fragment>
  );
};

export default UserDashboard;
