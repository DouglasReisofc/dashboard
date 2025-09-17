//import node modules libraries
import { Container } from "react-bootstrap";

//import custom components
import Flex from "components/common/Flex";

const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <Flex
      tag='main'
      direction='column'
      justifyContent='center'
      className='vh-100'>
      <section>
        <Container>{children}</Container>
      </section>
      <div className='custom-container text-center text-secondary small'>
        StoreBot Dashboard — acesso seguro integrado ao MySQL.
      </div>
    </Flex>
  );
};

export default AuthLayout;
