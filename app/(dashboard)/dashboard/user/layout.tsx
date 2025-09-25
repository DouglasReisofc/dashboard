import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getCurrentUser } from "lib/auth";

interface UserDashboardLayoutProps {
  children: ReactNode;
}

export const dynamic = "force-dynamic";

const UserDashboardLayout = async ({ children }: UserDashboardLayoutProps) => {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  if (user.role !== "user") {
    redirect("/dashboard/admin");
  }

  return children;
};

export default UserDashboardLayout;
