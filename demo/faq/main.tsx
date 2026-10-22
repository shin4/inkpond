import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import "../site.css";
import { Faq } from "../Faq";

const root = document.getElementById("root");
const app = (
  <StrictMode>
    <Faq />
  </StrictMode>
);
if (root?.firstChild) hydrateRoot(root, app);
else if (root) createRoot(root).render(app);
