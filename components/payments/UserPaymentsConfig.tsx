"use client";

import { useMemo, useState } from "react";
import { Button, Card } from "react-bootstrap";

import type { MercadoPagoCheckoutConfig, MercadoPagoPixConfig } from "types/payments";

import MercadoPagoCheckoutForm from "./MercadoPagoCheckoutForm";
import MercadoPagoPixForm from "./MercadoPagoPixForm";

type ViewId = "pix" | "checkout";

type ViewOption = {
  id: ViewId;
  label: string;
  description: string;
};

interface UserPaymentsConfigProps {
  pixConfig: MercadoPagoPixConfig;
  checkoutConfig: MercadoPagoCheckoutConfig;
}

const VIEW_OPTIONS: readonly ViewOption[] = [
  {
    id: "pix",
    label: "Mercado Pago Pix",
    description:
      "Gere QR Codes e códigos copia e cola diretamente para o bot responder automaticamente os clientes.",
  },
  {
    id: "checkout",
    label: "Mercado Pago Checkout",
    description:
      "Use o checkout transparente do Mercado Pago para aceitar cartões, Pix e boleto em páginas externas.",
  },
];

const resolveInitialView = (pixConfig: MercadoPagoPixConfig, checkoutConfig: MercadoPagoCheckoutConfig): ViewId => {
  if (pixConfig.isConfigured || pixConfig.isActive) {
    return "pix";
  }

  if (checkoutConfig.isConfigured || checkoutConfig.isActive) {
    return "checkout";
  }

  return "pix";
};

const UserPaymentsConfig = ({ pixConfig, checkoutConfig }: UserPaymentsConfigProps) => {
  const [activeView, setActiveView] = useState<ViewId>(() => resolveInitialView(pixConfig, checkoutConfig));

  const activeOption = useMemo(
    () => VIEW_OPTIONS.find((option) => option.id === activeView) ?? VIEW_OPTIONS[0],
    [activeView],
  );

  return (
    <div className="d-flex flex-column gap-4">
      <Card>
        <Card.Body>
          <Card.Title as="h2" className="h5">
            Integrações Mercado Pago
          </Card.Title>
          <Card.Text className="text-secondary mb-3">
            Selecione abaixo qual modalidade deseja configurar para personalizar a experiência de pagamento do seu bot.
          </Card.Text>

          <div className="d-flex flex-wrap gap-2">
            {VIEW_OPTIONS.map((option) => (
              <Button
                key={option.id}
                variant={activeView === option.id ? "primary" : "outline-primary"}
                onClick={() => setActiveView(option.id)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          <Card.Text className="text-secondary mb-0 mt-3">{activeOption.description}</Card.Text>
        </Card.Body>
      </Card>

      {activeView === "pix" ? (
        <MercadoPagoPixForm config={pixConfig} />
      ) : (
        <MercadoPagoCheckoutForm config={checkoutConfig} />
      )}
    </div>
  );
};

export default UserPaymentsConfig;
