//import custom components
import Header from "layouts/header/Header";
import Sidebar from "layouts/Sidebar";

//import auth helpers
import { getCurrentUser } from "lib/auth";
import { getSiteSettingsForUser } from "lib/site";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

interface DashboardProps {
  children: React.ReactNode;
}

const DashboardLayout = async ({ children }: DashboardProps) => {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const headersList = headers();
  const pathname = headersList.get("x-next-pathname") || "";

  const containerClass =
    pathname === "/dashboard/user/conversas"
      ? "container-fluid"
      : "custom-container";

  const siteSettings = await getSiteSettingsForUser(user.id);
  const currentYear = new Date().getFullYear();

  return (
    <div>
      <Sidebar
        hideLogo={false}
        containerId="miniSidebar"
        role={user.role}
        siteSettings={{
          logoUrl: siteSettings.logoUrl,
          siteName: siteSettings.siteName,
        }}
      />
      <div id="content" className="position-relative min-vh-100 d-flex flex-column">
        <Header user={user} siteSettings={{ siteName: siteSettings.siteName }} />
        <div className={`${containerClass} py-4 flex-grow-1`}>{children}</div>
        <footer className="custom-container mt-auto py-3 text-secondary text-center">
          StoreBot Dashboard © {currentYear}. Todos os direitos reservados.
        </footer>
      </div>
    </div>
  );
};

export default DashboardLayout;
