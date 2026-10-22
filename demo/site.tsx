import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import "../src/inkpond.css";
import "./site.css";
import { Landing } from "./Landing";

const lang = document.documentElement.lang === "en" ? "en" : "zh";

const root = document.getElementById("root");
const app = (
  <StrictMode>
    <Landing lang={lang} />
  </StrictMode>
);
// The build prerenders the page (scripts/prerender.mjs); dev starts empty.
if (root?.firstChild) hydrateRoot(root, app);
else if (root) createRoot(root).render(app);
