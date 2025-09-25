"use client";

import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Form, Modal, Table } from "react-bootstrap";
import { useRouter } from "next/navigation";

import {
  META_INTERACTIVE_BODY_LIMIT,
  META_INTERACTIVE_ROW_TITLE_LIMIT,
} from "lib/meta-limits";

import type { CategorySummary } from "types/catalog";
import type { UserPlanStatus } from "types/plans";

type CategoryFormState = {
  name: string;
  price: string;
  sku: string;
  description: string;
  status: "active" | "inactive";
  imageFile: File | null;
  removeImage: boolean;
};

type Feedback = { type: "success" | "danger"; message: string } | null;

type Props = {
  categories: CategorySummary[];
  planStatus: UserPlanStatus;
};

const emptyCategoryForm: CategoryFormState = {
  name: "",
  price: "0,00",
  sku: "",
  description: "",
  status: "active",
  imageFile: null,
  removeImage: false,
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

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const UserCategoryManager = ({ categories, planStatus }: Props) => {
  const router = useRouter();
  const canManage = planStatus.status === "active";

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(emptyCategoryForm);
  const [editingCategory, setEditingCategory] = useState<CategorySummary | null>(null);
  const [categoryFeedback, setCategoryFeedback] = useState<Feedback>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentImagePath, setCurrentImagePath] = useState<string | null>(null);

  const cleanupPreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const resetForm = () => {
    cleanupPreview();
    setPreviewUrl(null);
    setCurrentImagePath(null);
    setCategoryForm(emptyCategoryForm);
    setEditingCategory(null);
    setCategoryModalOpen(false);
  };

  const handleChange = <T extends keyof CategoryFormState>(field: T, value: CategoryFormState[T]) => {
    setCategoryForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleImageChange = (file: File | null) => {
    cleanupPreview();
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setCategoryForm((prev) => ({ ...prev, imageFile: file, removeImage: false }));
    } else {
      setPreviewUrl(null);
      setCategoryForm((prev) => ({ ...prev, imageFile: null }));
    }
  };

  const openCategoryModal = (category?: CategorySummary) => {
    if (!canManage) {
      setCategoryFeedback({
        type: "danger",
        message: "Ative seu plano para cadastrar ou editar categorias.",
      });
      return;
    }

    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        name: category.name,
        price: formatCurrency(category.price),
        sku: category.sku,
        description: category.description,
        status: category.isActive ? "active" : "inactive",
        imageFile: null,
        removeImage: false,
      });
      setCurrentImagePath(category.imagePath ?? null);
      setPreviewUrl(null);
    } else {
      setEditingCategory(null);
      setCategoryForm(emptyCategoryForm);
      setCurrentImagePath(null);
      setPreviewUrl(null);
    }

    setCategoryFeedback(null);
    setCategoryModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!canManage) {
      setCategoryFeedback({
        type: "danger",
        message: "Plano inativo. Efetue a assinatura para continuar.",
      });
      return;
    }

    setIsSubmitting(true);
    setCategoryFeedback(null);

    const formData = new FormData();
    formData.append("name", categoryForm.name);
    formData.append("price", categoryForm.price);
    formData.append("sku", categoryForm.sku);
    formData.append("description", categoryForm.description);
    formData.append("status", categoryForm.status);

    if (categoryForm.imageFile) {
      formData.append("image", categoryForm.imageFile);
    }

    if (editingCategory && categoryForm.removeImage) {
      formData.append("removeImage", "true");
    }

    const url = editingCategory ? `/api/catalog/categories/${editingCategory.id}` : "/api/catalog/categories";
    const method = editingCategory ? "PUT" : "POST";

    const response = await fetch(url, { method, body: formData });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setCategoryFeedback({
        type: "danger",
        message: data.message ?? "Não foi possível salvar a categoria.",
      });
      setIsSubmitting(false);
      return;
    }

    setCategoryFeedback({
      type: "success",
        message: editingCategory ? "Categoria atualizada com sucesso." : "Categoria criada com sucesso.",
    });

    setTimeout(() => {
      resetForm();
      router.refresh();
    }, 350);
    setIsSubmitting(false);
  };

  const handleDelete = async (category: CategorySummary) => {
    if (!canManage) {
      setCategoryFeedback({
        type: "danger",
        message: "Plano inativo. Efetue a assinatura para continuar.",
      });
      return;
    }

    const confirmation = window.confirm(
      "Ao remover esta categoria todos os produtos associados também serão apagados. Deseja continuar?",
    );

    if (!confirmation) {
      return;
    }

    setDeletingCategoryId(category.id);
    setCategoryFeedback(null);

    const response = await fetch(`/api/catalog/categories/${category.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setCategoryFeedback({
        type: "danger",
        message: data.message ?? "Não foi possível remover a categoria.",
      });
      setDeletingCategoryId(null);
      return;
    }

    setCategoryFeedback({ type: "success", message: "Categoria removida com sucesso." });
    setDeletingCategoryId(null);
    router.refresh();
  };

  const renderPlanAlert = () => {
    if (canManage) {
      return null;
    }

    return (
      <Alert variant="warning" className="mb-4">
        <strong>{statusLabel(planStatus.status)}.</strong> Você precisa de um plano ativo para criar, editar ou
        remover categorias. Acesse a página <a href="/dashboard/user/plano">Meu plano</a> para assinar ou renovar.
      </Alert>
    );
  };

  const renderForm = () => (
    <Form>
      <Form.Group className="mb-3">
        <Form.Label>Nome</Form.Label>
        <Form.Control
          value={categoryForm.name}
          onChange={(event) => handleChange("name", event.target.value)}
          placeholder="Categoria"
          maxLength={META_INTERACTIVE_ROW_TITLE_LIMIT}
          required
          disabled={!canManage}
        />
        <Form.Text className="text-secondary">
          Máximo de {META_INTERACTIVE_ROW_TITLE_LIMIT} caracteres exibidos no menu do bot.
        </Form.Text>
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>Valor (R$)</Form.Label>
        <Form.Control
          value={categoryForm.price}
          onChange={(event) => handleChange("price", event.target.value)}
          placeholder="0,00"
          disabled={!canManage}
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>SKU</Form.Label>
        <Form.Control
          value={categoryForm.sku}
          onChange={(event) => handleChange("sku", event.target.value)}
          placeholder="SKU interno"
          disabled={!canManage}
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>Descrição</Form.Label>
        <Form.Control
          as="textarea"
          rows={3}
          value={categoryForm.description}
          onChange={(event) => handleChange("description", event.target.value)}
          placeholder="Detalhes exibidos para o cliente"
          maxLength={META_INTERACTIVE_BODY_LIMIT}
          disabled={!canManage}
        />
        <Form.Text className="text-secondary">
          Máximo de {META_INTERACTIVE_BODY_LIMIT} caracteres utilizados nas mensagens do bot.
        </Form.Text>
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>Status</Form.Label>
        <Form.Select
          value={categoryForm.status}
          onChange={(event) => handleChange("status", event.target.value as CategoryFormState["status"])}
          disabled={!canManage}
        >
          <option value="active">Manter ativa</option>
          <option value="inactive">Deixar inativa</option>
        </Form.Select>
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>Imagem da categoria</Form.Label>
        <Form.Control
          type="file"
          accept="image/*"
          onChange={(event) => handleImageChange((event.target as HTMLInputElement).files?.[0] ?? null)}
          disabled={!canManage}
        />
        {(previewUrl || (currentImagePath && !categoryForm.removeImage)) && (
          <div className="mt-3">
            <img
              src={previewUrl ?? `/${currentImagePath}`}
              alt="Pré-visualização da categoria"
              className="img-fluid rounded border"
            />
          </div>
        )}
        {editingCategory && editingCategory.imagePath && (
          <Form.Check
            className="mt-2"
            type="switch"
            id="remove-category-image"
            label="Remover imagem atual"
            checked={categoryForm.removeImage}
            onChange={(event) => handleChange("removeImage", event.target.checked)}
            disabled={!canManage}
          />
        )}
      </Form.Group>
    </Form>
  );

  return (
    <section>
      {renderPlanAlert()}

      {categoryFeedback && (
        <Alert variant={categoryFeedback.type} onClose={() => setCategoryFeedback(null)} dismissible>
          {categoryFeedback.message}
        </Alert>
      )}

      <Card>
        <Card.Body>
          <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-lg-between gap-3 mb-3">
            <div>
              <h2 className="mb-1">Categorias</h2>
              <p className="mb-0 text-secondary">
                Organize seus produtos digitais por temas, defina valores e controle a disponibilidade no bot.
              </p>
            </div>
            <Button variant="primary" onClick={() => openCategoryModal()} disabled={!canManage || isSubmitting}>
              Nova categoria
            </Button>
          </div>

          <div className="table-responsive">
            <Table hover className="align-middle mb-0">
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th>Valor</th>
                  <th>SKU</th>
                  <th>Status</th>
                  <th>Produtos</th>
                  <th className="text-end">Ações</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-secondary py-4">
                      Nenhuma categoria cadastrada ainda.
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
                          {category.imagePath && (
                            <a href={`/${category.imagePath}`} target="_blank" rel="noreferrer" className="small">
                              Ver imagem
                            </a>
                          )}
                        </div>
                      </td>
                      <td>R$ {formatCurrency(category.price)}</td>
                      <td>{category.sku || "—"}</td>
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
                            variant="outline-secondary"
                            onClick={() => openCategoryModal(category)}
                            disabled={!canManage || deletingCategoryId === category.id}
                          >
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline-danger"
                            onClick={() => handleDelete(category)}
                            disabled={!canManage || deletingCategoryId === category.id}
                          >
                            {deletingCategoryId === category.id ? "Removendo..." : "Excluir"}
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

      <Modal show={categoryModalOpen} onHide={resetForm} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>{editingCategory ? "Editar categoria" : "Nova categoria"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>{renderForm()}</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={resetForm} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting || !canManage}>
            {isSubmitting ? "Salvando..." : "Salvar"}
          </Button>
        </Modal.Footer>
      </Modal>
    </section>
  );
};

export default UserCategoryManager;
