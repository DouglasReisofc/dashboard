import { Fragment } from "react";
import { Metadata } from "next";

import AdminProductManager from "components/catalog/AdminProductManager";
import { getAllProducts } from "lib/catalog";

export const metadata: Metadata = {
  title: "Produtos digitais cadastrados | StoreBot Dashboard",
  description: "Inspecione produtos enviados, revise detalhes sensíveis e remova conteúdos que violem as políticas.",
};

const AdminProductsPage = async () => {
  const products = await getAllProducts();

  return (
    <Fragment>
      <div className="mb-6">
        <h1 className="mb-2">Produtos digitais</h1>
        <p className="text-secondary mb-0">
          Avalie anexos, limites de revenda e proprietários de cada produto para manter o catálogo saudável.
        </p>
      </div>
      <AdminProductManager products={products} />
    </Fragment>
  );
};

export default AdminProductsPage;
