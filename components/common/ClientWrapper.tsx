"use client";
//import node modules libraries
import { Provider } from "react-redux";

//import redux store
import store from "store/store";
import SupportNotificationListener from "components/common/SupportNotificationListener";
import SupportFloatingBubble from "components/support/SupportFloatingBubble";

const ClientWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <Provider store={store}>
      <SupportNotificationListener />
      <SupportFloatingBubble />
      {children}
    </Provider>
  );
};

export default ClientWrapper;
