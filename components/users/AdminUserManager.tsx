"use client";

import { useState } from "react";
import { Alert, Badge, Button, Card, Table } from "react-bootstrap";
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

  const updateUser = async (
    user: AdminUserSummary,
    payload: Partial<{ isActive: boolean; revokeSessions: boolean }>,
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
        return;
      }

      setFeedback({ type: "success", message: successMessage });
      router.refresh();
    } catch (error) {
      console.error("Failed to update user", error);
      setFeedback({
        type: "danger",
        message: "Não foi possível se comunicar com o servidor.",
      });
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
                  <th>Sessões</th>
                  <th className="text-end">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-secondary py-4">
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
                      <td>{user.activeSessions}</td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-2">
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
    </section>
  );
};

export default AdminUserManager;
