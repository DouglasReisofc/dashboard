import { Fragment } from "react";
import { Metadata } from "next";

import AdminCatalogOverview from "components/catalog/AdminCatalogOverview";
import { getCurrentUser } from "lib/auth";
import { getAllCategories, getAllProducts } from "lib/catalog";

export const metadata: Metadata = {
  title: "Administração do catálogo | StoreBot Dashboard",
  description:
    "Monitore categorias e produtos digitais cadastrados pelos usuários e mantenha o controle de status e segurança.",
};

const AdminDashboard = async () => {
  const user = await getCurrentUser();
  const [categories, products] = await Promise.all([getAllCategories(), getAllProducts()]);

  return (
    <Fragment>
      <div className="mb-6">
        <h1 className="mb-2">Supervisão do catálogo digital</h1>
        <p className="text-secondary mb-0">
          Bem-vindo{user ? `, ${user.name}` : ""}! Acompanhe as categorias criadas pela base de usuários,
          revise conteúdos sensíveis e ative ou desative produtos quando necessário.
        </p>
      </div>
      <AdminCatalogOverview categories={categories} products={products} />
    </Fragment>
  );
};

export default AdminDashboard;
