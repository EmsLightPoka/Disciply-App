import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { SessionProvider } from "./lib/session";
import { ToastProvider } from "./components/ui";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

// Nouvelle version en ligne : elle s'installe et la page se recharge toute seule.
// On vérifie aussi toutes les 30 minutes et à chaque retour sur l'app.
const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
  }
});
void updateSW;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>
);
