const serverUrl =
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Slide2Notes API",
    version: "1.0.0",
    description:
      "Manual OpenAPI documentation for the Slide2Notes Next.js route handlers.",
  },
  servers: [
    {
      url: serverUrl,
      description: "Application server",
    },
  ],
  tags: [
    { name: "Auth" },
    { name: "Documents" },
    { name: "Summaries" },
    { name: "Chat" },
  ],
  components: {
    securitySchemes: {
      sessionAuth: {
        type: "apiKey",
        in: "cookie",
        name: "next-auth.session-token",
        description:
          "Authenticated session cookie from NextAuth (or __Secure-next-auth.session-token in production).",
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string" },
        },
        required: ["error"],
      },
      LoginRequest: {
        type: "object",
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string" },
        },
        required: ["email", "password"],
      },
      RegisterRequest: {
        type: "object",
        properties: {
          email: { type: "string", format: "email" },
          username: { type: "string" },
          password: { type: "string" },
          role: { type: "string", example: "Student" },
        },
        required: ["email", "username", "password"],
      },
      DocumentItem: {
        type: "object",
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          type: { type: "string", example: "PDF" },
          size: { type: "integer" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      SummaryItem: {
        type: "object",
        properties: {
          id: { type: "integer" },
          title: { type: "string" },
          model: { type: "string", example: "chatgpt:gpt-4o" },
          summarizeFor: { type: "string", example: "student" },
          output: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      SummarizeRequest: {
        type: "object",
        properties: {
          documentIds: {
            type: "array",
            items: { type: "integer" },
          },
          model: {
            type: "string",
            enum: ["chatgpt", "deepseek", "gemini"],
          },
          modelVariant: { type: "string", nullable: true },
          summarizeFor: {
            type: "string",
            enum: ["lecturer", "student"],
          },
          prompt: { type: "string", nullable: true },
        },
        required: ["documentIds", "model", "summarizeFor"],
      },
      ChatMessage: {
        type: "object",
        properties: {
          role: {
            type: "string",
            enum: ["user", "assistant"],
          },
          content: { type: "string" },
        },
        required: ["role", "content"],
      },
      ChatRequest: {
        type: "object",
        properties: {
          summaryId: { type: "integer" },
          model: {
            type: "string",
            enum: ["chatgpt", "deepseek", "gemini"],
          },
          modelLabel: { type: "string", nullable: true },
          messages: {
            type: "array",
            items: { $ref: "#/components/schemas/ChatMessage" },
          },
          documentIds: {
            type: "array",
            items: { type: "integer" },
          },
        },
        required: ["summaryId", "model", "messages"],
      },
    },
  },
  paths: {
    "/api/login": {
      post: {
        tags: ["Auth"],
        summary: "Sign in with credentials",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" },
            },
          },
        },
        responses: {
          "200": { description: "Login success" },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/register": {
      post: {
        tags: ["Auth"],
        summary: "Create an account",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RegisterRequest" },
            },
          },
        },
        responses: {
          "200": { description: "Registration success" },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/documents": {
      get: {
        tags: ["Documents"],
        summary: "List uploaded documents for current user",
        security: [{ sessionAuth: [] }],
        responses: {
          "200": {
            description: "Documents fetched",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    documents: {
                      type: "array",
                      items: { $ref: "#/components/schemas/DocumentItem" },
                    },
                  },
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/documents/{id}": {
      get: {
        tags: ["Documents"],
        summary: "Get document metadata by id",
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": { description: "Document metadata" },
          "404": { description: "Document not found" },
        },
      },
      delete: {
        tags: ["Documents"],
        summary: "Delete a document by id",
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": { description: "Document deleted" },
          "404": { description: "Document not found" },
        },
      },
    },
    "/api/upload": {
      post: {
        tags: ["Documents"],
        summary: "Upload one or more documents",
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  files: {
                    type: "array",
                    items: {
                      type: "string",
                      format: "binary",
                    },
                  },
                  renameFlags: {
                    type: "string",
                    description: "JSON array of booleans as string",
                    example: "[true,false]",
                  },
                },
                required: ["files"],
              },
            },
          },
        },
        responses: {
          "200": { description: "Files uploaded and saved" },
          "400": { description: "No files provided" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/api/summarize": {
      post: {
        tags: ["Summaries"],
        summary: "Generate a summary from selected documents",
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SummarizeRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Summary generated",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    summary: { $ref: "#/components/schemas/SummaryItem" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/history": {
      get: {
        tags: ["Summaries"],
        summary: "Fetch summary history for current user",
        security: [{ sessionAuth: [] }],
        responses: {
          "200": {
            description: "History fetched",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    summaries: {
                      type: "array",
                      items: { $ref: "#/components/schemas/SummaryItem" },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/api/summary/{id}": {
      get: {
        tags: ["Summaries"],
        summary: "Fetch one summary by id",
        security: [{ sessionAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": { description: "Summary found" },
          "404": { description: "Summary not found" },
        },
      },
    },
    "/api/chat": {
      post: {
        tags: ["Chat"],
        summary: "Continue chat for an existing summary",
        security: [{ sessionAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ChatRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Chat response generated",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    reply: { type: "string" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
  },
};

