//import node modules libraries
import { v4 as uuid } from "uuid";
import {
  IconHome,
  IconLayoutDashboard,
  IconPackage,
  IconTags,
  IconUsers,
} from "@tabler/icons-react";

//import custom type
import { MenuItemType } from "types/menuTypes";

const adminMenu: MenuItemType[] = [
  {
    id: uuid(),
    title: "Painel",
    link: "/dashboard/admin",
    icon: <IconLayoutDashboard size={20} strokeWidth={1.5} />,
  },
  {
    id: uuid(),
    title: "Categorias",
    link: "/dashboard/admin/categories",
    icon: <IconTags size={20} strokeWidth={1.5} />,
  },
  {
    id: uuid(),
    title: "Produtos digitais",
    link: "/dashboard/admin/products",
    icon: <IconPackage size={20} strokeWidth={1.5} />,
  },
  {
    id: uuid(),
    title: "Usuários",
    link: "/dashboard/admin/users",
    icon: <IconUsers size={20} strokeWidth={1.5} />,
  },
];

const userMenu: MenuItemType[] = [
  {
    id: uuid(),
    title: "Painel",
    link: "/dashboard/user",
    icon: <IconHome size={20} strokeWidth={1.5} />,
  },
  {
    id: uuid(),
    title: "Categorias",
    link: "/dashboard/user/categories",
    icon: <IconTags size={20} strokeWidth={1.5} />,
  },
  {
    id: uuid(),
    title: "Produtos digitais",
    link: "/dashboard/user/products",
    icon: <IconPackage size={20} strokeWidth={1.5} />,
  },
];

export const getDashboardMenu = (role: "admin" | "user"): MenuItemType[] => {
  if (role === "admin") {
    return adminMenu;
  }

  return userMenu;
};
