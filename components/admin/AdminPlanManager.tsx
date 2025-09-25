"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Form,
  Modal,
  Table,
} from "react-bootstrap";
import { useRouter } from "next/navigation";

import type { SubscriptionPlan } from "types/plans";

interface AdminPlanManagerProps {
  plans: SubscriptionPlan[];
}

type Feedback = { type: "success" | "danger"; message: string } | null;

type ModalMode = "create" | "edit";

type FormState = {
  name: string;
  description: string;
  price: string;
  categoryLimit: string;
  durationDays: string;
  isActive: boolean;
};

const buildInitialFormState = (): FormState => ({
  name: "",
  description: "",
  price: "0",
  categoryLimit: "0",
  durationDays: "30",
  isActive: true,
});

const buildFormStateFromPlan = (plan: SubscriptionPlan): FormState => ({
  name: plan.name,
  description: plan.description ?? "",
  price: plan.price.toString(),
  categoryLimit: plan.categoryLimit.toString(),
  durationDays: plan.durationDays.toString(),
  isActive: plan.isActive,
});

const AdminPlanManager = ({ plans }: AdminPlanManagerProps) => {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [showModal, setShowModal] = useState(false);
  const [formState, setFormState] = useState<FormState>(() => buildInitialFormState());
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingPlanId, setPendingPlanId] = useState<number | null>(null);

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }),
    [],
  );

  const openCreateModal = () => {
    setModalMode("create");
    setFormState(buildInitialFormState());
    setCurrentPlan(null);
    setShowModal(true);
  };

  const openEditModal = (plan: SubscriptionPlan) => {
    setModalMode("edit");
    setFormState(buildFormStateFromPlan(plan));
    setCurrentPlan(plan);
    setShowModal(true);
  };

  const closeModal = () => {
    if (isSubmitting) {
      return;
    }

    setShowModal(false);
    setCurrentPlan(null);
    setFormState(buildInitialFormState());
  };

  const handleChange = <Field extends keyof FormState>(field: Field, value: FormState[Field]) => {
    setFormState((previous) => ({ ...previous, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    const payload = {
      name: formState.name,
      description: formState.description || null,
      price: Number.parseFloat(formState.price.replace(/,/g, ".")),
      categoryLimit: Number.parseInt(formState.categoryLimit, 10),
      durationDays: Number.parseInt(formState.durationDays, 10),
      isActive: formState.isActive,
    };

    const isEditing = modalMode === "edit" && currentPlan;

    const endpoint = isEditing ? `/api/admin/plans/${currentPlan!.id}` : "/api/admin/plans";
    const method = isEditing ? "PUT" : "POST";

    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setFeedback({
        type: "danger",
        message: data.message ?? "Não foi possível salvar o plano.",
      });
      setIsSubmitting(false);
      return;
    }

    setFeedback({
      type: "success",
      message: data.message ?? (isEditing ? "Plano atualizado com sucesso." : "Plano criado com sucesso."),
    });
    setIsSubmitting(false);
    setShowModal(false);
    setCurrentPlan(null);
    router.refresh();
  };

  const togglePlanStatus = async (plan: SubscriptionPlan) => {
    setPendingPlanId(plan.id);
    setFeedback(null);

    const response = await fetch(`/api/admin/plans/${plan.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: plan.name,
        description: plan.description,
        price: plan.price,
        categoryLimit: plan.categoryLimit,
        durationDays: plan.durationDays,
        isActive: !plan.isActive,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setFeedback({
        type: "danger",
        message: data.message ?? "Não foi possível atualizar o status do plano.",
      });
      setPendingPlanId(null);
      return;
    }

    setFeedback({ type: "success", message: data.message ?? "Plano atualizado." });
    setPendingPlanId(null);
    router.refresh();
  };

  const removePlan = async (plan: SubscriptionPlan) => {
    const confirmation = window.confirm(
      `Excluir o plano "${plan.name}" removerá essa opção para novas assinaturas. Deseja continuar?`,
    );

    if (!confirmation) {
      return;
    }

    setPendingPlanId(plan.id);
    setFeedback(null);

    const response = await fetch(`/api/admin/plans/${plan.id}`, {
      method: "DELETE",
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setFeedback({
        type: "danger",
        message: data.message ?? "Não foi possível remover o plano.",
      });
      setPendingPlanId(null);
      return;
    }

    setFeedback({ type: "success", message: data.message ?? "Plano removido." });
    setPendingPlanId(null);
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

      <Card>
        <Card.Header className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
          <div>
            <Card.Title as="h2" className="h5 mb-1">
              Planos de assinatura
            </Card.Title>
            <Card.Subtitle className="text-secondary">
              Crie, edite e organize os planos oferecidos aos usuários, definindo preços, limites e duração.
            </Card.Subtitle>
          </div>
          <Button variant="primary" onClick={openCreateModal}>
            Criar novo plano
          </Button>
        </Card.Header>
        <Card.Body className="p-0">
          <div className="table-responsive">
            <Table hover className="align-middle mb-0">
              <thead>
                <tr>
                  <th>Plano</th>
                  <th>Preço</th>
                  <th>Limite de categorias</th>
                  <th>Dias</th>
                  <th>Status</th>
                  <th className="text-end">Ações</th>
                </tr>
              </thead>
              <tbody>
                {plans.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-secondary py-4">
                      Nenhum plano cadastrado até o momento.
                    </td>
                  </tr>
                ) : (
                  plans.map((plan) => (
                    <tr key={plan.id}>
                      <td>
                        <div className="d-flex flex-column">
                          <strong>{plan.name}</strong>
                          {plan.description && (
                            <span className="text-secondary small">{plan.description}</span>
                          )}
                        </div>
                      </td>
                      <td>{currencyFormatter.format(plan.price)}</td>
                      <td>{plan.categoryLimit === 0 ? "Ilimitado" : plan.categoryLimit}</td>
                      <td>{plan.durationDays}</td>
                      <td>
                        <Badge bg={plan.isActive ? "success" : "secondary"}>
                          {plan.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-2">
                          <Button
                            size="sm"
                            variant={plan.isActive ? "outline-secondary" : "outline-success"}
                            onClick={() => togglePlanStatus(plan)}
                            disabled={pendingPlanId === plan.id}
                          >
                            {pendingPlanId === plan.id
                              ? "Atualizando..."
                              : plan.isActive
                                ? "Desativar"
                                : "Ativar"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline-primary"
                            onClick={() => openEditModal(plan)}
                            disabled={pendingPlanId === plan.id}
                          >
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline-danger"
                            onClick={() => removePlan(plan)}
                            disabled={pendingPlanId === plan.id}
                          >
                            {pendingPlanId === plan.id ? "Removendo..." : "Excluir"}
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

      <Modal show={showModal} onHide={closeModal} centered>
        <Form onSubmit={handleSubmit}>
          <Modal.Header closeButton={!isSubmitting}>
            <Modal.Title>
              {modalMode === "edit" ? "Editar plano" : "Criar plano"}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3" controlId="planName">
              <Form.Label>Nome do plano</Form.Label>
              <Form.Control
                value={formState.name}
                onChange={(event) => handleChange("name", event.target.value)}
                placeholder="Plano Starter"
                required
                maxLength={120}
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="planDescription">
              <Form.Label>Descrição (opcional)</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={formState.description}
                onChange={(event) => handleChange("description", event.target.value)}
                maxLength={500}
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="planPrice">
              <Form.Label>Preço (R$)</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                min="0"
                value={formState.price}
                onChange={(event) => handleChange("price", event.target.value)}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="planCategoryLimit">
              <Form.Label>Limite de categorias</Form.Label>
              <Form.Control
                type="number"
                min="0"
                value={formState.categoryLimit}
                onChange={(event) => handleChange("categoryLimit", event.target.value)}
                required
              />
              <Form.Text className="text-secondary">
                Use 0 para oferecer categorias ilimitadas no plano.
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3" controlId="planDuration">
              <Form.Label>Duração do plano (dias)</Form.Label>
              <Form.Control
                type="number"
                min="1"
                value={formState.durationDays}
                onChange={(event) => handleChange("durationDays", event.target.value)}
                required
              />
            </Form.Group>

            <Form.Group controlId="planStatus">
              <Form.Check
                type="switch"
                label="Plano ativo"
                checked={formState.isActive}
                onChange={(event) => handleChange("isActive", event.target.checked)}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={closeModal} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : modalMode === "edit" ? "Salvar alterações" : "Criar plano"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </section>
  );
};

export default AdminPlanManager;
