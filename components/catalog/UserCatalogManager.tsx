"use client";

import { useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  Modal,
  Row,
  Table,
  Tab,
  Tabs,
} from "react-bootstrap";
import { useRouter } from "next/navigation";

import type { CategorySummary, ProductSummary } from "types/catalog";

type CategoryFormState = {
  name: string;
  price: string;
  sku: string;
  description: string;
  status: "active" | "inactive";
  imageFile: File | null;
  removeImage: boolean;
};

type ProductFormState = {
  name: string;
  categoryId: string;
  details: string;
  resaleLimit: string;
  file: File | null;
  removeFile: boolean;
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

const emptyProductForm: ProductFormState = {
  name: "",
  categoryId: "",
  details: "",
  resaleLimit: "0",
  file: null,
  removeFile: false,
};

type Feedback = { type: "success" | "danger"; message: string } | null;

interface UserCatalogManagerProps {
  categories: CategorySummary[];
  products: ProductSummary[];
}

const formatCurrency = (value: number) => {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const UserCatalogManager = ({ categories, products }: UserCatalogManagerProps) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"categories" | "products">("categories");
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(emptyCategoryForm);
  const [productForm, setProductForm] = useState<ProductFormState>(emptyProductForm);
  const [editingCategory, setEditingCategory] = useState<CategorySummary | null>(null);
  const [editingProduct, setEditingProduct] = useState<ProductSummary | null>(null);
  const [categoryFeedback, setCategoryFeedback] = useState<Feedback>(null);
  const [productFeedback, setProductFeedback] = useState<Feedback>(null);
  const [isCategorySubmitting, setIsCategorySubmitting] = useState(false);
  const [isProductSubmitting, setIsProductSubmitting] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<number | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<number | null>(null);
  const [viewProduct, setViewProduct] = useState<ProductSummary | null>(null);

  const resetCategoryForm = () => {
    setCategoryForm(emptyCategoryForm);
    setEditingCategory(null);
    setCategoryModalOpen(false);
  };

  const resetProductForm = () => {
    setProductForm(emptyProductForm);
    setEditingProduct(null);
    setProductModalOpen(false);
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
    setCategoryModalOpen(true);
    setCategoryFeedback(null);
  };

  const openProductModal = (product?: ProductSummary) => {
    if (product) {
      setEditingProduct(product);
      setProductForm({
        name: product.name,
        categoryId: product.categoryId.toString(),
        details: product.details,
        resaleLimit: product.resaleLimit.toString(),
        file: null,
        removeFile: false,
      });
    } else {
      setProductForm(emptyProductForm);
      setEditingProduct(null);
    }
    setProductModalOpen(true);
    setProductFeedback(null);
  };

  const handleCategoryChange = <T extends keyof CategoryFormState>(field: T, value: CategoryFormState[T]) => {
    setCategoryForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleProductChange = <T extends keyof ProductFormState>(field: T, value: ProductFormState[T]) => {
    setProductForm((prev) => ({ ...prev, [field]: value }));
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

    const url = editingCategory
      ? `/api/catalog/categories/${editingCategory.id}`
      : "/api/catalog/categories";

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

  const handleProductSubmit = async () => {
    setIsProductSubmitting(true);
    setProductFeedback(null);

    const formData = new FormData();
    formData.append("name", productForm.name);
    formData.append("categoryId", productForm.categoryId);
    formData.append("details", productForm.details);
    formData.append("resaleLimit", productForm.resaleLimit);

    if (productForm.file) {
      formData.append("file", productForm.file);
    }

    if (editingProduct && productForm.removeFile) {
      formData.append("removeFile", "true");
    }

    const url = editingProduct
      ? `/api/catalog/products/${editingProduct.id}`
      : "/api/catalog/products";
    const method = editingProduct ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      body: formData,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setProductFeedback({
        type: "danger",
        message: data.message ?? "Não foi possível salvar o produto.",
      });
      setIsProductSubmitting(false);
      return;
    }

    setProductFeedback({
      type: "success",
      message: editingProduct ? "Produto atualizado com sucesso." : "Produto criado com sucesso.",
    });

    setIsProductSubmitting(false);
    setTimeout(() => {
      resetProductForm();
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

  const handleDeleteProduct = async (product: ProductSummary) => {
    const confirmation = window.confirm("Confirma a remoção definitiva deste produto digital?");
    if (!confirmation) {
      return;
    }

    setDeletingProductId(product.id);
    setProductFeedback(null);

    const response = await fetch(`/api/catalog/products/${product.id}`, {
      method: "DELETE",
    });

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
      <Row className="g-3">
        <Col md={6}>
          <Form.Group className="mb-3">
            <Form.Label>Valor (R$)</Form.Label>
            <Form.Control
              value={categoryForm.price}
              onChange={(event) => handleCategoryChange("price", event.target.value)}
              placeholder="0,00"
            />
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group className="mb-3">
            <Form.Label>SKU</Form.Label>
            <Form.Control
              value={categoryForm.sku}
              onChange={(event) => handleCategoryChange("sku", event.target.value)}
              placeholder="SKU interno"
            />
          </Form.Group>
        </Col>
      </Row>
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

  const renderProductForm = () => (
    <Form>
      <Form.Group className="mb-3">
        <Form.Label>Nome do produto</Form.Label>
        <Form.Control
          value={productForm.name}
          onChange={(event) => handleProductChange("name", event.target.value)}
          placeholder="Produto digital"
          required
        />
      </Form.Group>
      <Row className="g-3">
        <Col md={6}>
          <Form.Group className="mb-3">
            <Form.Label>Categoria</Form.Label>
            <Form.Select
              value={productForm.categoryId}
              onChange={(event) => handleProductChange("categoryId", event.target.value)}
            >
              <option value="">Selecione uma categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name} {category.isActive ? "" : "(inativa)"}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group className="mb-3">
            <Form.Label>Limite de revendas</Form.Label>
            <Form.Control
              type="number"
              min={0}
              value={productForm.resaleLimit}
              onChange={(event) => handleProductChange("resaleLimit", event.target.value)}
            />
            <Form.Text>Use 0 para ilimitado.</Form.Text>
          </Form.Group>
        </Col>
      </Row>
      <Form.Group className="mb-3">
        <Form.Label>Detalhes secretos</Form.Label>
        <Form.Control
          as="textarea"
          rows={4}
          value={productForm.details}
          onChange={(event) => handleProductChange("details", event.target.value)}
          placeholder="Cole aqui o conteúdo confidencial"
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>Anexo opcional</Form.Label>
        <Form.Control
          type="file"
          onChange={(event) => handleProductChange("file", event.target.files?.[0] ?? null)}
        />
        {editingProduct && editingProduct.filePath && (
          <Form.Check
            className="mt-2"
            type="switch"
            id="remove-product-file"
            label="Remover arquivo atual"
            checked={productForm.removeFile}
            onChange={(event) => handleProductChange("removeFile", event.target.checked)}
          />
        )}
      </Form.Group>
    </Form>
  );

  return (
    <section>
      <Tabs
        id="user-catalog-tabs"
        activeKey={activeTab}
        onSelect={(key) => setActiveTab((key as "categories" | "products") ?? "categories")}
        className="mb-4"
        justify
      >
        <Tab eventKey="categories" title="Categorias">
          <div className="pt-4" id="categories">
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
                                    className="small"
                                    href={`/${category.imagePath}`}
                                    target="_blank"
                                    rel="noreferrer"
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
                                <Button
                                  size="sm"
                                  variant="outline-secondary"
                                  onClick={() => openCategoryModal(category)}
                                >
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
          </div>
        </Tab>
        <Tab eventKey="products" title="Produtos digitais">
          <div className="pt-4" id="products">
            <Card>
              <Card.Body>
                <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-lg-between gap-3 mb-3">
                  <div>
                    <h2 className="mb-1">Produtos digitais</h2>
                    <p className="mb-0 text-secondary">
                      Vincule conteúdos sigilosos às suas categorias e defina limites de revenda.
                    </p>
                  </div>
                  <Button onClick={() => openProductModal()} variant="primary" disabled={categories.length === 0}>
                    Novo produto
                  </Button>
                </div>
                {productFeedback && (
                  <Alert
                    variant={productFeedback.type}
                    onClose={() => setProductFeedback(null)}
                    dismissible
                    className="mb-4"
                  >
                    {productFeedback.message}
                  </Alert>
                )}
                <div className="table-responsive">
                  <Table hover className="align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Produto</th>
                        <th>Categoria</th>
                        <th>Limite de revendas</th>
                        <th>Cadastro</th>
                        <th className="text-end">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center text-secondary py-4">
                            Você ainda não cadastrou produtos digitais.
                          </td>
                        </tr>
                      ) : (
                        products.map((product) => (
                          <tr key={product.id}>
                            <td>{product.name}</td>
                            <td>{product.categoryName}</td>
                            <td>{product.resaleLimit === 0 ? "Ilimitado" : product.resaleLimit}</td>
                            <td>{new Date(product.createdAt).toLocaleDateString("pt-BR")}</td>
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
                                >
                                  Editar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline-danger"
                                  disabled={deletingProductId === product.id}
                                  onClick={() => handleDeleteProduct(product)}
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
          </div>
        </Tab>
      </Tabs>

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

      <Modal show={productModalOpen} onHide={resetProductForm} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>{editingProduct ? "Editar produto" : "Novo produto"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>{renderProductForm()}</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={resetProductForm} disabled={isProductSubmitting}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleProductSubmit}
            disabled={isProductSubmitting || categories.length === 0}
          >
            {isProductSubmitting ? "Salvando..." : "Salvar"}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={Boolean(viewProduct)} onHide={() => setViewProduct(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Detalhes do produto</Modal.Title>
        </Modal.Header>
        {viewProduct && (
          <Modal.Body>
            <h5 className="mb-1">{viewProduct.name}</h5>
            <p className="text-secondary mb-3">
              Vinculado à categoria {viewProduct.categoryName}. Limite de revendas:
              {" "}
              {viewProduct.resaleLimit === 0 ? "ilimitado" : `${viewProduct.resaleLimit} vezes`}.
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
                Arquivo disponível para download:
                {" "}
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

export default UserCatalogManager;
