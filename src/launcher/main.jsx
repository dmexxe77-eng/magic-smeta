/* Отдельная страница выбора версии: своя точка входа, код приложения сюда не попадает */
import React from "react";
import ReactDOM from "react-dom/client";
import Launcher from "./Launcher.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  React.createElement(React.StrictMode, null, React.createElement(Launcher))
);
