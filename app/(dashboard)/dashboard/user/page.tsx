import { Fragment } from "react";
import { Metadata } from "next";
import { Col, Row } from "react-bootstrap";

import TaskProgress from "components/dashboard/TaskProgress";
import TaskList from "components/dashboard/TaskList";
import ActivityLog from "components/dashboard/ActivityLog";
import UpcomingMeetingSlider from "components/dashboard/UpcomingMeetingSlider";
import ProjectBudget from "components/dashboard/ProjectBudget";

import { getCurrentUser } from "lib/auth";

export const metadata: Metadata = {
  title: "Área do usuário | StoreBot Dashboard",
  description: "Acompanhe atividades pessoais e entregas no StoreBot.",
};

const UserDashboard = async () => {
  const user = await getCurrentUser();

  return (
    <Fragment>
      <div className="mb-6">
        <h1 className="mb-2">Minha área</h1>
        <p className="text-secondary mb-0">
          {user ? `${user.name}, ` : ""}
          acompanhe suas atividades, reuniões e andamento de tarefas em um único lugar.
        </p>
      </div>
      <Row className="g-6 mb-6">
        <Col xl={8}>
          <TaskList />
          <ActivityLog />
        </Col>
        <Col xl={4}>
          <TaskProgress />
          <ProjectBudget />
          <UpcomingMeetingSlider />
        </Col>
      </Row>
    </Fragment>
  );
};

export default UserDashboard;
