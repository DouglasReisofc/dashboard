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
      <div id="content" className="position-relative min-vh-100 d-flex flex-column">
        <Header user={user} />
        <div className="custom-container py-4 flex-grow-1">{children}</div>
        <footer className="custom-container pb-4 text-secondary text-center">
          StoreBot Dashboard © {currentYear}. Todos os direitos reservados.
        </footer>
      </div>
    </div>
  );
};

export default DashboardLayout;
