import { Fragment } from "react";
import { Metadata } from "next";

import UserProductManager from "components/catalog/UserProductManager";
import { getCurrentUser } from "lib/auth";
import { getCategoriesForUser, getProductsForUser } from "lib/catalog";

export const metadata: Metadata = {
  title: "Gerenciar produtos digitais | StoreBot Dashboard",
  description: "Publique novos produtos digitais, faça upload de anexos e controle limites de revenda.",
};

const UserProductsPage = async () => {
  const user = await getCurrentUser();

  const [categories, products] = user
    ? await Promise.all([getCategoriesForUser(user.id), getProductsForUser(user.id)])
    : [[], []];

  return (
    <Fragment>
      <div className="mb-6">
        <h1 className="mb-2">Produtos digitais</h1>
        <p className="text-secondary mb-0">
          Cadastre conteúdos secretos, organize anexos opcionais e defina o limite de revendas de cada produto.
        </p>
      </div>
      <UserProductManager categories={categories} products={products} />
    </Fragment>
  );
};

export default UserProductsPage;
