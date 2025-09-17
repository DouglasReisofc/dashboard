"use client";

//import node modules libraries
import React, { useState } from "react";
import { Dropdown } from "react-bootstrap";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconLogout } from "@tabler/icons-react";

//import routes files
import { UserMenuItem } from "routes/HeaderRoute";

//import custom components
import { Avatar } from "components/common/Avatar";
import type { SessionUser } from "types/auth";

interface UserToggleProps {
  children?: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

const CustomToggle = React.forwardRef<HTMLAnchorElement, UserToggleProps>(
  ({ children, onClick }, ref) => (
    <Link
      ref={ref}
      href="#"
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    >
      {children}
    </Link>
  ),
);
CustomToggle.displayName = "UserMenuToggle";

interface UserMenuProps {
  user: SessionUser;
}

const UserMenu: React.FC<UserMenuProps> = ({ user }) => {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const filteredMenu = UserMenuItem.filter((item) => item.roles.includes(user.role));

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/sign-in");
      router.refresh();
    } catch (error) {
      console.error("Logout error", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <Dropdown>
      <Dropdown.Toggle as={CustomToggle}>
        <Avatar type="initial" name={user.name} size="sm" soft />
      </Dropdown.Toggle>
      <Dropdown.Menu align="end" className="p-0 dropdown-menu-md">
        <div className="d-flex gap-3 align-items-center border-dashed border-bottom px-4 py-4">
          <Avatar type="initial" name={user.name} size="md" soft showExact />
          <div>
            <h4 className="mb-0 fs-5">{user.name}</h4>
            <p className="mb-0 text-secondary small">{user.email}</p>
            <span className="badge bg-light text-dark text-uppercase mt-2">{user.role}</span>
          </div>
        </div>
        <div className="p-3 d-flex flex-column gap-1">
          {filteredMenu.map((item) => (
            <Dropdown.Item
              key={item.id}
              as={Link}
              href={item.link}
              className="d-flex align-items-center gap-2"
            >
              <span>{item.icon}</span>
              <span>{item.title}</span>
            </Dropdown.Item>
          ))}
        </div>
        <div className="border-dashed border-top mb-4 pt-4 px-6">
          <button
            type="button"
            className="btn btn-link text-secondary d-flex align-items-center gap-2 p-0"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            <span>
              <IconLogout size={20} strokeWidth={1.5} />
            </span>
            <span>{isLoggingOut ? "Saindo..." : "Sair"}</span>
          </button>
        </div>
      </Dropdown.Menu>
    </Dropdown>
  );
};

export default UserMenu;
