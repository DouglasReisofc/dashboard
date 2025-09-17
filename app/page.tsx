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
  title: "StoreBot | Plataforma inteligente de dashboards",
  description:
    "Gerencie operações, vendas e integrações do StoreBot com dashboards personalizados para administradores e usuários.",
};

const features = [
  {
    icon: <IconChartBar size={32} />,
    title: "Insights completos",
    description:
      "Visualize indicadores estratégicos em tempo real, com relatórios prontos para uso e personalização fácil.",
  },
  {
    icon: <IconSettingsAutomation size={32} />,
    title: "Fluxos automatizados",
    description:
      "Configure processos automáticos e alertas inteligentes para acompanhar seu time sem perder nenhum detalhe.",
  },
  {
    icon: <IconLock size={32} />,
    title: "Segurança em primeiro lugar",
    description:
      "Controle de acesso por perfil, criptografia e autenticação segura integrada ao seu banco de dados MySQL.",
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
                StoreBot Dashboard
              </Badge>
              <h1 className="display-4 fw-bold mb-3">
                Transforme dados em decisões com um painel pronto para uso
              </h1>
              <p className="lead text-secondary mb-4">
                Comece agora mesmo com autenticação integrada, dashboards separados para administradores e usuários
                e integrações Node.js com MySQL em um único projeto Next.js.
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
                alt="Interface StoreBot"
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
                alt="Análises avançadas"
                className="img-fluid rounded-4 shadow-sm"
              />
            </Col>
            <Col lg={6}>
              <h2 className="fw-bold mb-3">Experiência pensada para o seu time</h2>
              <p className="text-secondary mb-4">
                Painéis dedicados para cada perfil de usuário garantem foco nas métricas importantes.
                Administradores acompanham metas, receita e times, enquanto usuários têm uma visão simplificada das
                atividades, tarefas e resultados individuais.
              </p>
              <ul className="list-unstyled d-flex flex-column gap-2">
                <li className="d-flex align-items-center gap-2">
                  <IconSparkles className="text-primary" size={20} /> Visão geral executiva para administradores
                </li>
                <li className="d-flex align-items-center gap-2">
                  <IconSparkles className="text-primary" size={20} /> Painel colaborativo para membros do time
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
              <h2 className="fw-bold mb-2">Pronto para acelerar sua operação?</h2>
              <p className="text-secondary mb-0">
                Configure o .env, execute o projeto e tenha uma stack completa com Next.js, Node.js e MySQL em minutos.
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
