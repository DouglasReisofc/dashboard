import { Metadata } from "next";
import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  CardBody,
  Col,
  Container,
  Image,
  Row,
} from "react-bootstrap";
import {
  IconChartBar,
  IconLock,
  IconSettingsAutomation,
  IconSparkles,
} from "@tabler/icons-react";

import { getAssetPath } from "helper/assetPath";

export const metadata: Metadata = {
  title: "StoreBot | Chatbots de vendas para produtos digitais",
  description:
    "Crie um chatbot oficial do WhatsApp com a Meta Cloud API para vender gifts, recargas, contas premium e mais com o StoreBot.",
};

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
      "Armazene detalhes secretos dos produtos, libere downloads e monitore sessões com autenticação e MySQL integrados.",
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
                <Button as={Link} href="/sign-up" variant="primary" size="lg">
                  Criar conta
                </Button>
                <Button
                  as={Link}
                  href="/sign-in"
                  variant="outline-primary"
                  size="lg"
                >
                  Já sou cliente
                </Button>
              </div>
            </Col>
            <Col lg={6}>
              <Image
                src={getAssetPath("/images/png/dasher-ai.png")}
                alt="Chatbot StoreBot para WhatsApp"
                className="img-fluid rounded-4 shadow-sm"
              />
            </Col>
          </Row>
        </Container>
      </section>

      <section className="py-10">
        <Container>
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
                src={getAssetPath("/images/png/dasher-ui-bootstrap-5.jpg")}
                alt="Fluxo do chatbot"
                className="img-fluid rounded-4 shadow-sm"
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
                  <IconSparkles className="text-primary" size={20} /> Integração segura com base MySQL StoreBot
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
                Configure o .env, conecte sua conta Meta Business e ative um funil automático de vendas de produtos
                digitais em poucos minutos.
              </p>
            </Col>
            <Col lg={4} className="text-lg-end">
              <Button as={Link} href="/sign-up" size="lg" variant="primary">
                Começar agora
              </Button>
            </Col>
          </Row>
        </Container>
      </section>
    </main>
  );
};

export default LandingPage;
