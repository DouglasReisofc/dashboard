//import node modules libraries
import { v4 as uuid } from "uuid";
import {
  IconHome,
  IconLayoutDashboard,
  IconCreditCard,
  IconPlugConnected,
  IconPackage,
  IconRobot,
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
  {
    id: uuid(),
    title: "Clientes",
    link: "/dashboard/user/clientes",
    icon: <IconUsers size={20} strokeWidth={1.5} />,
  },
  {
    id: uuid(),
    title: "Configurar bot",
    link: "/dashboard/user/configurar-bot",
    icon: <IconRobot size={20} strokeWidth={1.5} />,
  },
  {
    id: uuid(),
    title: "Config. pagamentos",
    link: "/dashboard/user/pagamentos",
    icon: <IconCreditCard size={20} strokeWidth={1.5} />,
  },
  {
    id: uuid(),
    title: "Webhook",
    link: "/dashboard/user/webhook",
    icon: <IconPlugConnected size={20} strokeWidth={1.5} />,
  },
];

export const getDashboardMenu = (role: "admin" | "user"): MenuItemType[] => {
  if (role === "admin") {
    return adminMenu;
  }

  return userMenu;
};
