import type { Metadata } from "next";

import UserConversationsClient from "components/conversations/UserConversationsClient";

export const metadata: Metadata = {
  title: "Suporte | StoreBot Dashboard",
  description: "Atenda clientes que solicitaram suporte pelo WhatsApp.",
};

const UserConversationsPage = () => {
  return <UserConversationsClient />;
};

export default UserConversationsPage;
