"use client";
//import node module libraries
import React, { Fragment, useState } from "react";
import Link from "next/link";
import { useMediaQuery } from "react-responsive";
import {
  IconArrowBarLeft,
  IconArrowBarRight,
  IconBell,
  IconMenu2,
  IconSearch,
} from "@tabler/icons-react";
import { Container, ListGroup, Navbar, Button } from "react-bootstrap";

//import custom components
import UserMenu from "./UserMenu";
import Flex from "components/common/Flex";
import NoficationList from "components/common/NoficationList";
import OffcanvasSidebar from "layouts/OffcanvasSidebar";

//import custom hooks
import useMenu from "hooks/useMenu";

import type { SessionUser } from "types/auth";

interface HeaderProps {
  user: SessionUser;
}

const Header: React.FC<HeaderProps> = ({ user }) => {
  const [isNoficationOpen, setIsNotificationOpen] = useState<boolean>(false);
  const { toggleMenuHandler, handleCollapsed } = useMenu();

  const isTablet = useMediaQuery({ maxWidth: 990 });

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
          </Flex>
          <ListGroup
            bsPrefix="list-unstyled"
            as={"ul"}
            className="d-flex align-items-center mb-0 gap-2"
          >
            <ListGroup.Item as="li">
              <Button variant="white">
                <span>
                  <IconSearch size={16} />
                </span>
                <small className="ms-1">⌘K</small>
              </Button>
            </ListGroup.Item>

            <ListGroup.Item as="li">
              <Button
                variant="ghost"
                className="position-relative btn-icon rounded-circle"
                onClick={() => setIsNotificationOpen(true)}
              >
                <IconBell size={20} />
                <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger mt-2 ms-n2">
                  2<span className="visually-hidden">unread messages</span>
                </span>
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
      />
      {isTablet && <OffcanvasSidebar />}
    </Fragment>
  );
};

export default Header;
