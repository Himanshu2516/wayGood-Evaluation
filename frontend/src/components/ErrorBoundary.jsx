import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-box" style={{ padding: "40px", textAlign: "center", margin: "20px auto", maxWidth: "600px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "12px" }}>
          <h2 style={{ color: "#991b1b", marginBottom: "12px" }}>Unable to load this section</h2>
          <p style={{ color: "#7f1d1d", marginBottom: "20px" }}>
            {this.state.error?.message || "An unexpected error occurred while rendering this page."}
          </p>
          <button
            className="btn-primary"
            onClick={this.handleReset}
            style={{ padding: "10px 20px" }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
