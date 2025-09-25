"use client";

import { ChangeEvent, FormEvent, Fragment, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardBody,
  Col,
  DropdownButton,
  Dropdown,
  Form,
  FormCheck,
  FormControl,
  FormLabel,
  Image,
  InputGroup,
  Row,
} from "react-bootstrap";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { getAssetPath } from "helper/assetPath";
import { PHONE_COUNTRIES, findCountryByDialCode } from "data/phone-countries";

type SignUpFormState = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
  whatsappDialCode: string;
  whatsappNumber: string;
};

const initialFormState: SignUpFormState = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  acceptTerms: false,
  whatsappDialCode: PHONE_COUNTRIES[0].dialCode,
  whatsappNumber: "",
};

const SignUpClient = () => {
  const router = useRouter();
  const [formState, setFormState] = useState(initialFormState);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedCountry = useMemo(() => {
    return findCountryByDialCode(formState.whatsappDialCode) ?? PHONE_COUNTRIES[0];
  }, [formState.whatsappDialCode]);

  const updateField = <K extends keyof SignUpFormState>(field: K) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
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

    const numericWhatsapp = formState.whatsappNumber.replace(/[^0-9]/g, "");
    if (numericWhatsapp.length < 8 || numericWhatsapp.length > 15) {
      setError("Informe um número de WhatsApp válido (DDD + número, apenas dígitos).");
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
          whatsappDialCode: formState.whatsappDialCode,
          whatsappNumber: numericWhatsapp,
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
                  <Col md={12}>
                    <FormLabel>WhatsApp</FormLabel>
                    <InputGroup>
                      <DropdownButton
                        variant="outline-secondary"
                        title={(
                          <span className="d-inline-flex align-items-center gap-2">
                            <img
                              src={`/flags/${selectedCountry.code.toLowerCase()}.svg`}
                              alt={`Bandeira ${selectedCountry.label}`}
                              width={24}
                              height={16}
                              className="rounded border"
                            />
                            <span>{selectedCountry.dialCode}</span>
                          </span>
                        )}
                        id="signUpWhatsappDialCode"
                        onSelect={(eventKey) => {
                          if (!eventKey) {
                            return;
                          }
                          setFormState((previous) => ({
                            ...previous,
                            whatsappDialCode: eventKey,
                          }));
                        }}
                      >
                        {PHONE_COUNTRIES.map((country) => (
                          <Dropdown.Item eventKey={country.dialCode} key={country.code}>
                            <span className="d-inline-flex align-items-center gap-2">
                              <img
                                src={`/flags/${country.code.toLowerCase()}.svg`}
                                alt={`Bandeira ${country.label}`}
                                width={24}
                                height={16}
                                className="rounded border"
                              />
                              <span>{country.label} ({country.dialCode})</span>
                            </span>
                          </Dropdown.Item>
                        ))}
                      </DropdownButton>
                      <FormControl
                        id="signUpWhatsapp"
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]{8,15}"
                        placeholder="DDD + número"
                        value={formState.whatsappNumber}
                        onChange={(event) => {
                          const value = event.target.value.replace(/[^0-9]/g, "");
                          setFormState((previous) => ({
                            ...previous,
                            whatsappNumber: value,
                          }));
                        }}
                        required
                      />
                    </InputGroup>
                    <Form.Text className="text-secondary">
                      Selecione o DDI e digite apenas DDD + número, sem espaços ou símbolos.
                    </Form.Text>
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

export default SignUpClient;
