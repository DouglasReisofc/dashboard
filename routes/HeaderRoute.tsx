//import node modules libraries
import type { ReactNode } from "react";
import { v4 as uuid } from "uuid";
import {
  IconHome,
  IconLayoutDashboard,
  IconPackage,
  IconTags,
} from "@tabler/icons-react";

type UserMenuRole = "admin" | "user";

export interface UserMenuLink {
  id: string;
  link: string;
  title: string;
  icon: ReactNode;
  roles: UserMenuRole[];
}

export const UserMenuItem: UserMenuLink[] = [
  {
    id: uuid(),
    link: "/dashboard/admin",
    title: "Painel administrativo",
    icon: <IconLayoutDashboard size={20} strokeWidth={1.5} />,
    roles: ["admin"],
  },
  {
    id: uuid(),
    link: "/dashboard/user",
    title: "Painel do usuário",
    icon: <IconHome size={20} strokeWidth={1.5} />,
    roles: ["admin", "user"],
  },
  {
    id: uuid(),
    link: "/dashboard/user/categories",
    title: "Categorias",
    icon: <IconTags size={20} strokeWidth={1.5} />,
    roles: ["admin", "user"],
  },
  {
    id: uuid(),
    link: "/dashboard/user/products",
    title: "Produtos digitais",
    icon: <IconPackage size={20} strokeWidth={1.5} />,
    roles: ["admin", "user"],
  },
];
