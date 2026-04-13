"use client";

import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

export default function ApiDocsPage() {
  return (
    <main style={{ padding: "16px", minHeight: "100vh", background: "#ffffff" }}>
      <style jsx global>{`
        .swagger-ui,
        .swagger-ui * {
          font-weight: 600 !important;
        }
      `}</style>
      <SwaggerUI url="/api/openapi" docExpansion="list" defaultModelsExpandDepth={1} />
    </main>
  );
}

