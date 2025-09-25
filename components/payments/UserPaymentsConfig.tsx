"use client";

import { useMemo, useState } from "react";
import { Button, Card } from "react-bootstrap";

import type {
  MercadoPagoCheckoutConfig,
  MercadoPagoPixConfig,
  PaymentConfirmationMessageConfig,
} from "types/payments";

import MercadoPagoCheckoutForm from "./MercadoPagoCheckoutForm";
import MercadoPagoPixForm from "./MercadoPagoPixForm";
import PaymentConfirmationForm from "./PaymentConfirmationForm";

type ViewId = "pix" | "checkout" | "confirmation";

type ViewOption = {
  id: ViewId;
  label: string;
  description: string;
};

type PaymentsEndpoints = {
  pix?: string;
  checkout?: string;
  confirmation?: string;
};

type ViewOptionsOverride = Partial<Record<ViewId, Partial<ViewOption>>>;

interface UserPaymentsConfigProps {
  pixConfig: MercadoPagoPixConfig;
  checkoutConfig: MercadoPagoCheckoutConfig;
  confirmationConfig: PaymentConfirmationMessageConfig;
  endpoints?: PaymentsEndpoints;
  cardTitle?: string;
  cardDescription?: string;
  viewOptionsOverride?: ViewOptionsOverride;
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
  {
    id: "confirmation",
    label: "Mensagem de confirmação",
    description:
      "Defina a mensagem enviada automaticamente após a aprovação do pagamento, válida para todos os métodos.",
  },
];

const resolveInitialView = (
  pixConfig: MercadoPagoPixConfig,
  checkoutConfig: MercadoPagoCheckoutConfig,
): ViewId => {
  if (pixConfig.isConfigured || pixConfig.isActive) {
    return "pix";
  }

  if (checkoutConfig.isConfigured || checkoutConfig.isActive) {
    return "checkout";
  }

  return "confirmation";
};

const UserPaymentsConfig = ({
  pixConfig,
  checkoutConfig,
  confirmationConfig,
  endpoints,
  cardTitle,
  cardDescription,
  viewOptionsOverride,
}: UserPaymentsConfigProps) => {
  const [activeView, setActiveView] = useState<ViewId>(() => resolveInitialView(pixConfig, checkoutConfig));

  const options = useMemo(() => {
    if (!viewOptionsOverride) {
      return VIEW_OPTIONS;
    }

    return VIEW_OPTIONS.map((option) => {
      const override = viewOptionsOverride[option.id];
      if (!override) {
        return option;
      }

      return {
        ...option,
        ...override,
      };
    });
  }, [viewOptionsOverride]);

  const activeOption = useMemo(
    () => options.find((option) => option.id === activeView) ?? options[0],
    [activeView, options],
  );

  return (
    <div className="d-flex flex-column gap-4">
      <Card>
        <Card.Body>
          <Card.Title as="h2" className="h5">
            {cardTitle ?? "Integrações Mercado Pago"}
          </Card.Title>
          <Card.Text className="text-secondary mb-3">
            {cardDescription ??
              "Selecione abaixo qual modalidade deseja configurar para personalizar a experiência de pagamento do seu bot."}
          </Card.Text>

          <div className="d-flex flex-wrap gap-2">
            {options.map((option) => (
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

      {activeView === "pix" && (
        <MercadoPagoPixForm
          config={pixConfig}
          updatePath={endpoints?.pix}
        />
      )}
      {activeView === "checkout" && (
        <MercadoPagoCheckoutForm
          config={checkoutConfig}
          updatePath={endpoints?.checkout}
        />
      )}
      {activeView === "confirmation" && (
        <PaymentConfirmationForm
          config={confirmationConfig}
          updatePath={endpoints?.confirmation}
        />
      )}
    </div>
  );
};

export default UserPaymentsConfig;
