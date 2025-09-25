//import node modules libraries
import { getAssetPath } from "helper/assetPath";
import { Metadata } from "next";
import NotFoundClient from "./NotFoundClient";

export const metadata: Metadata = {
  title: "404 error | Dasher - Responsive Bootstrap 5 Admin Dashboard",
  description: "Dasher - Responsive Bootstrap 5 Admin Dashboard",
};

const NotFound = () => {
  return <NotFoundClient assetPath={getAssetPath("/images/svg/404.svg")} />;
};

export default NotFound;
