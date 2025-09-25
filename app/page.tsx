import Link from "next/link";
import { Badge, Card, CardBody, Col, Container, Row } from "react-bootstrap";
import {
  IconChartBar,
  IconLock,
  IconSettingsAutomation,
  IconSparkles,
} from "@tabler/icons-react";

import Image from "next/image";

import heroDashboardImage from "public/images/png/dasher-ai.png";
import workflowImage from "public/images/png/dasher-ui-bootstrap-5.jpg";

import type { Metadata } from "next";
import { getAdminSiteSettings } from "lib/admin-site";

const DEFAULT_TITLE = "StoreBot | Chatbots de vendas para produtos digitais";
const DEFAULT_DESCRIPTION =
  "Crie um chatbot oficial do WhatsApp com a Meta Cloud API para vender gifts, recargas, contas premium e mais com o StoreBot.";

const resolveAppUrl = () => {
  const raw = process.env.APP_URL?.trim();
  if (!raw) {
    return "https://zap2.botadmin.shop";
  }

  try {
    const normalized = raw.endsWith("/") ? raw.slice(0, -1) : raw;
    // Will throw if invalid
    new URL(normalized);
    return normalized;
  } catch {
    return "https://zap2.botadmin.shop";
  }
};

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const appUrl = resolveAppUrl();

  try {
    const settings = await getAdminSiteSettings();
    const title = settings.seoTitle ?? DEFAULT_TITLE;
    const description = settings.seoDescription ?? DEFAULT_DESCRIPTION;
    const ogImages = settings.seoImageUrl
      ? [
          {
            url: settings.seoImageUrl,
            width: 1200,
            height: 630,
            alt: settings.siteName ?? "StoreBot",
          },
        ]
      : undefined;

    return {
      metadataBase: new URL(appUrl),
      title,
      description,
      openGraph: {
        title,
        description,
        url: appUrl,
        siteName: settings.siteName ?? "StoreBot",
        images: ogImages,
        type: "website",
      },
      twitter: {
        card: ogImages ? "summary_large_image" : "summary",
        title,
        description,
        images: ogImages?.map((image) => image.url),
      },
    };
  } catch (error) {
    console.error("Failed to resolve site metadata", error);
    return {
      metadataBase: new URL(appUrl),
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      openGraph: {
        title: DEFAULT_TITLE,
        description: DEFAULT_DESCRIPTION,
        url: appUrl,
        siteName: "StoreBot",
      },
      twitter: {
        card: "summary",
        title: DEFAULT_TITLE,
        description: DEFAULT_DESCRIPTION,
      },
    };
  }
}

const features = [
  {
    icon: <IconChartBar size={32} />,
    title: "Catálogo inteligente",
    description:
      "Organize gifts, recargas, acessos premium e quaisquer ativos digitais em categorias com preços, SKUs e estoque controlado.",
  },
  {
    icon: <IconSettingsAutomation size={32} />,
    title: "Fluxos com botões e listas",
    description:
      "Dispare mensagens interativas, menus em lista e botões de compra direto pelo seu chatbot conectado à Meta Cloud API.",
  },
  {
    icon: <IconLock size={32} />,
    title: "Entrega segura",
    description:
      "Armazene detalhes secretos dos produtos, libere downloads e monitore sessões com camadas extras de segurança.",
  },
];

const LandingPage = () => {
  return (
    <main>
      <section className="py-10 py-lg-12 bg-light">
        <Container>
          <Row className="align-items-center gy-6">
            <Col lg={6}>
              <Badge bg="primary" className="mb-3 text-uppercase">
                StoreBot Chatbot
              </Badge>
              <h1 className="display-4 fw-bold mb-3">
                Venda produtos digitais com um chatbot oficial no WhatsApp
              </h1>
              <p className="lead text-secondary mb-4">
                Conecte-se à API oficial da Meta, ofereça botões e listas interativas e entregue códigos, contas e
                documentos digitais automaticamente.
              </p>
              <div className="d-flex flex-wrap gap-3">
                <Link href="/sign-up" className="btn btn-primary btn-lg">
                  Criar conta
                </Link>
                <Link href="/sign-in" className="btn btn-outline-primary btn-lg">
                  Já sou cliente
                </Link>
              </div>
            </Col>
            <Col lg={6} className="text-center text-lg-end">
              <Image
                src={heroDashboardImage}
                alt="Chatbot StoreBot para WhatsApp"
                priority
                className="rounded-4 shadow-sm"
                sizes="(max-width: 768px) 100vw, 50vw"
                style={{ width: "100%", height: "auto" }}
              />
            </Col>
          </Row>
        </Container>
      </section>

      <section className="py-10">
        <Container>
          <header className="text-center mb-6">
            <h2 className="fw-bold mb-3">Recursos pensados para escalar seu atendimento</h2>
            <p className="text-secondary mb-0">
              Estruture catálogos digitais, automatize respostas e mantenha o controle das vendas em um ambiente seguro.
            </p>
          </header>
          <Row className="gy-4">
            {features.map((feature) => (
              <Col md={4} key={feature.title}>
                <Card className="h-100 border-0 shadow-sm">
                  <CardBody className="p-5">
                    <div className="text-primary mb-3">{feature.icon}</div>
                    <h3 className="h4 mb-3">{feature.title}</h3>
                    <p className="text-secondary mb-0">{feature.description}</p>
                  </CardBody>
                </Card>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      <section className="py-10 bg-light">
        <Container>
          <Row className="align-items-center gy-6">
            <Col lg={6}>
              <Image
                src={workflowImage}
                alt="Fluxo do chatbot"
                loading="lazy"
                className="rounded-4 shadow-sm"
                sizes="(max-width: 768px) 100vw, 50vw"
                style={{ width: "100%", height: "auto" }}
              />
            </Col>
            <Col lg={6}>
              <h2 className="fw-bold mb-3">Experiência completa para times de automação</h2>
              <p className="text-secondary mb-4">
                Configure catálogos, integre gateways de pagamento e monitore interações em um só lugar. O StoreBot une o
                poder do Next.js com a Meta Cloud API para entregar respostas imediatas aos seus clientes.
              </p>
              <ul className="list-unstyled d-flex flex-column gap-2">
                <li className="d-flex align-items-center gap-2">
                  <IconSparkles className="text-primary" size={20} /> Mensagens interativas com botões, listas e CTAs
                </li>
                <li className="d-flex align-items-center gap-2">
                  <IconSparkles className="text-primary" size={20} /> Painéis separados para administradores e operadores
                </li>
                <li className="d-flex align-items-center gap-2">
                  <IconSparkles className="text-primary" size={20} /> Integração segura com painéis e fluxos sob medida
                </li>
              </ul>
            </Col>
          </Row>
        </Container>
      </section>

      <section className="py-10">
        <Container>
          <Row className="align-items-center gy-4">
            <Col lg={8}>
              <h2 className="fw-bold mb-2">Pronto para lançar seu chatbot vendedor?</h2>
              <p className="text-secondary mb-0">
                Personalize sua operação, conecte sua conta Meta Business e ative um funil automático de vendas de
                produtos digitais em poucos minutos.
              </p>
            </Col>
            <Col lg={4} className="text-lg-end">
              <Link href="/sign-up" className="btn btn-primary btn-lg">
                Começar agora
              </Link>
            </Col>
          </Row>
        </Container>
      </section>
    </main>
  );
};

export default LandingPage;
