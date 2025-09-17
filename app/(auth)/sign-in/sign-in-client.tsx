"use client";

import { ChangeEvent, FormEvent, Fragment, useState } from "react";
import Feedback from "react-bootstrap/Feedback";
import {
  Alert,
  Row,
  Col,
  Image,
  Card,
  CardBody,
  Form,
  FormLabel,
  FormControl,
  FormCheck,
  Button,
} from "react-bootstrap";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconBrandFacebookFilled,
  IconBrandGoogleFilled,
  IconEyeOff,
} from "@tabler/icons-react";

import Flex from "components/common/Flex";
import { getAssetPath } from "helper/assetPath";

const SignInClient = () => {
  const router = useRouter();
  const [formState, setFormState] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formState),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Não foi possível realizar o login.");
        setIsSubmitting(false);
        return;
      }

      const destination =
        data.user.role === "admin" ? "/dashboard/admin" : "/dashboard/user";
      setIsSubmitting(false);
      router.replace(destination);
      router.refresh();
    } catch (err) {
      console.error("Login error", err);
      setError("Ocorreu um erro inesperado. Tente novamente.");
      setIsSubmitting(false);
    }
  };

  const updateField = (field: "email" | "password") =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setFormState((prev) => ({ ...prev, [field]: event.target.value }));
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
              <Image src={getAssetPath("/images/brand/logo/logo-icon.svg")} alt="StoreBot" />
              <span>StoreBot</span>
            </Link>
            <h1 className="mb-1">Bem-vindo de volta</h1>
            <p className="mb-0">
              Ainda não possui uma conta?
              <Link href="/sign-up" className="text-primary ms-1">
                Cadastre-se
              </Link>
            </p>
          </div>
        </Col>
      </Row>

      <Row className="justify-content-center">
        <Col xl={5} lg={6} md={8}>
          <Card className="card-lg mb-6">
            <CardBody className="p-6">
              {error && (
                <Alert variant="danger" className="mb-4">
                  {error}
                </Alert>
              )}
              <Form className="mb-6" onSubmit={handleSubmit}>
                <div className="mb-3">
                  <FormLabel htmlFor="signinEmailInput">
                    E-mail <span className="text-danger">*</span>
                  </FormLabel>
                  <FormControl
                    type="email"
                    id="signinEmailInput"
                    value={formState.email}
                    onChange={updateField("email")}
                    placeholder="nome@empresa.com"
                    required
                  />
                  <Feedback type="invalid">Informe um e-mail válido.</Feedback>
                </div>
                <div className="mb-3">
                  <FormLabel htmlFor="formSignInPassword">Senha</FormLabel>
                  <div className="password-field position-relative">
                    <FormControl
                      type="password"
                      id="formSignInPassword"
                      className="fakePassword"
                      value={formState.password}
                      onChange={updateField("password")}
                      placeholder="Sua senha de acesso"
                      required
                    />
                    <span>
                      <IconEyeOff className="passwordToggler" size={16} />
                    </span>
                  </div>
                  <Feedback type="invalid">Informe sua senha.</Feedback>
                </div>
                <Flex className="mb-4" alignItems="center" justifyContent="between">
                  <FormCheck label="Lembrar de mim" type="checkbox" disabled />
                  <div>
                    <Link href="#" className="text-primary">
                      Esqueci minha senha
                    </Link>
                  </div>
                </Flex>
                <div className="d-grid">
                  <Button variant="primary" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <span className="d-inline-flex align-items-center gap-2 justify-content-center">
                        <span
                          className="spinner-border spinner-border-sm"
                          role="status"
                          aria-hidden="true"
                        />
                        Entrando...
                      </span>
                    ) : (
                      "Entrar"
                    )}
                  </Button>
                </div>
              </Form>

              <span>Entre utilizando suas redes sociais.</span>
              <Flex justifyContent="between" className="mt-3 d-flex gap-2">
                <Button href="#" variant="google" className="w-100" disabled>
                  <span className="me-3">
                    <IconBrandGoogleFilled size={18} />
                  </span>
                  Em breve
                </Button>
                <Button href="#" variant="facebook" className="w-100" disabled>
                  <span className="me-3">
                    <IconBrandFacebookFilled size={18} />
                  </span>
                  Em breve
                </Button>
              </Flex>
            </CardBody>
          </Card>
        </Col>
      </Row>
    </Fragment>
  );
};

export default SignInClient;
