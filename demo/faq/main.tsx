import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import "../site.css";
import { Faq } from "../Faq";

const lang = document.documentElement.lang === "en" ? "en" : "zh";

const root = document.getElementById("root");
const app = (
  <StrictMode>
    <Faq lang={lang} />
  </StrictMode>
);
if (root?.firstChild) hydrateRoot(root, app);
else if (root) createRoot(root).render(app);
