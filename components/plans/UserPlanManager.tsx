"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, Card, Col, Form, Row, Modal } from "react-bootstrap";

import type { PlanCheckoutResponse, SubscriptionPlan, UserPlanStatus } from "types/plans";

interface UserPlanManagerProps {
  plans: SubscriptionPlan[];
  status: UserPlanStatus;
  userName: string;
  userEmail: string;
  balance: number;
}

type Feedback = { type: "success" | "danger"; message: string } | null;

type PendingCheckout = PlanCheckoutResponse & {
  plan: SubscriptionPlan;
};

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDateTime = (value: string | null) => {
  if (!value) {
    return null;
  }
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const getStatusBadgeVariant = (status: UserPlanStatus["status"]) => {
  switch (status) {
    case "active":
      return "success";
    case "pending":
      return "warning";
    case "expired":
      return "danger";
    default:
      return "secondary";
  }
};

const UserPlanManager = ({ plans, status, userName, userEmail, balance }: UserPlanManagerProps) => {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingPlanCheckout, setPendingPlanCheckout] = useState<PendingCheckout | null>(null);
  const [pendingTopUpCheckout, setPendingTopUpCheckout] = useState<PlanCheckoutResponse | null>(null);
  const [pendingTopUpAmount, setPendingTopUpAmount] = useState<number | null>(null);
  const [planProvider, setPlanProvider] = useState<'mercadopago_pix' | 'mercadopago_checkout'>('mercadopago_pix');
  const [topUpProvider, setTopUpProvider] = useState<'mercadopago_pix' | 'mercadopago_checkout'>('mercadopago_pix');
  const [topUpAmount, setTopUpAmount] = useState('50');
  const [currentBalance, setCurrentBalance] = useState(balance);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);

  const copyToClipboard = async (text: string, success: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setFeedback({ type: 'success', message: success });
    } catch {
      setFeedback({ type: 'danger', message: 'Não foi possível copiar para a área de transferência.' });
    }
  };

  const activePlan = status.plan && status.status === "active" ? status.plan : null;
  const activeUntil = formatDateTime(status.currentPeriodEnd);
  const daysRemainingLabel = status.daysRemaining !== null ? `${status.daysRemaining} dia(s)` : null;

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => a.price - b.price),
    [plans],
  );

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    setIsProcessing(true);
    setFeedback(null);
    setPendingPlanCheckout(null);

    try {
      const response = await fetch("/api/user/plan/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planId: plan.id, provider: planProvider }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFeedback({
          type: "danger",
          message: data.message ?? "Não foi possível gerar o pagamento do plano.",
        });
        setIsProcessing(false);
        return;
      }

      const checkout: PlanCheckoutResponse | undefined = data.checkout;
      if (!checkout) {
        setFeedback({
          type: "danger",
          message: "Resposta inesperada do servidor.",
        });
        setIsProcessing(false);
        return;
      }

      const nextCheckout = {
        ...checkout,
        plan,
      } as PendingCheckout;
      setPendingPlanCheckout(nextCheckout);

      setFeedback({
        type: "success",
        message: "Pagamento criado com sucesso. A confirmação é automática após o pagamento.",
      });
      setShowPlanModal(true);
    } catch (error) {
      console.error("Failed to create plan checkout", error);
      setFeedback({
        type: "danger",
        message: "Falha inesperada ao iniciar a assinatura. Tente novamente em instantes.",
      });
    }

    setIsProcessing(false);
  };

  const handleRefresh = async () => {
    setIsProcessing(true);
    await router.refresh();
    setIsProcessing(false);
  };

  useEffect(() => {
    if (status.status === "active" && pendingPlanCheckout) {
      setPendingPlanCheckout(null);
      setShowPlanModal(false);
      setConfirmationMessage(null);
    }
  }, [status.status, pendingPlanCheckout]);

  useEffect(() => {
    setCurrentBalance((previous) => {
      const next = balance;
      if (pendingTopUpCheckout && next > previous) {
        setPendingTopUpCheckout(null);
        setPendingTopUpAmount(null);
        setShowTopUpModal(false);
      }
      return next;
    });
  }, [balance, pendingTopUpCheckout]);

  const handlePayWithBalance = async (plan: SubscriptionPlan) => {
    setIsProcessing(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/user/plan/pay-with-balance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planId: plan.id }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFeedback({
          type: "danger",
          message: data.message ?? "Não foi possível ativar o plano com o saldo disponível.",
        });
        setIsProcessing(false);
        return;
      }

      setCurrentBalance(typeof data.balance === "number" ? data.balance : currentBalance);
      setConfirmationMessage(data.message ?? "Plano ativado com sucesso usando o saldo.");
      setShowPlanModal(true);
      await router.refresh();
    } catch (error) {
      console.error("Failed to pay plan with balance", error);
      setFeedback({
        type: "danger",
        message: "Não foi possível ativar o plano com o saldo disponível.",
      });
    }

    setIsProcessing(false);
  };

  const parsedTopUpAmount = useMemo(() => {
    const value = Number.parseFloat(topUpAmount.replace(/,/g, "."));
    return Number.isFinite(value) ? Math.max(value, 0) : 0;
  }, [topUpAmount]);

  const handleTopUp = async () => {
    if (parsedTopUpAmount <= 0) {
      setFeedback({ type: "danger", message: "Informe um valor válido para adicionar saldo." });
      return;
    }

    setIsProcessing(true);
    setFeedback(null);
    setPendingTopUpCheckout(null);

    try {
      const response = await fetch("/api/user/balance/topup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount: parsedTopUpAmount, provider: topUpProvider }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFeedback({
          type: "danger",
          message: data.message ?? "Não foi possível gerar o pagamento de saldo.",
        });
        setIsProcessing(false);
        return;
      }

      const checkout: PlanCheckoutResponse | undefined = data.checkout;
      if (!checkout) {
        setFeedback({
          type: "danger",
          message: "Resposta inesperada do servidor.",
        });
        setIsProcessing(false);
        return;
      }

      setPendingTopUpCheckout(checkout);
      setPendingTopUpAmount(parsedTopUpAmount);
      setShowTopUpModal(true);
    } catch (error) {
      console.error("Failed to create balance top-up", error);
      setFeedback({
        type: "danger",
        message: "Não foi possível gerar o pagamento de saldo.",
      });
    }

    setIsProcessing(false);
  };

  const renderCurrentPlan = () => (
    <Card className="mb-4">
      <Card.Body>
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
          <div>
            <Card.Title as="h2" className="h5 mb-1">
              Status da assinatura
            </Card.Title>
            {activePlan ? (
              <div className="text-secondary">
                <div>
                  Plano <strong>{activePlan.name}</strong> ativo.
                </div>
                <div>
                  Expira em {activeUntil} {daysRemainingLabel ? `(${daysRemainingLabel} restantes)` : null}
                </div>
              </div>
            ) : (
              <div className="text-secondary">
                Nenhum plano ativo no momento. Escolha uma opção abaixo para liberar todos os recursos do painel.
              </div>
            )}
          </div>
          <Badge bg={getStatusBadgeVariant(status.status)} className="px-3 py-2">
            {status.status === "active"
              ? "Plano ativo"
              : status.status === "pending"
                ? "Pagamento pendente"
                : status.status === "expired"
                  ? "Plano expirado"
                  : "Sem plano"}
          </Badge>
        </div>

        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mt-3">
          <div>
            <span className="text-secondary d-block">Saldo disponível</span>
            <strong className="fs-4">R$ {formatCurrency(currentBalance)}</strong>
          </div>
          <div className="d-flex gap-2">
            <Button variant="outline-primary" onClick={handleRefresh} disabled={isProcessing}>
              Atualizar status
            </Button>
            {pendingPlanCheckout && (
              <Button
                variant="outline-secondary"
                onClick={() => setPendingPlanCheckout(null)}
                disabled={isProcessing}
              >
                Limpar boleto gerado
              </Button>
            )}
          </div>
        </div>
      </Card.Body>
    </Card>
  );

  const renderPlans = () => (
    sortedPlans.length === 0 ? (
      <Alert variant="info">Nenhum plano disponível no momento. Fale com o administrador para configurar as opções.</Alert>
    ) : (
      <Row className="g-4">
        {sortedPlans.map((plan) => (
          <Col md={6} key={plan.id}>
            <Card className={plan.id === activePlan?.id ? "border-primary" : ""}>
            <Card.Body className="d-flex flex-column gap-3">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <Card.Title as="h3" className="h5 mb-1">
                    {plan.name}
                  </Card.Title>
                  <Card.Subtitle className="text-secondary small">
                    {plan.description ?? "Assinatura do StoreBot"}
                  </Card.Subtitle>
                </div>
                {plan.id === activePlan?.id && <Badge bg="primary">Plano atual</Badge>}
              </div>
              <div>
                <span className="display-6">R$ {formatCurrency(plan.price)}</span>
                <span className="text-secondary"> / {plan.durationDays} dias</span>
              </div>
              <ul className="mb-0 text-secondary small">
                <li>
                  {plan.categoryLimit === 0
                    ? "Categorias ilimitadas"
                    : `Até ${plan.categoryLimit} categorias cadastradas`}
                </li>
                <li>Renovação manual após o período contratado</li>
              </ul>
              <div className="d-flex flex-column gap-2">
                <Form.Select
                  value={planProvider}
                  onChange={(event) =>
                    setPlanProvider(event.target.value as 'mercadopago_pix' | 'mercadopago_checkout')
                  }
                  className="w-auto"
                >
                  <option value="mercadopago_pix">Pagar com Pix</option>
                  <option value="mercadopago_checkout">Pagar com checkout (cartão/Pix)</option>
                </Form.Select>
                <Button
                  variant="primary"
                  onClick={() => handleSubscribe(plan)}
                  disabled={isProcessing}
                >
                  {plan.id === activePlan?.id ? "Renovar plano" : "Assinar plano"}
                </Button>
                {plan.price <= currentBalance && (
                  <Button
                    variant="outline-success"
                    onClick={() => handlePayWithBalance(plan)}
                    disabled={isProcessing}
                  >
                    Pagar com saldo
                  </Button>
                )}
              </div>
            </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
    )
  );

  const renderCheckoutDetails = () => {
    if (!pendingPlanCheckout) {
      return null;
    }

    const expiresAt = formatDateTime(pendingPlanCheckout.expiresAt);

    return (
      <Card className="mt-4">
        <Card.Body>
          <Card.Title as="h3" className="h5 mb-3">
            Pagamento pendente
          </Card.Title>
          <p className="text-secondary">
            Conclua o pagamento do plano <strong>{pendingPlanCheckout.plan.name}</strong> no valor de R$
            {` ${formatCurrency(pendingPlanCheckout.plan.price)}`}.
            Assim que o Mercado Pago confirmar, o plano será liberado automaticamente e você receberá um e-mail de confirmação.
          </p>

          {pendingPlanCheckout.qrCodeBase64 && (
            <div className="d-flex flex-column flex-md-row align-items-center gap-4">
              <Image
                src={`data:image/png;base64,${pendingPlanCheckout.qrCodeBase64}`}
                alt="QR Code Pix"
                width={220}
                height={220}
              />
              <div className="d-flex flex-column gap-2 w-100">
                {pendingPlanCheckout.qrCode && (
                  <Form.Group>
                    <Form.Label>Copie o código Pix</Form.Label>
                    <Form.Control as="textarea" rows={4} readOnly value={pendingPlanCheckout.qrCode} />
                  </Form.Group>
                )}
                <div className="text-secondary small">
                  {expiresAt ? `Expira em ${expiresAt}. ` : ""}
                  A confirmação ocorre automaticamente após o pagamento.
                </div>
                <div className="d-flex gap-2">
                  <Button
                    variant="primary"
                    onClick={() => copyToClipboard(pendingPlanCheckout.qrCode ?? '', 'Código Pix copiado.')}
                    disabled={!pendingPlanCheckout.qrCode}
                  >
                    Copiar código Pix
                  </Button>
                  {pendingPlanCheckout.ticketUrl && (
                    <Button variant="outline-secondary" href={pendingPlanCheckout.ticketUrl} target="_blank">
                      Abrir link de pagamento
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {!pendingPlanCheckout.qrCodeBase64 && pendingPlanCheckout.ticketUrl && (
            <div className="d-flex flex-column gap-3">
              <div className="text-secondary small">
                Abra o link abaixo para finalizar o pagamento. A confirmação é automática.
              </div>
              <div className="d-flex gap-2">
                <Button variant="primary" href={pendingPlanCheckout.ticketUrl} target="_blank">
                  Abrir link de pagamento
                </Button>
                <Button
                  variant="outline-secondary"
                  onClick={() => copyToClipboard(pendingPlanCheckout.ticketUrl!, 'Link copiado.')}
                >
                  Copiar link
                </Button>
              </div>
            </div>
          )}
        </Card.Body>
      </Card>
    );
  };

  const renderTopUpSection = () => (
    <Card className="mt-4">
      <Card.Body>
        <Card.Title as="h3" className="h5 mb-3">
          Adicionar saldo
        </Card.Title>
        <Form onSubmit={(event) => { event.preventDefault(); handleTopUp(); }}>
          <div className="row g-3 align-items-end">
            <div className="col-sm-6 col-lg-4">
              <Form.Group controlId="topUpAmount">
                <Form.Label>Valor</Form.Label>
                <Form.Control
                  type="number"
                  min={1}
                  step="0.01"
                  value={topUpAmount}
                  onChange={(event) => setTopUpAmount(event.target.value)}
                  required
                />
              </Form.Group>
            </div>
            <div className="col-sm-6 col-lg-4">
              <Form.Group controlId="topUpProvider">
                <Form.Label>Forma de pagamento</Form.Label>
                <Form.Select
                  value={topUpProvider}
                  onChange={(event) => setTopUpProvider(event.target.value as 'mercadopago_pix' | 'mercadopago_checkout')}
                >
                  <option value="mercadopago_pix">Pix</option>
                  <option value="mercadopago_checkout">Checkout (cartão/Pix)</option>
                </Form.Select>
              </Form.Group>
            </div>
            <div className="col-lg-4 d-flex">
              <Button
                variant="outline-primary"
                className="ms-auto"
                type="submit"
                disabled={isProcessing}
              >
                Gerar pagamento de saldo
              </Button>
            </div>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );

  const renderTopUpCheckoutDetails = () => {
    if (!pendingTopUpCheckout) {
      return null;
    }

    const expiresAt = formatDateTime(pendingTopUpCheckout.expiresAt);

    return (
      <Card className="mt-3">
        <Card.Body>
          <Card.Title as="h3" className="h5 mb-3">
            Pagamento de saldo pendente
          </Card.Title>
          <p className="text-secondary">
            Conclua o pagamento de <strong>R$ {formatCurrency(pendingTopUpAmount ?? pendingTopUpCheckout.amount)}</strong> para adicionar saldo à sua conta.
          </p>

          {pendingTopUpCheckout.qrCodeBase64 && (
            <div className="d-flex flex-column flex-md-row align-items-center gap-4">
              <Image
                src={`data:image/png;base64,${pendingTopUpCheckout.qrCodeBase64}`}
                alt="QR Code Pix"
                width={220}
                height={220}
              />
              <div className="d-flex flex-column gap-2 w-100">
                {pendingTopUpCheckout.qrCode && (
                  <Form.Group>
                    <Form.Label>Copie o código Pix</Form.Label>
                    <Form.Control as="textarea" rows={4} readOnly value={pendingTopUpCheckout.qrCode} />
                  </Form.Group>
                )}
                <div className="text-secondary small">
                  {expiresAt ? `Expira em ${expiresAt}. ` : ""}
                  A confirmação do pagamento e crédito do saldo é automática.
                </div>
                <div className="d-flex gap-2">
                  <Button
                    variant="primary"
                    onClick={() => copyToClipboard(pendingTopUpCheckout.qrCode ?? '', 'Código Pix copiado.')}
                    disabled={!pendingTopUpCheckout.qrCode}
                  >
                    Copiar código Pix
                  </Button>
                  {pendingTopUpCheckout.ticketUrl && (
                    <Button variant="outline-secondary" href={pendingTopUpCheckout.ticketUrl} target="_blank">
                      Abrir link de pagamento
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {!pendingTopUpCheckout.qrCodeBase64 && pendingTopUpCheckout.ticketUrl && (
            <div className="d-flex flex-column gap-3">
              <div className="text-secondary small">
                Abra o link abaixo para pagar. O saldo será creditado automaticamente após a confirmação.
              </div>
              <div className="d-flex gap-2">
                <Button variant="primary" href={pendingTopUpCheckout.ticketUrl} target="_blank">
                  Abrir link de pagamento
                </Button>
                <Button
                  variant="outline-secondary"
                  onClick={() => copyToClipboard(pendingTopUpCheckout.ticketUrl!, 'Link copiado.')}
                >
                  Copiar link
                </Button>
              </div>
            </div>
          )}
        </Card.Body>
      </Card>
    );
  };

  const closePlanModal = () => {
    setShowPlanModal(false);
    setConfirmationMessage(null);
  };

  const closeTopUpModal = () => {
    setShowTopUpModal(false);
  };

  return (
    <div className="d-flex flex-column gap-4">
      {renderCurrentPlan()}

      {feedback && (
        <Alert variant={feedback.type} onClose={() => setFeedback(null)} dismissible>
          {feedback.message}
        </Alert>
      )}

      {renderPlans()}
      {renderCheckoutDetails()}
      {renderTopUpSection()}
      {renderTopUpCheckoutDetails()}

      <Card className="mt-4">
        <Card.Body>
          <Card.Title as="h3" className="h6">
            Dados do titular
          </Card.Title>
          <p className="text-secondary mb-0">
            Assinatura vinculada a <strong>{userName}</strong> ({userEmail}). Mantenha esses dados atualizados para evitar divergências nos pagamentos.
          </p>
        </Card.Body>
      </Card>

      <Modal show={showPlanModal} onHide={closePlanModal} centered size="lg">
        <Modal.Header closeButton={!isProcessing}>
          <Modal.Title>Pagamento do plano</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {confirmationMessage && (
            <Alert variant="success" className="mb-4">
              {confirmationMessage}
            </Alert>
          )}

          {pendingPlanCheckout && (
            <div className="d-flex flex-column gap-3">
              <div className="text-secondary">
                Conclua o pagamento do plano <strong>{pendingPlanCheckout.plan.name}</strong> no valor de R$
                {` ${formatCurrency(pendingPlanCheckout.plan.price)}`}.
              </div>
              {pendingPlanCheckout.qrCodeBase64 && (
                <div className="d-flex flex-column flex-md-row align-items-center gap-4">
                  <Image
                    src={`data:image/png;base64,${pendingPlanCheckout.qrCodeBase64}`}
                    alt="QR Code Pix"
                    width={220}
                    height={220}
                  />
                  <div className="d-flex flex-column gap-2 w-100">
                    {pendingPlanCheckout.qrCode && (
                      <Form.Group>
                        <Form.Label>Copie o código Pix</Form.Label>
                        <Form.Control as="textarea" rows={4} readOnly value={pendingPlanCheckout.qrCode} />
                      </Form.Group>
                    )}
                    <div className="text-secondary small">
                      {formatDateTime(pendingPlanCheckout.expiresAt)
                        ? `Expira em ${formatDateTime(pendingPlanCheckout.expiresAt)}. `
                        : ""}
                      A confirmação ocorre automaticamente após o pagamento.
                    </div>
                    <div className="d-flex gap-2">
                      <Button
                        variant="primary"
                        onClick={() => copyToClipboard(pendingPlanCheckout.qrCode ?? '', 'Código Pix copiado.')}
                        disabled={!pendingPlanCheckout.qrCode}
                      >
                        Copiar código Pix
                      </Button>
                      {pendingPlanCheckout.ticketUrl && (
                        <Button variant="outline-secondary" href={pendingPlanCheckout.ticketUrl} target="_blank">
                          Abrir link de pagamento
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {!pendingPlanCheckout.qrCodeBase64 && pendingPlanCheckout.ticketUrl && (
                <div className="d-flex flex-column gap-3">
                  <div className="text-secondary small">
                    Abra o link abaixo para finalizar o pagamento. A confirmação é automática.
                  </div>
                  <div className="d-flex gap-2">
                    <Button variant="primary" href={pendingPlanCheckout.ticketUrl} target="_blank">
                      Abrir link de pagamento
                    </Button>
                    <Button
                      variant="outline-secondary"
                      onClick={() => copyToClipboard(pendingPlanCheckout.ticketUrl!, 'Link copiado.')}
                    >
                      Copiar link
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={closePlanModal} disabled={isProcessing}>
            Fechar
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showTopUpModal} onHide={closeTopUpModal} centered size="lg">
        <Modal.Header closeButton={!isProcessing}>
          <Modal.Title>Pagamento de saldo</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {pendingTopUpCheckout && (
            <div className="d-flex flex-column gap-3">
              <div className="text-secondary">
                Conclua o pagamento de <strong>R$ {formatCurrency(pendingTopUpAmount ?? pendingTopUpCheckout.amount)}</strong> para adicionar saldo à sua conta.
              </div>
              {pendingTopUpCheckout.qrCodeBase64 && (
                <div className="d-flex flex-column flex-md-row align-items-center gap-4">
                  <Image
                    src={`data:image/png;base64,${pendingTopUpCheckout.qrCodeBase64}`}
                    alt="QR Code Pix"
                    width={220}
                    height={220}
                  />
                  <div className="d-flex flex-column gap-2 w-100">
                    {pendingTopUpCheckout.qrCode && (
                      <Form.Group>
                        <Form.Label>Copie o código Pix</Form.Label>
                        <Form.Control as="textarea" rows={4} readOnly value={pendingTopUpCheckout.qrCode} />
                      </Form.Group>
                    )}
                    <div className="text-secondary small">
                      {formatDateTime(pendingTopUpCheckout.expiresAt)
                        ? `Expira em ${formatDateTime(pendingTopUpCheckout.expiresAt)}. `
                        : ""}
                      A confirmação do pagamento e crédito do saldo é automática.
                    </div>
                    <div className="d-flex gap-2">
                      <Button
                        variant="primary"
                        onClick={() => copyToClipboard(pendingTopUpCheckout.qrCode ?? '', 'Código Pix copiado.')}
                        disabled={!pendingTopUpCheckout.qrCode}
                      >
                        Copiar código Pix
                      </Button>
                      {pendingTopUpCheckout.ticketUrl && (
                        <Button variant="outline-secondary" href={pendingTopUpCheckout.ticketUrl} target="_blank">
                          Abrir link de pagamento
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {!pendingTopUpCheckout.qrCodeBase64 && pendingTopUpCheckout.ticketUrl && (
                <div className="d-flex flex-column gap-3">
                  <div className="text-secondary small">
                    Abra o link abaixo para pagar. O saldo será creditado automaticamente após a confirmação.
                  </div>
                  <div className="d-flex gap-2">
                    <Button variant="primary" href={pendingTopUpCheckout.ticketUrl} target="_blank">
                      Abrir link de pagamento
                    </Button>
                    <Button
                      variant="outline-secondary"
                      onClick={() => copyToClipboard(pendingTopUpCheckout.ticketUrl!, 'Link copiado.')}
                    >
                      Copiar link
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={closeTopUpModal} disabled={isProcessing}>
            Fechar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default UserPlanManager;
