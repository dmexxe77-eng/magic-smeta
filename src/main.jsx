import React from "react";
import ReactDOM from "react-dom/client";

const root = ReactDOM.createRoot(document.getElementById("root"));

function showError(err) {
  const msg = err?.message || String(err);
  const stack = err?.stack || "";
  root.render(
    React.createElement("div", { style: { padding: 20, fontFamily: "monospace", color: "#b00020", fontSize: 13 } },
      React.createElement("b", null, "❌ Ошибка запуска:"),
      React.createElement("div", { style: { marginTop: 8 } }, msg),
      React.createElement("pre", { style: { marginTop: 8, whiteSpace: "pre-wrap", fontSize: 11 } }, stack)
    )
  );
}

window.addEventListener("error", e => showError(e.error || e));
window.addEventListener("unhandledrejection", e => showError(e.reason));

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      const msg = this.state.error?.message || String(this.state.error);
      return React.createElement("div", { style: { padding: 20, fontFamily: "monospace", color: "#b00020", fontSize: 13 } },
        React.createElement("b", null, "❌ Render error:"),
        React.createElement("div", { style: { marginTop: 8 } }, msg),
        React.createElement("pre", { style: { marginTop: 8, whiteSpace: "pre-wrap", fontSize: 11 } }, this.state.error?.stack || "")
      );
    }
    return this.props.children;
  }
}

// Динамический импорт — ловим ошибки модуля
import("./App.jsx")
  .then(({ default: App }) => {
    root.render(
      React.createElement(React.StrictMode, null,
        React.createElement(ErrorBoundary, null,
          React.createElement(App)
        )
      )
    );
  })
  .catch(showError);
