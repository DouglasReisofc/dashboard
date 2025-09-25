"use client";

import { useMemo, useState } from "react";
import { Badge, Card, Form, Table } from "react-bootstrap";

import { formatCurrency, formatDateTime } from "lib/format";
import type { PurchaseHistoryEntry } from "types/purchases";
import type { PaymentCharge } from "types/payments";

interface UserPurchasesViewProps {
  userName: string;
  purchases: PurchaseHistoryEntry[];
  charges: PaymentCharge[];
}

type ViewOption = "purchases" | "payments";

const viewOptions: { value: ViewOption; label: string }[] = [
  { value: "purchases", label: "Histórico de compras" },
  { value: "payments", label: "Pagamentos recebidos" },
];

const truncate = (value: string, length = 140) => {
  if (value.length <= length) {
    return value;
  }
  return `${value.slice(0, length)}…`;
};

const getStatusVariant = (status: string) => {
  const normalized = status.toLowerCase();

  if (normalized === "approved" || normalized === "accredited") {
    return "success";
  }

  if (normalized === "pending") {
    return "warning";
  }

  if (normalized === "rejected" || normalized === "cancelled" || normalized === "cancelado") {
    return "danger";
  }

  return "secondary";
};

const getStatusLabel = (status: string) => {
  const normalized = status.toLowerCase();

  switch (normalized) {
    case "approved":
    case "accredited":
      return "Aprovado";
    case "pending":
      return "Pendente";
    case "in_process":
      return "Em análise";
    case "rejected":
      return "Recusado";
    case "cancelled":
    case "cancelado":
      return "Cancelado";
    default:
      return normalized || "-";
  }
};

const UserPurchasesView = ({ userName, purchases, charges }: UserPurchasesViewProps) => {
  const [currentView, setCurrentView] = useState<ViewOption>("purchases");

  const purchaseCount = purchases.length;
  const chargeCount = charges.length;

  const totalPurchaseAmount = useMemo(
    () => purchases.reduce((sum, purchase) => sum + purchase.categoryPrice, 0),
    [purchases],
  );

  const totalChargeAmount = useMemo(
    () => charges.reduce((sum, charge) => sum + (Number.isFinite(charge.amount) ? charge.amount : 0), 0),
    [charges],
  );

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-lg-between gap-3">
        <div>
          <h1 className="mb-1">Compras e pagamentos</h1>
          <p className="text-secondary mb-0">
            {userName}, acompanhe as compras confirmadas pelos clientes e os pagamentos aprovados automaticamente.
          </p>
        </div>
        <Form.Select
          value={currentView}
          onChange={(event) => setCurrentView(event.target.value as ViewOption)}
          className="w-auto"
        >
          {viewOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Form.Select>
      </div>

      {currentView === "purchases" ? (
        <Card>
          <Card.Header className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-lg-between gap-3">
            <div>
              <h2 className="h5 mb-0">Histórico de compras</h2>
              <small className="text-secondary">
                {purchaseCount === 0
                  ? "Nenhuma compra registrada ainda."
                  : `${purchaseCount} compra(s) registradas • Receita acumulada de ${formatCurrency(totalPurchaseAmount)}`}
              </small>
            </div>
          </Card.Header>
          <Card.Body>
            {purchaseCount === 0 ? (
              <p className="text-secondary mb-0">
                Assim que os clientes comprarem pelo bot, o histórico aparecerá por aqui.
              </p>
            ) : (
              <div className="table-responsive">
                <Table hover responsive className="mb-0 align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>Data</th>
                      <th>Cliente</th>
                      <th>Categoria</th>
                      <th className="text-end">Valor</th>
                      <th>Detalhes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map((purchase) => {
                      const customerLabel = purchase.customerName
                        ?? (purchase.customerWhatsapp ? `@${purchase.customerWhatsapp}` : "Cliente do bot");

                      return (
                        <tr key={purchase.id}>
                          <td>{formatDateTime(purchase.purchasedAt)}</td>
                          <td>{customerLabel}</td>
                          <td>
                            <strong className="d-block">{purchase.categoryName}</strong>
                            {purchase.categoryDescription && (
                              <small className="text-secondary">
                                {truncate(purchase.categoryDescription, 80)}
                              </small>
                            )}
                          </td>
                          <td className="text-end">{formatCurrency(purchase.categoryPrice)}</td>
                          <td>
                            <small className="text-secondary d-block">
                              {truncate(purchase.productDetails, 120)}
                            </small>
                            {purchase.metadata && typeof purchase.metadata.balanceAfterPurchase === "number" && (
                              <small className="text-secondary d-block mt-2">
                                Saldo após compra: {formatCurrency(purchase.metadata.balanceAfterPurchase as number)}
                              </small>
                            )}
                            {purchase.productFilePath && (
                              <Badge bg="light" text="dark" className="mt-2">
                                Conteúdo com anexo
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        </Card>
      ) : (
        <Card>
          <Card.Header className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-lg-between gap-3">
            <div>
              <h2 className="h5 mb-0">Pagamentos recebidos</h2>
              <small className="text-secondary">
                {chargeCount === 0
                  ? "Nenhum pagamento confirmado até o momento."
                  : `${chargeCount} pagamento(s) • Total creditado de ${formatCurrency(totalChargeAmount)}`}
              </small>
            </div>
          </Card.Header>
          <Card.Body>
            {chargeCount === 0 ? (
              <p className="text-secondary mb-0">
                Confirmaremos automaticamente os pagamentos aprovados e eles aparecerão aqui.
              </p>
            ) : (
              <div className="table-responsive">
                <Table hover responsive className="mb-0 align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>Data</th>
                      <th>Cliente</th>
                      <th className="text-end">Valor</th>
                      <th>Status</th>
                      <th>Origem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {charges.map((charge) => {
                      const customerLabel = charge.customerName
                        ?? (charge.customerWhatsapp ? `@${charge.customerWhatsapp}` : "Cliente do bot");
                      const statusVariant = getStatusVariant(charge.status);
                      const statusLabel = getStatusLabel(charge.status);
                      const providerLabel = charge.provider === "mercadopago_pix"
                        ? "Pix"
                        : charge.provider === "mercadopago_checkout"
                          ? "Checkout"
                          : charge.provider;

                      return (
                        <tr key={charge.id}>
                          <td>{formatDateTime(charge.createdAt)}</td>
                          <td>{customerLabel}</td>
                          <td className="text-end">{formatCurrency(charge.amount)}</td>
                          <td>
                            <Badge bg={statusVariant} className="text-capitalize">
                              {statusLabel}
                            </Badge>
                          </td>
                          <td>{providerLabel}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        </Card>
      )}
    </div>
  );
};

export default UserPurchasesView;
