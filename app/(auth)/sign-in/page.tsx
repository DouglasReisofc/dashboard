import { Metadata } from "next";

import SignInClient from "./sign-in-client";

export const metadata: Metadata = {
  title: "Entrar | StoreBot Dashboard",
  description: "Autentique-se para acessar o painel StoreBot.",
};

const SignInPage = () => {
  return <SignInClient />;
};

export default SignInPage;
