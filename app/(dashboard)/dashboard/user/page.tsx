import { Fragment } from "react";
import { Metadata } from "next";

import { getCurrentUser } from "lib/auth";
import { getCategoriesForUser, getProductsForUser } from "lib/catalog";
import { getApprovedChargeTotalsForUser } from "lib/payments";
import { getPurchaseStatsForUser } from "lib/purchase-history";
import { getUserBalanceById } from "lib/users";
import { formatDate } from "lib/format";
import { Avatar } from "components/common/Avatar";

export const metadata: Metadata = {
  title: "Painel do usuário | StoreBot Dashboard",
  description:
    "Visualize um resumo das categorias e produtos digitais cadastrados antes de acessar as telas de gerenciamento.",
};

const UserPanelPage = async () => {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const [categories, products, balance, purchaseStats, chargeTotals] = await Promise.all([
    getCategoriesForUser(user.id),
    getProductsForUser(user.id),
    getUserBalanceById(user.id),
    getPurchaseStatsForUser(user.id),
    getApprovedChargeTotalsForUser(user.id),
  ]);

  const activeCategories = categories.filter((category) => category.isActive).length;
  const productsWithLimit = products.filter((product) => product.resaleLimit > 0).length;
  const productsWithAttachment = products.filter((product) => Boolean(product.filePath)).length;

  const recentCategories = categories.slice(0, 5);
  const recentProducts = products.slice(0, 5);

  const formatCurrencyValue = (value: number) =>
    value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const formatWhatsapp = (value: string | null) => {
    if (!value) {
      return "WhatsApp não informado";
    }

    const trimmed = value.trim();
    const match = trimmed.match(/^(\+\d{1,4})(\d{4,})$/);
    if (!match) {
      return trimmed;
    }

    const [, dial, rest] = match;
    if (rest.length === 10) {
      return `${dial} ${rest.slice(0, 2)} ${rest.slice(2, 6)}-${rest.slice(6)}`;
    }
    if (rest.length === 11) {
      return `${dial} ${rest.slice(0, 2)} ${rest.slice(2, 7)}-${rest.slice(7)}`;
    }
    return `${dial} ${rest}`;
  };

  const whatsappLabel = formatWhatsapp(user.whatsappNumber ?? null);
  const avatarSrc = user.avatarUrl ?? "/images/avatar/avatar-fallback.jpg";

  return (
    <Fragment>
      <div className="mb-6">
        <div className="d-flex flex-column flex-lg-row align-items-lg-center gap-4">
          <div className="d-flex align-items-center gap-3">
            <Avatar
              type="image"
              src={avatarSrc}
              alt={user.name}
              size="lg"
              className="rounded-circle border"
            />
            <div>
              <h1 className="mb-1">Olá, {user.name}!</h1>
              <p className="text-secondary mb-0">{whatsappLabel}</p>
              <small className="text-secondary">
                Acompanhe suas vendas, ganhos e cadastros mais recentes de um jeito rápido.
              </small>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-sm-6 col-xl-3">
          <div className="card h-100">
            <div className="card-body">
              <p className="text-secondary mb-1">Saldo disponível</p>
              <h3 className="mb-0">R$ {formatCurrencyValue(balance)}</h3>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="card h-100">
            <div className="card-body">
              <p className="text-secondary mb-1">Total de vendas</p>
              <h3 className="mb-0">{purchaseStats.totalSales}</h3>
              <small className="text-secondary">
                Receita acumulada de R$ {formatCurrencyValue(purchaseStats.totalRevenue)}
              </small>
            </div>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="card h-100">
            <div className="card-body">
              <p className="text-secondary mb-1">Ganhos com recargas</p>
              <h3 className="mb-0">R$ {formatCurrencyValue(chargeTotals.totalAmount)}</h3>
              <small className="text-secondary">
                {chargeTotals.totalCount} pagamento(s) aprovado(s)
              </small>
            </div>
          </div>
        </div>
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
        <div className="col-sm-6 col-xl-3">
          <div className="card h-100">
            <div className="card-body">
              <p className="text-secondary mb-1">Produtos com anexo</p>
              <h3 className="mb-0">{productsWithAttachment}</h3>
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
                          <strong className="d-block">{product.categoryName}</strong>
                          <span className="text-secondary small">
                            Limite de revendas: {product.resaleLimit === 0 ? "esgotado" : `${product.resaleLimit} restante(s)`}
                          </span>
                        </div>
                        <span className="text-secondary small">{formatDate(product.createdAt)}</span>
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

    </Fragment>
  );
};

export default UserPanelPage;
