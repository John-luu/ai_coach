import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./themes.css";

// 应用持久化主题
const savedTheme = localStorage.getItem("app_theme") || "newyear";
document.documentElement.setAttribute("data-theme", savedTheme);

createRoot(document.getElementById("root") as HTMLElement).render(
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <App />
  </BrowserRouter>
);
