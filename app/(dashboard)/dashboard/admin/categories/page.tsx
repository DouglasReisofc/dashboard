import { Fragment } from "react";
import { Metadata } from "next";

import AdminCategoryManager from "components/catalog/AdminCategoryManager";
import { getAllCategories } from "lib/catalog";

export const metadata: Metadata = {
  title: "Categorias cadastradas | StoreBot Dashboard",
  description:
    "Acompanhe todas as categorias criadas pelos usuários, altere status e remova conteúdos impróprios rapidamente.",
};

const AdminCategoriesPage = async () => {
  const categories = await getAllCategories();

  return (
    <Fragment>
      <div className="mb-6">
        <h1 className="mb-2">Categorias</h1>
        <p className="text-secondary mb-0">
          Visualize proprietários, status e volume de produtos antes de aprovar ou remover uma categoria do catálogo.
        </p>
      </div>
      <AdminCategoryManager categories={categories} />
    </Fragment>
  );
};

export default AdminCategoriesPage;
