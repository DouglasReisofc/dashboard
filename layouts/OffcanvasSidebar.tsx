"use client";
//import node modules libraries
import { Image } from "react-bootstrap";
import Offcanvas from "react-bootstrap/Offcanvas";
import OffcanvasBody from "react-bootstrap/OffcanvasBody";
import OffcanvasHeader from "react-bootstrap/OffcanvasHeader";
import Link from "next/link";

//import custom components
import Sidebar from "./Sidebar";

//import custom hooks
import useMenu from "hooks/useMenu";
import { getAssetPath } from "helper/assetPath";

interface OffcanvasSidebarProps {
  role: "admin" | "user";
}

const OffcanvasSidebar = ({ role }: OffcanvasSidebarProps) => {
  const { showMenu, toggleMenuHandler } = useMenu();

  return (
    <Offcanvas
      placement={"start"}
      show={showMenu}
      onHide={() => toggleMenuHandler(false)}
      backdrop={true}
      bsPrefix="offcanvasNav offcanvas offcanvas-start "
    >
      <OffcanvasHeader closeButton>
        <Link href="/" className="d-flex align-items-center gap-2">
          <Image src={getAssetPath("/images/brand/logo/logo-icon.svg")} alt="" />
          <span className="fw-bold fs-4  site-logo-text">Dasher</span>
        </Link>
      </OffcanvasHeader>
      <OffcanvasBody className="p-0 ">
        <Sidebar hideLogo role={role} />
      </OffcanvasBody>
    </Offcanvas>
  );
};

export default OffcanvasSidebar;
