import { Fragment } from "react";
import { Metadata } from "next";

import AdminUserManager from "components/users/AdminUserManager";
import { getAdminUsers } from "lib/users";

export const metadata: Metadata = {
  title: "Usuários da plataforma | StoreBot Dashboard",
  description:
    "Monitore sessões ativas, altere o status das contas e mantenha o cadastro dos clientes em ordem.",
};

const AdminUsersPage = async () => {
  const users = await getAdminUsers();

  return (
    <Fragment>
      <div className="mb-6">
        <h1 className="mb-2">Usuários</h1>
        <p className="text-secondary mb-0">
          Consulte todas as contas registradas, ajuste permissões e encerre sessões suspeitas em tempo real.
        </p>
      </div>
      <AdminUserManager users={users} />
    </Fragment>
  );
};

export default AdminUsersPage;
