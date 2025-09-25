"use client";

import { Fragment } from "react";
import { Button, Col, Image, Row } from "react-bootstrap";

interface NotFoundClientProps {
  assetPath: string;
}

const NotFoundClient = ({ assetPath }: NotFoundClientProps) => {
  return (
    <Fragment>
      <Row className="justify-content-center">
        <Col>
          <div className="text-center">
            <div>
              <Image src={assetPath} alt="Image" className="img-fluid" />
            </div>

            <h1 className="display-4">Oops! the page not found.</h1>
            <p className="mb-6 fs-5">
              Or simply leverage the expertise of our consultation team.
            </p>

            <Button href="/dasher-ui" variant="primary" size="lg">
              Go Home
            </Button>
          </div>
        </Col>
      </Row>
    </Fragment>
  );
};

export default NotFoundClient;
