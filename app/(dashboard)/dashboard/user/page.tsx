import { Fragment } from "react";
import { Metadata } from "next";

import { getCurrentUser } from "lib/auth";
import { getCategoriesForUser, getProductsForUser } from "lib/catalog";

export const metadata: Metadata = {
  title: "Painel do usuário | StoreBot Dashboard",
  description:
    "Visualize um resumo das categorias e produtos digitais cadastrados antes de acessar as telas de gerenciamento.",
};

const UserPanelPage = async () => {
  const user = await getCurrentUser();
  const [categories, products] = user
    ? await Promise.all([getCategoriesForUser(user.id), getProductsForUser(user.id)])
    : [[], []];

  const activeCategories = categories.filter((category) => category.isActive).length;
  const productsWithLimit = products.filter((product) => product.resaleLimit > 0).length;
  const productsWithAttachment = products.filter((product) => Boolean(product.filePath)).length;

  const recentCategories = categories.slice(0, 5);
  const recentProducts = products.slice(0, 5);

  return (
    <Fragment>
      <div className="mb-6">
        <h1 className="mb-2">Painel</h1>
        <p className="text-secondary mb-0">
          {user ? `${user.name}, ` : ""}
          acompanhe rapidamente quantas categorias e produtos você cadastrou antes de abrir os gerenciadores.
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
              <p className="text-secondary mb-1">Produtos com limite</p>
              <h3 className="mb-0">{productsWithLimit}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header">
              <h2 className="h5 mb-0">Últimas categorias criadas</h2>
            </div>
            <div className="card-body">
              {recentCategories.length === 0 ? (
                <p className="text-secondary mb-0">Nenhuma categoria cadastrada ainda.</p>
              ) : (
                <ul className="list-unstyled mb-0 d-flex flex-column gap-3">
                  {recentCategories.map((category) => (
                    <li key={category.id}>
                      <div className="d-flex justify-content-between">
                        <div className="me-3">
                          <strong className="d-block">{category.name}</strong>
                          <span className="text-secondary small">
                            {category.isActive ? "Ativa" : "Inativa"} • {category.productCount} produto(s)
                          </span>
                        </div>
                        <span className="text-secondary small">
                          {new Date(category.createdAt).toLocaleDateString("pt-BR")}
                        </span>
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
              <h2 className="h5 mb-0">Últimos produtos publicados</h2>
            </div>
            <div className="card-body">
              {recentProducts.length === 0 ? (
                <p className="text-secondary mb-0">Você ainda não cadastrou produtos digitais.</p>
              ) : (
                <ul className="list-unstyled mb-0 d-flex flex-column gap-3">
                  {recentProducts.map((product) => (
                    <li key={product.id}>
                      <div className="d-flex justify-content-between">
                        <div className="me-3">
                          <strong className="d-block">{product.name}</strong>
                          <span className="text-secondary small">
                            {product.categoryName} •
                            {" "}
                            {product.resaleLimit === 0
                              ? "Revenda ilimitada"
                              : `${product.resaleLimit} revenda(s)`}
                          </span>
                        </div>
                        <span className="text-secondary small">
                          {new Date(product.createdAt).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      {product.filePath && (
                        <span className="badge bg-light text-dark mt-2">Possui anexo</span>
                      )}
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
              <h3 className="mb-0">{productsWithAttachment}</h3>
            </div>
          </div>
        </div>
      </div>
    </Fragment>
  );
};

export default UserPanelPage;
