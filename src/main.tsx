import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { AppInitializer } from "./components/native/AppInitializer";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <AppInitializer>
    <App />
  </AppInitializer>
);
