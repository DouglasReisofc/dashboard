import { Fragment } from "react";
import { Metadata } from "next";

import { getCurrentUser } from "lib/auth";
import { getAllCategories, getAllProducts } from "lib/catalog";
import { formatDate } from "lib/format";

export const metadata: Metadata = {
  title: "Painel administrativo | StoreBot Dashboard",
  description:
    "Monitore o volume total de categorias e produtos publicados pelos usuários antes de acessar os relatórios detalhados.",
};

const AdminPanelPage = async () => {
  const user = await getCurrentUser();
  const [categories, products] = await Promise.all([getAllCategories(), getAllProducts()]);

  const activeCategories = categories.filter((category) => category.isActive).length;
  const totalAttachments = products.filter((product) => Boolean(product.filePath)).length;
  const uniqueOwners = new Set(products.map((product) => product.ownerEmail)).size;

  const recentCategories = categories.slice(0, 5);
  const recentProducts = products.slice(0, 5);

  return (
    <Fragment>
      <div className="mb-6">
        <h1 className="mb-2">Painel administrativo</h1>
        <p className="text-secondary mb-0">
          Bem-vindo{user ? `, ${user.name}` : ""}! Confira como está o catálogo geral antes de intervir nas categorias ou
          produtos enviados pela base.
        </p>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-sm-6 col-xl-3">
          <div className="card h-100">
            <div className="card-body">
              <p className="text-secondary mb-1">Categorias cadastradas</p>
              <h3 className="mb-0">{categories.length}</h3>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="card h-100">
            <div className="card-body">
              <p className="text-secondary mb-1">Categorias ativas</p>
              <h3 className="mb-0">{activeCategories}</h3>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="card h-100">
            <div className="card-body">
              <p className="text-secondary mb-1">Produtos digitais</p>
              <h3 className="mb-0">{products.length}</h3>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="card h-100">
            <div className="card-body">
              <p className="text-secondary mb-1">Produtores únicos</p>
              <h3 className="mb-0">{uniqueOwners}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header">
              <h2 className="h5 mb-0">Categorias mais recentes</h2>
            </div>
            <div className="card-body">
              {recentCategories.length === 0 ? (
                <p className="text-secondary mb-0">Nenhuma categoria cadastrada pelos usuários até o momento.</p>
              ) : (
                <ul className="list-unstyled mb-0 d-flex flex-column gap-3">
                  {recentCategories.map((category) => (
                    <li key={category.id}>
                      <div className="d-flex justify-content-between">
                        <div className="me-3">
                          <strong className="d-block">{category.name}</strong>
                          <span className="text-secondary small">
                            {category.ownerName} • {category.isActive ? "Ativa" : "Inativa"}
                          </span>
                        </div>
                        <span className="text-secondary small">{formatDate(category.createdAt)}</span>
                      </div>
                      {category.description && (
                        <p className="text-secondary small mb-0 mt-2">{category.description}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header">
              <h2 className="h5 mb-0">Produtos mais recentes</h2>
            </div>
            <div className="card-body">
              {recentProducts.length === 0 ? (
                <p className="text-secondary mb-0">Nenhum produto digital foi enviado ainda.</p>
              ) : (
                <ul className="list-unstyled mb-0 d-flex flex-column gap-3">
                  {recentProducts.map((product) => (
                    <li key={product.id}>
                      <div className="d-flex justify-content-between">
                        <div className="me-3">
                          <strong className="d-block">{product.categoryName}</strong>
                          <span className="text-secondary small">
                            {product.ownerName} • {product.ownerEmail}
                          </span>
                        </div>
                        <span className="text-secondary small">{formatDate(product.createdAt)}</span>
                      </div>
                      <div className="d-flex flex-wrap gap-2 mt-2">
                        <span className="badge bg-light text-dark">
                          {product.resaleLimit === 0 ? "Limite esgotado" : `${product.resaleLimit} revenda(s)`}
                        </span>
                        {product.filePath && <span className="badge bg-light text-dark">Possui anexo</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4 mt-1">
        <div className="col-sm-6 col-xl-3">
          <div className="card h-100">
            <div className="card-body">
              <p className="text-secondary mb-1">Produtos com anexo</p>
              <h3 className="mb-0">{totalAttachments}</h3>
            </div>
          </div>
        </div>
      </div>
    </Fragment>
  );
};

export default AdminPanelPage;
