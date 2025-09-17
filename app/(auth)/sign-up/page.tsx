import { Metadata } from "next";

import SignUpClient from "./sign-up-client";

export const metadata: Metadata = {
  title: "Criar conta | StoreBot Dashboard",
  description: "Crie sua conta para acessar os painéis StoreBot.",
};

const SignUpPage = () => {
  return <SignUpClient />;
};

export default SignUpPage;
