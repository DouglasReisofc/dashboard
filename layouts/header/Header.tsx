"use client";
//import node module libraries
import React, { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useMediaQuery } from "react-responsive";
import { IconArrowBarLeft, IconArrowBarRight, IconBell, IconMenu2 } from "@tabler/icons-react";
import { Container, ListGroup, Navbar, Button } from "react-bootstrap";

//import custom components
import UserMenu from "./UserMenu";
import Flex from "components/common/Flex";
import NoficationList from "components/common/NoficationList";
import OffcanvasSidebar from "layouts/OffcanvasSidebar";

//import custom hooks
import useMenu from "hooks/useMenu";

import type { SessionUser } from "types/auth";
import type { UserNotification } from "types/notifications";

interface HeaderProps {
  user: SessionUser;
  siteSettings?: {
    siteName: string;
  };
}

const Header: React.FC<HeaderProps> = ({ user, siteSettings }) => {
  const [isNoficationOpen, setIsNotificationOpen] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { toggleMenuHandler, handleCollapsed } = useMenu();

  const isTablet = useMediaQuery({ maxWidth: 990 });

  const loadNotifications = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", {
        method: "GET",
        headers: {
          "Cache-Control": "no-store",
        },
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      setUnreadCount(typeof data.unreadCount === "number" ? data.unreadCount : 0);
    } catch {
      // ignore errors silently for header badge
    }
  }, []);

  const handleOpenNotifications = useCallback(async () => {
    await loadNotifications();
    setIsNotificationOpen(true);
  }, [loadNotifications]);

  const handleMarkAllRead = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notificationIds: "all" }),
      });

      if (!response.ok) {
        return;
      }

      await loadNotifications();
    } catch {
      // ignore temporary errors
    }
  }, [loadNotifications]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const handler = () => {
      loadNotifications();
    };

    window.addEventListener("support:new-inbound", handler);
    window.addEventListener("purchase:created", handler as EventListener);
    window.addEventListener("notification:created", handler as EventListener);
    return () => {
      window.removeEventListener("support:new-inbound", handler);
      window.removeEventListener("purchase:created", handler as EventListener);
      window.removeEventListener("notification:created", handler as EventListener);
    };
  }, [loadNotifications]);

  return (
    <Fragment>
      <Navbar expand="lg" className="navbar-glass px-0 px-lg-4">
        <Container fluid className="px-lg-0">
          <Flex alignItems="center" className="gap-4">
            {isTablet && (
              <div
                className="d-block d-lg-none"
                style={{ cursor: "pointer" }}
                onClick={() => toggleMenuHandler(true)}
              >
                <IconMenu2 size={24} />
              </div>
            )}
            {isTablet || (
              <div>
                <Link href={"#"} className="sidebar-toggle d-flex p-3">
                  <span
                    className="collapse-mini"
                    onClick={() => handleCollapsed("expanded")}
                  >
                    <IconArrowBarLeft
                      size={20}
                      strokeWidth={1.5}
                      className="text-secondary"
                    />
                  </span>
                  <span
                    className="collapse-expanded"
                    onClick={() => handleCollapsed("collapsed")}
                  >
                    <IconArrowBarRight
                      size={20}
                      strokeWidth={1.5}
                      className="text-secondary"
                    />
                  </span>
                </Link>
              </div>
            )}
            {!isTablet && siteSettings?.siteName && (
              <span className="fw-semibold text-secondary ms-2 d-none d-lg-inline">
                {siteSettings.siteName}
              </span>
            )}
          </Flex>
          <ListGroup
            bsPrefix="list-unstyled"
            as={"ul"}
            className="d-flex align-items-center mb-0 gap-2"
          >
           <ListGroup.Item as="li">
             <Button
                variant="ghost"
                className="position-relative btn-icon rounded-circle"
                onClick={handleOpenNotifications}
              >
                <IconBell size={20} />
                {unreadCount > 0 && (
                  <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger mt-2 ms-n2">
                    {unreadCount}
                    <span className="visually-hidden">notificações não lidas</span>
                  </span>
                )}
              </Button>
            </ListGroup.Item>
            <ListGroup.Item as="li">
              <UserMenu user={user} />
            </ListGroup.Item>
          </ListGroup>
        </Container>
      </Navbar>
      <NoficationList
        isOpen={isNoficationOpen}
        onClose={() => setIsNotificationOpen(false)}
        notifications={notifications}
        onMarkAllRead={handleMarkAllRead}
        onRefresh={loadNotifications}
      />
      {isTablet && <OffcanvasSidebar role={user.role} />}
    </Fragment>
  );
};

export default Header;
