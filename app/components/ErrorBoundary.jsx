"use client";

import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || "Something went wrong.",
    };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div
            role="alert"
            style={{
              padding: 24,
              margin: 24,
              borderRadius: 12,
              border: "1px solid rgba(248,113,113,0.35)",
              background: "rgba(248,113,113,0.08)",
              color: "inherit",
              fontFamily: "inherit",
            }}
          >
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>Something went wrong</h2>
            <p style={{ fontSize: 13, opacity: 0.8, marginBottom: 12 }}>
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: "" })}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid rgba(99,102,241,0.35)",
                background: "rgba(99,102,241,0.12)",
                color: "inherit",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Try again
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
