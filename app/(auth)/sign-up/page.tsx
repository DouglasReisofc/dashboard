"use client";

import { ChangeEvent, FormEvent, Fragment, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardBody,
  Col,
  Form,
  FormCheck,
  FormControl,
  FormLabel,
  FormSelect,
  Image,
  Row,
} from "react-bootstrap";
import { Metadata } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { getAssetPath } from "helper/assetPath";

export const metadata: Metadata = {
  title: "Criar conta | StoreBot Dashboard",
  description: "Crie sua conta para acessar os painéis StoreBot.",
};

type SignUpFormState = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: "admin" | "user";
  acceptTerms: boolean;
};

const initialFormState: SignUpFormState = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  role: "user",
  acceptTerms: false,
};

const SignUp = () => {
  const router = useRouter();
  const [formState, setFormState] = useState(initialFormState);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = <K extends keyof SignUpFormState>(field: K) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value =
        field === "acceptTerms"
          ? (event.target as HTMLInputElement).checked
          : event.target.value;

      setFormState((prev) => ({
        ...prev,
        [field]: value,
      }));
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!formState.acceptTerms) {
      setError("É necessário aceitar os termos de uso.");
      return;
    }

    if (formState.password !== formState.confirmPassword) {
      setError("As senhas informadas não coincidem.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formState.name,
          email: formState.email,
          password: formState.password,
          role: formState.role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Não foi possível concluir o cadastro.");
        setIsSubmitting(false);
        return;
      }

      const destination =
        data.user.role === "admin" ? "/dashboard/admin" : "/dashboard/user";

      setIsSubmitting(false);
      router.replace(destination);
      router.refresh();
    } catch (err) {
      console.error("Register error", err);
      setError("Ocorreu um erro inesperado. Tente novamente.");
      setIsSubmitting(false);
    }
  };

  return (
    <Fragment>
      <Row className="mb-8">
        <Col xl={{ span: 4, offset: 4 }} md={12}>
          <div className="text-center">
            <Link
              href="/"
              className="fs-2 fw-bold d-flex align-items-center gap-2 justify-content-center mb-6"
            >
              <Image
                src={getAssetPath("/images/brand/logo/logo-icon.svg")}
                alt="StoreBot"
              />
              <span>StoreBot</span>
            </Link>
            <h1 className="mb-1">Criar conta</h1>
            <p className="mb-0">
              Já possui acesso?
              <Link href="/sign-in" className="text-primary ms-1">
                Entrar
              </Link>
            </p>
          </div>
        </Col>
      </Row>

      <Row className="justify-content-center">
        <Col xl={6} lg={7} md={9}>
          <Card className="card-lg mb-6">
            <CardBody className="p-6">
              {error && (
                <Alert variant="danger" className="mb-4">
                  {error}
                </Alert>
              )}
              <Form onSubmit={handleSubmit}>
                <Row className="g-4">
                  <Col md={6}>
                    <FormLabel htmlFor="signUpName">Nome completo</FormLabel>
                    <FormControl
                      id="signUpName"
                      value={formState.name}
                      onChange={updateField("name")}
                      placeholder="Nome e sobrenome"
                      required
                    />
                  </Col>
                  <Col md={6}>
                    <FormLabel htmlFor="signUpEmail">E-mail corporativo</FormLabel>
                    <FormControl
                      type="email"
                      id="signUpEmail"
                      value={formState.email}
                      onChange={updateField("email")}
                      placeholder="nome@empresa.com"
                      required
                    />
                  </Col>
                  <Col md={6}>
                    <FormLabel htmlFor="signUpPassword">Senha</FormLabel>
                    <FormControl
                      type="password"
                      id="signUpPassword"
                      value={formState.password}
                      onChange={updateField("password")}
                      placeholder="Crie uma senha forte"
                      minLength={6}
                      required
                    />
                  </Col>
                  <Col md={6}>
                    <FormLabel htmlFor="signUpPasswordConfirm">Confirme a senha</FormLabel>
                    <FormControl
                      type="password"
                      id="signUpPasswordConfirm"
                      value={formState.confirmPassword}
                      onChange={updateField("confirmPassword")}
                      placeholder="Repita a senha"
                      minLength={6}
                      required
                    />
                  </Col>
                  <Col md={6}>
                    <FormLabel htmlFor="signUpRole">Tipo de acesso</FormLabel>
                    <FormSelect
                      id="signUpRole"
                      value={formState.role}
                      onChange={updateField("role")}
                    >
                      <option value="user">Usuário (recomendado)</option>
                      <option value="admin">Administrador</option>
                    </FormSelect>
                  </Col>
                </Row>

                <FormCheck
                  className="mt-4"
                  id="signUpTerms"
                  checked={formState.acceptTerms}
                  onChange={updateField("acceptTerms")}
                  label="Concordo com os termos de uso e política de privacidade."
                />

                <div className="d-grid mt-4">
                  <Button variant="primary" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <span className="d-inline-flex align-items-center gap-2 justify-content-center">
                        <span
                          className="spinner-border spinner-border-sm"
                          role="status"
                          aria-hidden="true"
                        />
                        Criando conta...
                      </span>
                    ) : (
                      "Criar conta"
                    )}
                  </Button>
                </div>
              </Form>
            </CardBody>
          </Card>
        </Col>
      </Row>
    </Fragment>
  );
};

export default SignUp;
