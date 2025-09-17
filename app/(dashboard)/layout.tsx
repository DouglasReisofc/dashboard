//import custom components
import Header from "layouts/header/Header";
import Sidebar from "layouts/Sidebar";

//import auth helpers
import { getCurrentUser } from "lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface DashboardProps {
  children: React.ReactNode;
}

const DashboardLayout = async ({ children }: DashboardProps) => {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const currentYear = new Date().getFullYear();

  return (
    <div>
      <Sidebar hideLogo={false} containerId="miniSidebar" role={user.role} />
      <div id="content" className="position-relative h-100">
        <Header user={user} />
        <div className="custom-container py-4">{children}</div>
        <div className="custom-container pb-4">
          <span className="me-1">StoreBot Dashboard © {currentYear}</span>
          <span className="text-secondary">Projeto full-stack Next.js + MySQL.</span>
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;
