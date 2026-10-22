import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import "../src/inkpond.css";
import "./site.css";
import { Landing } from "./Landing";

const root = document.getElementById("root");
const app = (
  <StrictMode>
    <Landing />
  </StrictMode>
);
// The build prerenders the page (scripts/prerender.mjs); dev starts empty.
if (root?.firstChild) hydrateRoot(root, app);
else if (root) createRoot(root).render(app);
