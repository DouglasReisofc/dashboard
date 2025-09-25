"use client";

import { useCallback, useMemo, useState } from "react";
import SimpleBar from "simplebar-react";
import { ListGroup, Button, Modal, Offcanvas } from "react-bootstrap";

import Flex from "components/common/Flex";
import { IconCircleFilled } from "@tabler/icons-react";
import type { UserNotification } from "types/notifications";

interface NotificationProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: UserNotification[];
  onMarkAllRead: () => Promise<void>;
  onRefresh: () => Promise<void>;
}

const formatDate = (iso: string) => {
  try {
    const date = new Date(iso);
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(date);
  } catch {
    return iso;
  }
};

const NoficationList: React.FC<NotificationProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllRead,
  onRefresh,
}) => {
  const hasUnread = useMemo(
    () => notifications.some((notification) => !notification.isRead),
    [notifications],
  );

  const [selectedNotification, setSelectedNotification] = useState<UserNotification | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isMarkingRead, setIsMarkingRead] = useState(false);

  const handleNotificationClick = useCallback(
    async (notification: UserNotification) => {
      setSelectedNotification(notification);
      setIsDetailOpen(true);

      if (notification.isRead) {
        return;
      }

      setIsMarkingRead(true);
      try {
        await fetch("/api/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ notificationIds: [notification.id] }),
        });

        setSelectedNotification({ ...notification, isRead: true });
        await onRefresh();
      } catch (error) {
        console.error("Failed to mark notification as read", error);
      } finally {
        setIsMarkingRead(false);
      }
    },
    [onRefresh],
  );

  const handleDetailClose = useCallback(() => {
    setIsDetailOpen(false);
    setSelectedNotification(null);
  }, []);

  return (
    <>
      <Offcanvas placement="end" show={isOpen} onHide={onClose}>
        <div className="sticky-top bg-white">
          <Offcanvas.Header closeButton className="align-items-start gap-3">
            <Flex justifyContent="between" className="w-100">
              <div>
                <h5 className="mb-0">Notificações</h5>
                <small className="text-secondary">
                  Acompanhe novas vendas, recargas e comunicados importantes por aqui.
                </small>
              </div>
              <Button
                size="sm"
                variant="outline-primary"
                type="button"
                onClick={() => {
                  void onRefresh();
                }}
              >
                Atualizar
              </Button>
            </Flex>
          </Offcanvas.Header>
        </div>

        <div className="px-4 pb-4">
          <Button
            variant="ghost"
            className="w-100 mb-3"
            onClick={() => {
              void onMarkAllRead();
            }}
            disabled={!hasUnread}
            type="button"
          >
            Marcar todas como lidas
          </Button>

          <SimpleBar style={{ maxHeight: 480 }}>
            <ListGroup variant="flush" className="border rounded-3">
              {notifications.length === 0 ? (
                <ListGroup.Item className="py-5 text-center text-secondary">
                  Nenhuma notificação por aqui ainda.
                </ListGroup.Item>
              ) : (
                notifications.map((notification) => (
                  <ListGroup.Item
                    key={notification.id}
                    action
                    onClick={() => {
                      void handleNotificationClick(notification);
                    }}
                    className="py-4 px-4 border-bottom d-flex flex-column gap-2"
                  >
                    <Flex justifyContent="between" alignItems="center">
                      <div className="d-flex flex-column">
                        <strong className="text-truncate">{notification.title}</strong>
                        <small className="text-secondary">{formatDate(notification.createdAt)}</small>
                      </div>
                      {!notification.isRead && (
                        <IconCircleFilled size={10} className="text-primary" />
                      )}
                    </Flex>
                    <p className="mb-0 text-secondary" style={{ whiteSpace: "pre-line" }}>
                      {notification.message}
                    </p>
                  </ListGroup.Item>
                ))
              )}
            </ListGroup>
          </SimpleBar>
        </div>
      </Offcanvas>

      <Modal show={isDetailOpen && Boolean(selectedNotification)} onHide={handleDetailClose} centered>
        <Modal.Header closeButton>
          <Modal.Title>{selectedNotification?.title ?? "Notificação"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedNotification && (
            <div className="d-flex flex-column gap-3">
              <small className="text-secondary">
                Recebida em {formatDate(selectedNotification.createdAt)}
              </small>
              <p className="mb-0" style={{ whiteSpace: "pre-line" }}>
                {selectedNotification.message}
              </p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={handleDetailClose} disabled={isMarkingRead}>
            Fechar
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default NoficationList;
