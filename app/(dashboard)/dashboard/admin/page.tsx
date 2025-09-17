//import node module libraries
import { Fragment } from "react";
import { Metadata } from "next";
import { Col, Row } from "react-bootstrap";

//import custom components
import DashboardStats from "components/dashboard/DashboardStats";
import ActiveProject from "components/dashboard/ActiveProject";
import TaskProgress from "components/dashboard/TaskProgress";
import TeamsTable from "components/dashboard/TeamsTable";
import AIBanner from "components/dashboard/AIBanner";
import ActivityLog from "components/dashboard/ActivityLog";
import ProjectBudget from "components/dashboard/ProjectBudget";
import TaskList from "components/dashboard/TaskList";
import UpcomingMeetingSlider from "components/dashboard/UpcomingMeetingSlider";

import { getCurrentUser } from "lib/auth";

export const metadata: Metadata = {
  title: "Admin | StoreBot Dashboard",
  description: "Painel administrativo com visão completa da operação StoreBot.",
};

const AdminDashboard = async () => {
  const user = await getCurrentUser();

  return (
    <Fragment>
      <div className="mb-6">
        <h1 className="mb-2">Painel administrativo</h1>
        <p className="text-secondary mb-0">
          Bem-vindo{user ? `, ${user.name}` : ""}! Monitore indicadores chave, acompanhe equipes e gerencie
          resultados em tempo real.
        </p>
      </div>
      <Row className="g-6 mb-6">
        <DashboardStats />
      </Row>
      <Row className="g-6 mb-6">
        <Col xl={8}>
          <ActiveProject />
          <TeamsTable />
          <ActivityLog />
          <TaskList />
        </Col>
        <Col xl={4}>
          <TaskProgress />
          <AIBanner />
          <ProjectBudget />
          <UpcomingMeetingSlider />
        </Col>
      </Row>
    </Fragment>
  );
};

export default AdminDashboard;
