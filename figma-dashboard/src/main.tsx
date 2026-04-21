import { createRoot } from "react-dom/client";
import { SaasProvider } from "@saas-ui/react";
import App from "./app/App.tsx";
import { rappiSaasTheme } from "./app/saasTheme.ts";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <SaasProvider theme={rappiSaasTheme}>
    <App />
  </SaasProvider>
);
