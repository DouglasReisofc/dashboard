"use client";

import { useState } from "react";
import { Alert, Badge, Button, Card, Form, Modal, Table } from "react-bootstrap";
import { useRouter } from "next/navigation";

import type { CategorySummary } from "types/catalog";

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

const emptyCategoryForm: CategoryFormState = {
  name: "",
  price: "0,00",
  sku: "",
  description: "",
  status: "active",
  imageFile: null,
  removeImage: false,
};

const formatCurrency = (value: number) => {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

interface UserCategoryManagerProps {
  categories: CategorySummary[];
}

const UserCategoryManager = ({ categories }: UserCategoryManagerProps) => {
  const router = useRouter();

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(emptyCategoryForm);
  const [editingCategory, setEditingCategory] = useState<CategorySummary | null>(null);
  const [categoryFeedback, setCategoryFeedback] = useState<Feedback>(null);
  const [isCategorySubmitting, setIsCategorySubmitting] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<number | null>(null);

  const resetCategoryForm = () => {
    setCategoryForm(emptyCategoryForm);
    setEditingCategory(null);
    setCategoryModalOpen(false);
  };

  const handleCategoryChange = <T extends keyof CategoryFormState>(field: T, value: CategoryFormState[T]) => {
    setCategoryForm((prev) => ({ ...prev, [field]: value }));
  };

  const openCategoryModal = (category?: CategorySummary) => {
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
    } else {
      setCategoryForm(emptyCategoryForm);
      setEditingCategory(null);
    }

    setCategoryFeedback(null);
    setCategoryModalOpen(true);
  };

  const handleCategorySubmit = async () => {
    setIsCategorySubmitting(true);
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

    const response = await fetch(url, {
      method,
      body: formData,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setCategoryFeedback({
        type: "danger",
        message: data.message ?? "Não foi possível salvar a categoria.",
      });
      setIsCategorySubmitting(false);
      return;
    }

    setCategoryFeedback({
      type: "success",
      message: editingCategory ? "Categoria atualizada com sucesso." : "Categoria criada com sucesso.",
    });

    setIsCategorySubmitting(false);
    setTimeout(() => {
      resetCategoryForm();
      router.refresh();
    }, 400);
  };

  const handleDeleteCategory = async (category: CategorySummary) => {
    const confirmation = window.confirm(
      "Ao remover esta categoria todos os produtos associados também serão apagados. Deseja continuar?",
    );

    if (!confirmation) {
      return;
    }

    setDeletingCategoryId(category.id);
    setCategoryFeedback(null);

    const response = await fetch(`/api/catalog/categories/${category.id}`, {
      method: "DELETE",
    });

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

  const renderStatusBadge = (isActive: boolean) => (
    <Badge bg={isActive ? "success" : "secondary"}>{isActive ? "Ativa" : "Inativa"}</Badge>
  );

  const renderCategoryForm = () => (
    <Form>
      <Form.Group className="mb-3">
        <Form.Label>Nome</Form.Label>
        <Form.Control
          value={categoryForm.name}
          onChange={(event) => handleCategoryChange("name", event.target.value)}
          placeholder="Categoria"
          required
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>Valor (R$)</Form.Label>
        <Form.Control
          value={categoryForm.price}
          onChange={(event) => handleCategoryChange("price", event.target.value)}
          placeholder="0,00"
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>SKU</Form.Label>
        <Form.Control
          value={categoryForm.sku}
          onChange={(event) => handleCategoryChange("sku", event.target.value)}
          placeholder="SKU interno"
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>Descrição</Form.Label>
        <Form.Control
          as="textarea"
          rows={3}
          value={categoryForm.description}
          onChange={(event) => handleCategoryChange("description", event.target.value)}
          placeholder="Detalhes rápidos sobre a categoria"
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>Status</Form.Label>
        <Form.Select
          value={categoryForm.status}
          onChange={(event) => handleCategoryChange("status", event.target.value as "active" | "inactive")}
        >
          <option value="active">Ativar categoria</option>
          <option value="inactive">Manter inativa</option>
        </Form.Select>
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>Imagem da categoria</Form.Label>
        <Form.Control
          type="file"
          accept="image/*"
          onChange={(event) => handleCategoryChange("imageFile", event.target.files?.[0] ?? null)}
        />
        {editingCategory && editingCategory.imagePath && (
          <Form.Check
            className="mt-2"
            type="switch"
            id="remove-category-image"
            label="Remover imagem atual"
            checked={categoryForm.removeImage}
            onChange={(event) => handleCategoryChange("removeImage", event.target.checked)}
          />
        )}
      </Form.Group>
    </Form>
  );

  return (
    <section>
      <Card className="mb-4">
        <Card.Body>
          <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-lg-between gap-3 mb-3">
            <div>
              <h2 className="mb-1">Categorias</h2>
              <p className="mb-0 text-secondary">
                Organize seus produtos digitais por temas, defina preços sugeridos e controle a visibilidade.
              </p>
            </div>
            <Button onClick={() => openCategoryModal()} variant="primary">
              Nova categoria
            </Button>
          </div>
          {categoryFeedback && (
            <Alert
              variant={categoryFeedback.type}
              onClose={() => setCategoryFeedback(null)}
              dismissible
              className="mb-4"
            >
              {categoryFeedback.message}
            </Alert>
          )}
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
                            <a
                              href={`/${category.imagePath}`}
                              target="_blank"
                              rel="noreferrer"
                              className="small"
                            >
                              Ver imagem
                            </a>
                          )}
                        </div>
                      </td>
                      <td>R$ {formatCurrency(category.price)}</td>
                      <td>{category.sku || "—"}</td>
                      <td>{renderStatusBadge(category.isActive)}</td>
                      <td>{category.productCount}</td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-2">
                          <Button size="sm" variant="outline-secondary" onClick={() => openCategoryModal(category)}>
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline-danger"
                            disabled={deletingCategoryId === category.id}
                            onClick={() => handleDeleteCategory(category)}
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

      <Modal show={categoryModalOpen} onHide={resetCategoryForm} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>{editingCategory ? "Editar categoria" : "Nova categoria"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>{renderCategoryForm()}</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={resetCategoryForm} disabled={isCategorySubmitting}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleCategorySubmit} disabled={isCategorySubmitting}>
            {isCategorySubmitting ? "Salvando..." : "Salvar"}
          </Button>
        </Modal.Footer>
      </Modal>
    </section>
  );
};

export default UserCategoryManager;
