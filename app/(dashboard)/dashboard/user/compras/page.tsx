import { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUser } from "lib/auth";
import { getChargeHistoryForUser } from "lib/payments";
import { getPurchaseHistoryForUser } from "lib/purchase-history";

import UserPurchasesView from "components/purchases/UserPurchasesView";

export const metadata: Metadata = {
  title: "Histórico de compras | StoreBot Dashboard",
  description: "Consulte as compras confirmadas pelos clientes e os pagamentos aprovados no bot.",
};

const UserPurchasesPage = async () => {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  if (user.role !== "user") {
    redirect("/dashboard/admin");
  }

  const [purchases, charges] = await Promise.all([
    getPurchaseHistoryForUser(user.id, 100),
    getChargeHistoryForUser(user.id, 100),
  ]);

  return (
    <UserPurchasesView
      userName={user.name}
      purchases={purchases}
      charges={charges}
    />
  );
};

export default UserPurchasesPage;
