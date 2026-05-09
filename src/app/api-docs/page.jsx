"use client";


import "./page.module.css";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

export default function ApiDocsPage() {
  return (
    <main style={{ padding: "16px", minHeight: "100vh", background: "#ffffff" }}>
      
      <SwaggerUI url="/api/openapi" docExpansion="list" defaultModelsExpandDepth={1} />
    </main>
  );
}

