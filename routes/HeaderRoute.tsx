//import node modules libraries
import type { ReactNode } from "react";
import { v4 as uuid } from "uuid";
import {
  IconChartHistogram,
  IconHome,
  IconNews,
  IconSettings,
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
    icon: <IconChartHistogram size={20} strokeWidth={1.5} />,
    roles: ["admin"],
  },
  {
    id: uuid(),
    link: "/dashboard/user",
    title: "Minha área",
    icon: <IconHome size={20} strokeWidth={1.5} />,
    roles: ["admin", "user"],
  },
  {
    id: uuid(),
    link: "/dashboard/blog",
    title: "Blog interno",
    icon: <IconNews size={20} strokeWidth={1.5} />,
    roles: ["admin", "user"],
  },
  {
    id: uuid(),
    link: "/dashboard/ecommerce",
    title: "Catálogo",
    icon: <IconSettings size={20} strokeWidth={1.5} />,
    roles: ["admin"],
  },
];
