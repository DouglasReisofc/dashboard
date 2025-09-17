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
} from "react-bootstrap";
import { useRouter } from "next/navigation";

import type { AdminUserSummary } from "types/users";

type Feedback = { type: "success" | "danger"; message: string } | null;

interface AdminUserManagerProps {
  users: AdminUserSummary[];
}

const AdminUserManager = ({ users }: AdminUserManagerProps) => {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUserSummary | null>(null);
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    role: "user" as "admin" | "user",
    password: "",
    balance: "0",
    isActive: true,
    revokeSessions: false,
  });

  const resetForm = () => {
    setFormState({
      name: "",
      email: "",
      role: "user",
      password: "",
      balance: "0",
      isActive: true,
      revokeSessions: false,
    });
  };

  const closeModal = () => {
    setEditingUser(null);
    resetForm();
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
    }).format(value);

  const updateUser = async (
    user: AdminUserSummary,
    payload: Record<string, unknown>,
    successMessage: string,
  ) => {
    setPendingId(user.id);
    setFeedback(null);

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFeedback({
          type: "danger",
          message: data.message ?? "Não foi possível atualizar o usuário.",
        });
        return false;
      }

      setFeedback({ type: "success", message: successMessage });
      router.refresh();
      return true;
    } catch (error) {
      console.error("Failed to update user", error);
      setFeedback({
        type: "danger",
        message: "Não foi possível se comunicar com o servidor.",
      });
      return false;
    } finally {
      setPendingId(null);
    }
  };

  const toggleStatus = async (user: AdminUserSummary) => {
    const nextState = !user.isActive;
    await updateUser(
      user,
      { isActive: nextState },
      nextState ? "Usuário reativado." : "Usuário desativado.",
    );
  };

  const revokeSessions = async (user: AdminUserSummary) => {
    await updateUser(user, { revokeSessions: true }, "Sessões encerradas.");
  };

  const openEditModal = (user: AdminUserSummary) => {
    setEditingUser(user);
    setFormState({
      name: user.name,
      email: user.email,
      role: user.role,
      password: "",
      balance: user.balance.toFixed(2),
      isActive: user.isActive,
      revokeSessions: false,
    });
  };

  const handleFormChange = (
    field: keyof typeof formState,
    value: string | boolean,
  ) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const submitEdit = async () => {
    if (!editingUser) {
      return;
    }

    const payload: Record<string, unknown> = {
      role: formState.role,
      isActive: formState.isActive,
    };

    const trimmedName = formState.name.trim();
    if (trimmedName.length > 0) {
      payload.name = trimmedName;
    }

    const trimmedEmail = formState.email.trim();
    if (trimmedEmail.length > 0) {
      payload.email = trimmedEmail;
    }

    const parsedBalance = Number.parseFloat(
      formState.balance.replace(/,/g, "."),
    );
    if (!Number.isNaN(parsedBalance)) {
      payload.balance = parsedBalance;
    }

    if (formState.password.trim().length > 0) {
      payload.password = formState.password.trim();
    }

    if (formState.revokeSessions) {
      payload.revokeSessions = true;
    }

    const success = await updateUser(
      editingUser,
      payload,
      "Dados do usuário atualizados.",
    );

    if (success) {
      closeModal();
    }
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
        <Card.Header>
          <div className="d-flex flex-column flex-lg-row justify-content-between gap-2 align-items-lg-center">
            <div>
              <h2 className="mb-1">Usuários cadastrados</h2>
              <p className="mb-0 text-secondary">
                Gerencie o status das contas e encerre sessões ativas diretamente pelo painel.
              </p>
            </div>
          </div>
        </Card.Header>
        <Card.Body className="p-0">
          <div className="table-responsive">
            <Table hover className="align-middle mb-0">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th>Status</th>
                  <th>Saldo</th>
                  <th>Sessões</th>
                  <th className="text-end">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-secondary py-4">
                      Nenhum usuário cadastrado no momento.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.name}</strong>
                      </td>
                      <td>
                        <span className="text-secondary">{user.email}</span>
                      </td>
                      <td>
                        <span className="badge bg-light text-dark text-uppercase">{user.role}</span>
                      </td>
                      <td>
                        <Badge bg={user.isActive ? "success" : "secondary"}>
                          {user.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td>{formatCurrency(user.balance)}</td>
                      <td>{user.activeSessions}</td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-2">
                          <Button
                            size="sm"
                            variant="outline-primary"
                            onClick={() => openEditModal(user)}
                          >
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant={user.isActive ? "outline-secondary" : "outline-success"}
                            onClick={() => toggleStatus(user)}
                            disabled={pendingId === user.id}
                          >
                            {pendingId === user.id
                              ? "Atualizando..."
                              : user.isActive
                                ? "Desativar"
                                : "Reativar"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline-primary"
                            onClick={() => revokeSessions(user)}
                            disabled={pendingId === user.id}
                          >
                            {pendingId === user.id ? "Processando..." : "Encerrar sessões"}
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

      <Modal show={Boolean(editingUser)} onHide={closeModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>Editar usuário</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group controlId="editUserName">
                  <Form.Label>Nome</Form.Label>
                  <Form.Control
                    type="text"
                    value={formState.name}
                    onChange={(event) => handleFormChange("name", event.target.value)}
                    placeholder="Nome completo"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group controlId="editUserEmail">
                  <Form.Label>E-mail</Form.Label>
                  <Form.Control
                    type="email"
                    value={formState.email}
                    onChange={(event) => handleFormChange("email", event.target.value)}
                    placeholder="usuario@exemplo.com"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group controlId="editUserRole">
                  <Form.Label>Perfil</Form.Label>
                  <Form.Select
                    value={formState.role}
                    onChange={(event) =>
                      handleFormChange("role", event.target.value as "admin" | "user")
                    }
                  >
                    <option value="user">Usuário</option>
                    <option value="admin">Administrador</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group controlId="editUserBalance">
                  <Form.Label>Saldo (R$)</Form.Label>
                  <Form.Control
                    type="number"
                    min="0"
                    step="0.01"
                    value={formState.balance}
                    onChange={(event) => handleFormChange("balance", event.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group controlId="editUserPassword">
                  <Form.Label>Senha</Form.Label>
                  <Form.Control
                    type="password"
                    value={formState.password}
                    autoComplete="new-password"
                    onChange={(event) => handleFormChange("password", event.target.value)}
                    placeholder="Deixe em branco para manter"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group controlId="editUserStatus">
                  <Form.Label>Status</Form.Label>
                  <Form.Select
                    value={formState.isActive ? "active" : "inactive"}
                    onChange={(event) =>
                      handleFormChange("isActive", event.target.value === "active")
                    }
                  >
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col xs={12}>
                <Form.Check
                  type="switch"
                  id="editUserRevokeSessions"
                  label="Encerrar sessões ativas"
                  checked={formState.revokeSessions}
                  onChange={(event) => handleFormChange("revokeSessions", event.target.checked)}
                />
              </Col>
            </Row>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={closeModal}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={submitEdit}
            disabled={editingUser ? pendingId === editingUser.id : false}
          >
            {editingUser && pendingId === editingUser.id ? "Salvando..." : "Salvar alterações"}
          </Button>
        </Modal.Footer>
      </Modal>
    </section>
  );
};

export default AdminUserManager;
