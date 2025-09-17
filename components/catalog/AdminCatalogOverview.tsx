"use client";

import { useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Col, Modal, Row, Table } from "react-bootstrap";
import { useRouter } from "next/navigation";

import type { AdminCategorySummary, AdminProductSummary } from "types/catalog";

type Feedback = { type: "success" | "danger"; message: string } | null;

interface AdminCatalogOverviewProps {
  categories: AdminCategorySummary[];
  products: AdminProductSummary[];
}

const AdminCatalogOverview = ({ categories, products }: AdminCatalogOverviewProps) => {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [viewProduct, setViewProduct] = useState<AdminProductSummary | null>(null);

  const stats = useMemo(() => {
    const totalCategories = categories.length;
    const activeCategories = categories.filter((category) => category.isActive).length;
    const totalProducts = products.length;
    const totalAttachments = products.filter((product) => Boolean(product.filePath)).length;

    return { totalCategories, activeCategories, totalProducts, totalAttachments };
  }, [categories, products]);

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
        <Alert
          variant={feedback.type}
          onClose={() => setFeedback(null)}
          dismissible
          className="mb-4"
        >
          {feedback.message}
        </Alert>
      )}

      <Row className="g-4 mb-4">
        <Col md={3} sm={6}>
          <Card>
            <Card.Body>
              <p className="text-secondary mb-1">Categorias cadastradas</p>
              <h3 className="mb-0">{stats.totalCategories}</h3>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6}>
          <Card>
            <Card.Body>
              <p className="text-secondary mb-1">Categorias ativas</p>
              <h3 className="mb-0">{stats.activeCategories}</h3>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6}>
          <Card>
            <Card.Body>
              <p className="text-secondary mb-1">Produtos digitais</p>
              <h3 className="mb-0">{stats.totalProducts}</h3>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6}>
          <Card>
            <Card.Body>
              <p className="text-secondary mb-1">Anexos enviados</p>
              <h3 className="mb-0">{stats.totalAttachments}</h3>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-4" id="categories">
        <Col lg={12}>
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
        </Col>
      </Row>

      <Row className="g-4 mt-4" id="products">
        <Col lg={12}>
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
                      <th>Produto</th>
                      <th>Categoria</th>
                      <th>Owner</th>
                      <th>Limite</th>
                      <th className="text-end">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center text-secondary py-4">
                          Nenhum produto digital cadastrado até o momento.
                        </td>
                      </tr>
                    ) : (
                      products.map((product) => (
                        <tr key={product.id}>
                          <td>{product.name}</td>
                          <td>{product.categoryName}</td>
                          <td>
                            <div className="d-flex flex-column">
                              <span>{product.ownerName}</span>
                              <span className="text-secondary small">{product.ownerEmail}</span>
                            </div>
                          </td>
                          <td>{product.resaleLimit === 0 ? "Ilimitado" : product.resaleLimit}</td>
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
        </Col>
      </Row>

      <Modal show={Boolean(viewProduct)} onHide={() => setViewProduct(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Detalhes do produto</Modal.Title>
        </Modal.Header>
        {viewProduct && (
          <Modal.Body>
            <h5 className="mb-1">{viewProduct.name}</h5>
            <p className="text-secondary mb-3">
              Categoria {viewProduct.categoryName} – proprietário {viewProduct.ownerName} ({viewProduct.ownerEmail}).
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

export default AdminCatalogOverview;
