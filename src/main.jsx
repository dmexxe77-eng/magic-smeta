import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  componentDidCatch(error) {
    this.setState({ error });
  }
  render() {
    if (this.state.error) {
      const msg = this.state.error?.message || String(this.state.error);
      const stack = this.state.error?.stack;
      return (
        <div style={{ padding: 16, color: "#b00020", fontFamily: "monospace" }}>
          <h2 style={{ margin: "0 0 8px 0", fontSize: 14 }}>App crashed</h2>
          <div style={{ fontSize: 12, marginBottom: 8 }}>{msg}</div>
          {stack ? <pre style={{ whiteSpace: "pre-wrap" }}>{stack}</pre> : null}
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
