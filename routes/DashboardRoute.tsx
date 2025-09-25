//import node modules libraries
import {
  IconHome,
  IconLayoutDashboard,
  IconCreditCard,
  IconPlugConnected,
  IconPackage,
  IconRobot,
  IconWorld,
  IconTags,
  IconUsers,
  IconSettings,
  IconCalendar,
  IconMail,
  IconShoppingBag,
} from "@tabler/icons-react";

//import custom type
import { MenuItemType } from "types/menuTypes";

const adminMenu: MenuItemType[] = [
  {
    id: "admin-dashboard",
    title: "Painel",
    link: "/dashboard/admin",
    icon: <IconLayoutDashboard size={20} strokeWidth={1.5} />,
  },
  {
    id: "admin-site-settings",
    title: "Config. do site",
    link: "/dashboard/admin/site",
    icon: <IconSettings size={20} strokeWidth={1.5} />,
  },
  {
    id: "admin-bot",
    title: "Bot administrativo",
    link: "/dashboard/admin/bot",
    icon: <IconRobot size={20} strokeWidth={1.5} />,
  },
  {
    id: "admin-plans",
    title: "Planos",
    link: "/dashboard/admin/planos",
    icon: <IconCalendar size={20} strokeWidth={1.5} />,
  },
  {
    id: "admin-payments",
    title: "Pagamentos",
    link: "/dashboard/admin/pagamentos",
    icon: <IconCreditCard size={20} strokeWidth={1.5} />,
  },
  {
    id: "admin-notifications",
    title: "Notificações",
    link: "/dashboard/admin/notificacoes",
    icon: <IconMail size={20} strokeWidth={1.5} />,
  },
  {
    id: "admin-categories",
    title: "Categorias",
    link: "/dashboard/admin/categories",
    icon: <IconTags size={20} strokeWidth={1.5} />,
  },
  {
    id: "admin-products",
    title: "Produtos digitais",
    link: "/dashboard/admin/products",
    icon: <IconPackage size={20} strokeWidth={1.5} />,
  },
  {
    id: "admin-users",
    title: "Usuários",
    link: "/dashboard/admin/users",
    icon: <IconUsers size={20} strokeWidth={1.5} />,
  },
];

const userMenu: MenuItemType[] = [
  {
    id: "user-dashboard",
    title: "Painel",
    link: "/dashboard/user",
    icon: <IconHome size={20} strokeWidth={1.5} />,
  },
  {
    id: "user-plan",
    title: "Meu plano",
    link: "/dashboard/user/plano",
    icon: <IconCalendar size={20} strokeWidth={1.5} />,
  },
  {
    id: "user-categories",
    title: "Categorias",
    link: "/dashboard/user/categories",
    icon: <IconTags size={20} strokeWidth={1.5} />,
  },
  {
    id: "user-products",
    title: "Produtos digitais",
    link: "/dashboard/user/products",
    icon: <IconPackage size={20} strokeWidth={1.5} />,
  },
  {
    id: "user-purchases",
    title: "Compras",
    link: "/dashboard/user/compras",
    icon: <IconShoppingBag size={20} strokeWidth={1.5} />,
  },
  {
    id: "user-customers",
    title: "Clientes",
    link: "/dashboard/user/clientes",
    icon: <IconUsers size={20} strokeWidth={1.5} />,
  },
  {
    id: "user-conversations",
    title: "Suporte",
    link: "/dashboard/user/conversas",
    icon: <IconMail size={20} strokeWidth={1.5} />,
  },
  {
    id: "user-bot",
    title: "Configurar bot",
    link: "/dashboard/user/configurar-bot",
    icon: <IconRobot size={20} strokeWidth={1.5} />,
  },
  {
    id: "user-payments",
    title: "Config. pagamentos",
    link: "/dashboard/user/pagamentos",
    icon: <IconCreditCard size={20} strokeWidth={1.5} />,
  },
  {
    id: "user-webhook",
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
