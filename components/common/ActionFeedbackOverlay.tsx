"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Card, Table } from "react-bootstrap";

export type ActionFeedbackDetails = Record<string, string | null | undefined>;

export type ActionFeedback = {
  type: "success" | "danger";
  message: string;
  details?: ActionFeedbackDetails;
};

type Props = {
  feedback: ActionFeedback | null;
  onClose: () => void;
  autoHideMs?: number;
};

const DEFAULT_TIMEOUT = 6000;

const ActionFeedbackOverlay = ({ feedback, onClose, autoHideMs = DEFAULT_TIMEOUT }: Props) => {
  const [remainingMs, setRemainingMs] = useState(autoHideMs);
  const [isMounted, setIsMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    setRemainingMs(autoHideMs);

    const endTime = Date.now() + autoHideMs;

    const intervalId = window.setInterval(() => {
      const remaining = Math.max(0, endTime - Date.now());
      setRemainingMs(remaining);

      if (remaining <= 0) {
        window.clearInterval(intervalId);
        onClose();
      }
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [autoHideMs, feedback, onClose]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 575.98px)");

    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(event.matches);
    };

    handleChange(mediaQuery);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  const remainingSeconds = useMemo(() => Math.ceil(remainingMs / 1000), [remainingMs]);

  if (!isMounted || !feedback) {
    return null;
  }

  const variantClass = feedback.type === "success" ? "bg-success" : "bg-danger";

  const detailsEntries = Object.entries(feedback.details ?? {}).filter(([, value]) => value !== undefined);

  return createPortal(
    <div
      className={`action-feedback-overlay ${
        isMobile ? "action-feedback-overlay--mobile" : "action-feedback-overlay--desktop"
      }`}
      role="alertdialog"
      aria-live="assertive"
      aria-atomic="true"
    >
      <Card
        className="shadow-lg action-feedback-overlay__card"
        border={feedback.type === "success" ? "success" : "danger"}
      >
        <Card.Header
          className={`d-flex justify-content-between align-items-start gap-3 text-white ${variantClass}`}
        >
          <div className="d-flex flex-column gap-1">
            <span className="fw-semibold">
              {feedback.type === "success" ? "Ação concluída" : "Atenção"}
            </span>
            <small className="text-white-50">Fechando em {remainingSeconds}s</small>
          </div>
          <Button
            type="button"
            variant="outline-light"
            size="sm"
            onClick={onClose}
            aria-label="Fechar mensagem de confirmação"
          >
            &times;
          </Button>
        </Card.Header>
        <Card.Body className="d-flex flex-column gap-3">
          <p className="mb-0 text-secondary">{feedback.message}</p>

          {detailsEntries.length > 0 ? (
            <div className="action-feedback-overlay__details">
              <h6 className="fw-semibold mb-2">Informações registradas</h6>
              <Table bordered size="sm" className="mb-0">
                <tbody>
                  {detailsEntries.map(([label, value]) => (
                    <tr key={label}>
                      <th scope="row" className="w-50 text-nowrap align-top">
                        {label}
                      </th>
                      <td className="text-break">
                        {value && String(value).trim().length > 0 ? (
                          value
                        ) : (
                          <span className="text-secondary">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : null}
        </Card.Body>
      </Card>
    </div>,
    document.body
  );
};

export default ActionFeedbackOverlay;
