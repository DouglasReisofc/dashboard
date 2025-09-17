"use client";

import { useState } from "react";
import { Alert, Badge, Button, Card, Table } from "react-bootstrap";
import { useRouter } from "next/navigation";

import type { AdminCategorySummary } from "types/catalog";

type Feedback = { type: "success" | "danger"; message: string } | null;

interface AdminCategoryManagerProps {
  categories: AdminCategorySummary[];
}

const AdminCategoryManager = ({ categories }: AdminCategoryManagerProps) => {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);

  const setStatus = async (category: AdminCategorySummary, isActive: boolean) => {
    setPendingId(category.id);
    setFeedback(null);

    const formData = new FormData();
    formData.append("status", isActive ? "active" : "inactive");

    const response = await fetch(`/api/catalog/categories/${category.id}`, {
      method: "PUT",
      body: formData,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setFeedback({
        type: "danger",
        message: data.message ?? "Não foi possível atualizar o status da categoria.",
      });
      setPendingId(null);
      return;
    }

    setFeedback({ type: "success", message: "Status da categoria atualizado." });
    setPendingId(null);
    router.refresh();
  };

  const removeCategory = async (category: AdminCategorySummary) => {
    const confirmation = window.confirm(
      "Remover esta categoria também apagará os produtos associados. Deseja continuar?",
    );

    if (!confirmation) {
      return;
    }

    setPendingId(category.id);
    setFeedback(null);

    const response = await fetch(`/api/catalog/categories/${category.id}`, {
      method: "DELETE",
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setFeedback({ type: "danger", message: data.message ?? "Falha ao excluir a categoria." });
      setPendingId(null);
      return;
    }

    setFeedback({ type: "success", message: "Categoria removida." });
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
              <h2 className="mb-1">Categorias cadastradas</h2>
              <p className="mb-0 text-secondary">Visualize proprietários, status e volume de produtos.</p>
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
                  <th>Status</th>
                  <th>Produtos</th>
                  <th className="text-end">Ações</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-secondary py-4">
                      Nenhuma categoria cadastrada no momento.
                    </td>
                  </tr>
                ) : (
                  categories.map((category) => (
                    <tr key={category.id}>
                      <td>
                        <div className="d-flex flex-column">
                          <strong>{category.name}</strong>
                          {category.description && (
                            <span className="text-secondary small">{category.description}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="d-flex flex-column">
                          <span>{category.ownerName}</span>
                          <span className="text-secondary small">{category.ownerEmail}</span>
                        </div>
                      </td>
                      <td>
                        <Badge bg={category.isActive ? "success" : "secondary"}>
                          {category.isActive ? "Ativa" : "Inativa"}
                        </Badge>
                      </td>
                      <td>{category.productCount}</td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-2">
                          <Button
                            size="sm"
                            variant={category.isActive ? "outline-secondary" : "outline-success"}
                            onClick={() => setStatus(category, !category.isActive)}
                            disabled={pendingId === category.id}
                          >
                            {pendingId === category.id
                              ? "Atualizando..."
                              : category.isActive
                                ? "Desativar"
                                : "Ativar"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline-danger"
                            onClick={() => removeCategory(category)}
                            disabled={pendingId === category.id}
                          >
                            {pendingId === category.id ? "Removendo..." : "Excluir"}
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
    </section>
  );
};

export default AdminCategoryManager;
