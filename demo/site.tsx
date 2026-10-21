import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../src/inkpond.css";
import "./site.css";
import { Landing } from "./Landing";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Landing />
    </StrictMode>,
  );
}
