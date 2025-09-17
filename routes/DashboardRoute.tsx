//import node modules libraries
import { v4 as uuid } from "uuid";
import {
  IconChartHistogram,
  IconHome,
  IconNews,
  IconShoppingBag,
} from "@tabler/icons-react";

//import custom type
import { MenuItemType } from "types/menuTypes";

const adminMenu: MenuItemType[] = [
  {
    id: uuid(),
    title: "Dashboard",
    link: "/dashboard/admin",
    icon: <IconChartHistogram size={20} strokeWidth={1.5} />,
  },
  {
    id: uuid(),
    title: "Produtos",
    link: "/dashboard/ecommerce",
    icon: <IconShoppingBag size={20} strokeWidth={1.5} />,
  },
  {
    id: uuid(),
    title: "Conteúdo",
    link: "/dashboard/blog",
    icon: <IconNews size={20} strokeWidth={1.5} />,
  },
];

const userMenu: MenuItemType[] = [
  {
    id: uuid(),
    title: "Meu painel",
    link: "/dashboard/user",
    icon: <IconHome size={20} strokeWidth={1.5} />,
  },
  {
    id: uuid(),
    title: "Blog",
    link: "/dashboard/blog",
    icon: <IconNews size={20} strokeWidth={1.5} />,
  },
];

export const getDashboardMenu = (role: "admin" | "user"): MenuItemType[] => {
  if (role === "admin") {
    return adminMenu;
  }

  return userMenu;
};

