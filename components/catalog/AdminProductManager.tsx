"use client";

import { useState } from "react";
import { Alert, Button, Card, Modal, Table } from "react-bootstrap";
import { useRouter } from "next/navigation";

import type { AdminProductSummary } from "types/catalog";

type Feedback = { type: "success" | "danger"; message: string } | null;

interface AdminProductManagerProps {
  products: AdminProductSummary[];
}

const AdminProductManager = ({ products }: AdminProductManagerProps) => {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [viewProduct, setViewProduct] = useState<AdminProductSummary | null>(null);

  const removeProduct = async (product: AdminProductSummary) => {
    const confirmation = window.confirm("Deseja remover este produto digital?");

    if (!confirmation) {
      return;
    }

    setPendingId(product.id);
    setFeedback(null);

    const response = await fetch(`/api/catalog/products/${product.id}`, {
      method: "DELETE",
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setFeedback({ type: "danger", message: data.message ?? "Falha ao excluir o produto." });
      setPendingId(null);
      return;
    }

    setFeedback({ type: "success", message: "Produto removido." });
    setPendingId(null);
    router.refresh();
  };

  return (
    <section>
      {feedback && (
        <Alert variant={feedback.type} onClose={() => setFeedback(null)} dismissible className="mb-4">
          {feedback.message}
        </Alert>
      )}

      <Card>
        <Card.Header>
          <div className="d-flex flex-column flex-lg-row justify-content-between gap-2 align-items-lg-center">
            <div>
              <h2 className="mb-1">Produtos digitais</h2>
              <p className="mb-0 text-secondary">Acompanhe a produção de cada time e controle conteúdos sensíveis.</p>
            </div>
          </div>
        </Card.Header>
        <Card.Body className="p-0">
          <div className="table-responsive">
            <Table hover className="align-middle mb-0">
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th>Owner</th>
                  <th>Limite</th>
                  <th className="text-end">Ações</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center text-secondary py-4">
                      Nenhum produto digital cadastrado até o momento.
                    </td>
                  </tr>
                ) : (
                  products.map((product) => (
                    <tr key={product.id}>
                      <td>{product.categoryName}</td>
                      <td>
                        <div className="d-flex flex-column">
                          <span>{product.ownerName}</span>
                          <span className="text-secondary small">{product.ownerEmail}</span>
                        </div>
                      </td>
                      <td>{product.resaleLimit === 0 ? "Esgotado" : product.resaleLimit}</td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-2">
                          <Button size="sm" variant="outline-primary" onClick={() => setViewProduct(product)}>
                            Detalhes
                          </Button>
                          <Button
                            size="sm"
                            variant="outline-danger"
                            onClick={() => removeProduct(product)}
                            disabled={pendingId === product.id}
                          >
                            {pendingId === product.id ? "Removendo..." : "Excluir"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      <Modal show={Boolean(viewProduct)} onHide={() => setViewProduct(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Detalhes do produto</Modal.Title>
        </Modal.Header>
        {viewProduct && (
          <Modal.Body>
            <h5 className="mb-1">{viewProduct.categoryName}</h5>
            <p className="text-secondary mb-3">
              Categoria {viewProduct.categoryName} – proprietário {viewProduct.ownerName} ({viewProduct.ownerEmail}).
              {" "}
              Limite de revendas: {viewProduct.resaleLimit === 0 ? "esgotado" : `${viewProduct.resaleLimit} restante(s)`}.
            </p>
            <Card className="mb-3">
              <Card.Header>Conteúdo compartilhado</Card.Header>
              <Card.Body>
                <pre className="mb-0 small" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {viewProduct.details}
                </pre>
              </Card.Body>
            </Card>
            {viewProduct.filePath && (
              <Alert variant="info" className="mb-0">
                Anexo disponível: {" "}
                <a href={`/${viewProduct.filePath}`} target="_blank" rel="noreferrer">
                  Abrir arquivo
                </a>
              </Alert>
            )}
          </Modal.Body>
        )}
      </Modal>
    </section>
  );
};

export default AdminProductManager;
