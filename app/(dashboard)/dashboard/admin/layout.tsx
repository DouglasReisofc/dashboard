import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getCurrentUser } from "lib/auth";

interface AdminDashboardLayoutProps {
  children: ReactNode;
}

export const dynamic = "force-dynamic";

const AdminDashboardLayout = async ({ children }: AdminDashboardLayoutProps) => {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  if (user.role !== "admin") {
    redirect("/dashboard/user");
  }

  return children;
};

export default AdminDashboardLayout;
