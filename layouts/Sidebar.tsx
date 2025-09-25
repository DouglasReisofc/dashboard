"use client";

//import node module libraries
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { Image, Nav } from "react-bootstrap";

//import custom routes
import { getDashboardMenu } from "routes/DashboardRoute";

//import helper
import { getAssetPath } from "helper/assetPath";

interface SidebarProps {
  hideLogo: boolean;
  containerId?: string;
  role: "admin" | "user";
  siteSettings?: {
    siteName: string;
    logoUrl: string | null;
  };
}

const Sidebar: React.FC<SidebarProps> = ({ hideLogo = false, containerId, role, siteSettings }) => {
  const pathname = usePathname();
  const menuItems = getDashboardMenu(role);
  const logoSrc = siteSettings?.logoUrl ?? "/images/brand/logo/logo-icon.svg";
  const siteTitle = siteSettings?.siteName ?? "StoreBot";

  const isActiveLink = (link?: string) => {
    if (!link) return false;

    const [basePath] = link.split("#");

    if (basePath === "/") {
      return pathname === "/";
    }

    return pathname === basePath || pathname.startsWith(`${basePath}/`);
  };

  return (
    <div id={containerId}>
      <div>
        {hideLogo || (
          <div className="brand-logo">
            <Link href="/" className="d-none d-md-flex align-items-center gap-2">
              <Image src={getAssetPath(logoSrc)} alt={siteTitle} />
              <span className="fw-bold fs-4 site-logo-text">{siteTitle}</span>
            </Link>
          </div>
        )}

        <Nav as="ul" bsPrefix="navbar-nav flex-column" className="mt-4">
          {menuItems.map((item) => (
            <Nav.Item as="li" key={item.id}>
              <Link
                href={item.link ?? "#"}
                className={`nav-link d-flex align-items-center gap-2 ${
                  isActiveLink(item.link) ? "active" : ""
                }`}
              >
                <span>{item.icon}</span>
                <span className="text">{item.title}</span>
              </Link>
            </Nav.Item>
          ))}
        </Nav>
      </div>
    </div>
  );
};

export default Sidebar;
