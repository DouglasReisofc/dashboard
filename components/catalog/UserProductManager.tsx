"use client";

import { useState } from "react";
import { Alert, Button, Card, Col, Form, Modal, Row, Table } from "react-bootstrap";
import { useRouter } from "next/navigation";

import type { CategorySummary, ProductSummary } from "types/catalog";
import type { UserPlanStatus } from "types/plans";
import { formatDate } from "lib/format";
import { META_INTERACTIVE_BODY_LIMIT } from "lib/meta-limits";

type ProductFormState = {
  categoryId: string;
  details: string;
  resaleLimit: string;
  file: File | null;
  removeFile: boolean;
};

type Feedback = { type: "success" | "danger"; message: string } | null;

type Props = {
  categories: CategorySummary[];
  products: ProductSummary[];
  planStatus: UserPlanStatus;
};

const emptyProductForm: ProductFormState = {
  categoryId: "",
  details: "",
  resaleLimit: "1",
  file: null,
  removeFile: false,
};

const statusLabel = (status: UserPlanStatus["status"]) => {
  switch (status) {
    case "active":
      return "Plano ativo";
    case "pending":
      return "Pagamento pendente";
    case "expired":
      return "Plano expirado";
    default:
      return "Nenhum plano";
  }
};

const UserProductManager = ({ categories, products, planStatus }: Props) => {
  const router = useRouter();

  const canManage = planStatus.status === "active";

  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productForm, setProductForm] = useState<ProductFormState>(emptyProductForm);
  const [editingProduct, setEditingProduct] = useState<ProductSummary | null>(null);
  const [productFeedback, setProductFeedback] = useState<Feedback>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<number | null>(null);
  const [viewProduct, setViewProduct] = useState<ProductSummary | null>(null);

  const resetProductForm = () => {
    setProductForm(emptyProductForm);
    setEditingProduct(null);
    setProductModalOpen(false);
  };

  const handleChange = <T extends keyof ProductFormState>(field: T, value: ProductFormState[T]) => {
    setProductForm((prev) => ({ ...prev, [field]: value }));
  };

  const openProductModal = (product?: ProductSummary) => {
    if (!canManage) {
      setProductFeedback({
        type: "danger",
        message: "Ative seu plano para cadastrar ou editar produtos.",
      });
      return;
    }

    if (product) {
      setEditingProduct(product);
      setProductForm({
        categoryId: product.categoryId.toString(),
        details: product.details,
        resaleLimit: product.resaleLimit.toString(),
        file: null,
        removeFile: false,
      });
    } else {
      setEditingProduct(null);
      setProductForm(emptyProductForm);
    }

    setProductFeedback(null);
    setProductModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!canManage) {
      setProductFeedback({
        type: "danger",
        message: "Plano inativo. Efetue a assinatura para continuar.",
      });
      return;
    }

    setIsSubmitting(true);
    setProductFeedback(null);

    const formData = new FormData();
    formData.append("categoryId", productForm.categoryId);
    formData.append("details", productForm.details);
    formData.append("resaleLimit", productForm.resaleLimit);

    if (productForm.file) {
      formData.append("file", productForm.file);
    }

    if (editingProduct && productForm.removeFile) {
      formData.append("removeFile", "true");
    }

    const url = editingProduct ? `/api/catalog/products/${editingProduct.id}` : "/api/catalog/products";
    const method = editingProduct ? "PUT" : "POST";

    const response = await fetch(url, { method, body: formData });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setProductFeedback({
        type: "danger",
        message: data.message ?? "Não foi possível salvar o produto.",
      });
      setIsSubmitting(false);
      return;
    }

    setProductFeedback({
      type: "success",
      message: editingProduct ? "Produto atualizado com sucesso." : "Produto criado com sucesso.",
    });

    setTimeout(() => {
      resetProductForm();
      router.refresh();
    }, 350);
    setIsSubmitting(false);
  };

  const handleDelete = async (product: ProductSummary) => {
    if (!canManage) {
      setProductFeedback({
        type: "danger",
        message: "Plano inativo. Efetue a assinatura para continuar.",
      });
      return;
    }

    const confirmation = window.confirm("Confirma a remoção definitiva deste produto digital?");
    if (!confirmation) {
      return;
    }

    setDeletingProductId(product.id);
    setProductFeedback(null);

    const response = await fetch(`/api/catalog/products/${product.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setProductFeedback({
        type: "danger",
        message: data.message ?? "Não foi possível remover o produto.",
      });
      setDeletingProductId(null);
      return;
    }

    setProductFeedback({ type: "success", message: "Produto removido com sucesso." });
    setDeletingProductId(null);
    router.refresh();
  };

  const renderPlanAlert = () => {
    if (canManage) {
      return null;
    }

    return (
      <Alert variant="warning" className="mb-4">
        <strong>{statusLabel(planStatus.status)}.</strong> Você precisa de um plano ativo para criar, editar ou
        remover produtos. Acesse <a href="/dashboard/user/plano">Meu plano</a> para contratar ou renovar.
      </Alert>
    );
  };

  const renderProductForm = () => (
    <Form>
      <Row className="g-3">
        <Col md={6}>
          <Form.Group className="mb-3">
            <Form.Label>Categoria</Form.Label>
            <Form.Select
              value={productForm.categoryId}
              onChange={(event) => handleChange("categoryId", event.target.value)}
              disabled={!canManage || categories.length === 0}
            >
              <option value="">Selecione uma categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name} {category.isActive ? "" : "(inativa)"}
                </option>
              ))}
            </Form.Select>
            {categories.length === 0 && (
              <Form.Text className="text-danger">Cadastre uma categoria antes de criar produtos.</Form.Text>
            )}
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group className="mb-3">
            <Form.Label>Limite de revendas</Form.Label>
            <Form.Control
              type="number"
              min={0}
              value={productForm.resaleLimit}
              onChange={(event) => handleChange("resaleLimit", event.target.value)}
              disabled={!canManage}
            />
            <Form.Text className="text-secondary">
              Quando o limite chegar a zero o produto ficará esgotado automaticamente.
            </Form.Text>
          </Form.Group>
        </Col>
      </Row>
      <Form.Group className="mb-3">
        <Form.Label>Detalhes secretos</Form.Label>
        <Form.Control
          as="textarea"
          rows={4}
          value={productForm.details}
          onChange={(event) => handleChange("details", event.target.value)}
          placeholder="Cole aqui o conteúdo confidencial"
          maxLength={META_INTERACTIVE_BODY_LIMIT}
          disabled={!canManage}
        />
        <Form.Text className="text-secondary">
          Máximo de {META_INTERACTIVE_BODY_LIMIT} caracteres enviados após a compra.
        </Form.Text>
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>Anexo opcional</Form.Label>
        <Form.Control
          type="file"
          onChange={(event) => handleChange("file", (event.target as HTMLInputElement).files?.[0] ?? null)}
          disabled={!canManage}
        />
        {editingProduct && editingProduct.filePath && (
          <Form.Check
            className="mt-2"
            type="switch"
            id="remove-product-file"
            label="Remover arquivo atual"
            checked={productForm.removeFile}
            onChange={(event) => handleChange("removeFile", event.target.checked)}
            disabled={!canManage}
          />
        )}
      </Form.Group>
    </Form>
  );

  return (
    <section>
      {renderPlanAlert()}

      {productFeedback && (
        <Alert variant={productFeedback.type} onClose={() => setProductFeedback(null)} dismissible>
          {productFeedback.message}
        </Alert>
      )}

      <Card className="mb-4">
        <Card.Body>
          <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-lg-between gap-3 mb-3">
            <div>
              <h2 className="mb-1">Produtos digitais</h2>
              <p className="mb-0 text-secondary">
                Publique conteúdos secretos, defina limites de revenda e mantenha anexos seguros para cada produto.
              </p>
            </div>
            <Button
              onClick={() => openProductModal()}
              variant="primary"
              disabled={!canManage || categories.length === 0 || isSubmitting}
            >
              Novo produto
            </Button>
          </div>
          {categories.length === 0 && (
            <Alert variant="info" className="mb-3">
              Cadastre uma categoria antes de criar produtos digitais.
            </Alert>
          )}
          <div className="table-responsive">
            <Table hover className="align-middle mb-0">
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th>Limite</th>
                  <th>Criado em</th>
                  <th className="text-end">Ações</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center text-secondary py-4">
                      Você ainda não cadastrou produtos digitais.
                    </td>
                  </tr>
                ) : (
                  products.map((product) => (
                    <tr key={product.id}>
                      <td>{product.categoryName}</td>
                      <td>{product.resaleLimit === 0 ? "Esgotado" : product.resaleLimit}</td>
                      <td>{formatDate(product.createdAt)}</td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-2">
                          <Button
                            size="sm"
                            variant="outline-primary"
                            onClick={() => setViewProduct(product)}
                          >
                            Detalhes
                          </Button>
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            onClick={() => openProductModal(product)}
                            disabled={!canManage || deletingProductId === product.id}
                          >
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline-danger"
                            onClick={() => handleDelete(product)}
                            disabled={!canManage || deletingProductId === product.id}
                          >
                            {deletingProductId === product.id ? "Removendo..." : "Excluir"}
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

      <Modal show={productModalOpen} onHide={resetProductForm} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>{editingProduct ? "Editar produto" : "Novo produto"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>{renderProductForm()}</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={resetProductForm} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={isSubmitting || !canManage || categories.length === 0}
          >
            {isSubmitting ? "Salvando..." : "Salvar"}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={Boolean(viewProduct)} onHide={() => setViewProduct(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Detalhes do produto</Modal.Title>
        </Modal.Header>
        {viewProduct && (
          <Modal.Body>
            <h5 className="mb-1">{viewProduct.categoryName}</h5>
            <p className="text-secondary mb-3">
              Produto vinculado à categoria selecionada. Limite de revendas:
              {" "}
              {viewProduct.resaleLimit === 0 ? "esgotado" : `${viewProduct.resaleLimit} restante(s)`}.
            </p>
            <Card className="mb-3">
              <Card.Header>Conteúdo secreto</Card.Header>
              <Card.Body>
                <pre className="mb-0 small" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {viewProduct.details}
                </pre>
              </Card.Body>
            </Card>
            {viewProduct.filePath && (
              <Alert variant="info" className="mb-0">
                Arquivo disponível para download:{" "}
                <a href={`/${viewProduct.filePath}`} target="_blank" rel="noreferrer">
                  Abrir anexo
                </a>
              </Alert>
            )}
          </Modal.Body>
        )}
      </Modal>
    </section>
  );
};

export default UserProductManager;
