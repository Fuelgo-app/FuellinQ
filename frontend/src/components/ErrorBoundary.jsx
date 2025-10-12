// src/components/ErrorBoundary.jsx
import React from "react";

/**
 * ErrorBoundary component
 * Vangt runtime fouten op in React component tree en toont nette fallback.
 * Gebruik:
 *   <ErrorBoundary>
 *     <YourComponent />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("⚠️ React ErrorBoundary caught an error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            color: "#b00020",
            fontFamily: "sans-serif",
          }}
        >
          <h2>Er ging iets mis 😬</h2>
          <p>Probeer de pagina te herladen of later opnieuw.</p>
          {process.env.NODE_ENV === "development" && (
            <pre style={{ color: "#333", background: "#f4f4f4", padding: "1rem", borderRadius: "8px" }}>
              {String(this.state.error)}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
