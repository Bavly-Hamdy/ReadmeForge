import { describe, it, expect } from "vitest";
import { parseOpenAPISpec, endpointsToMarkdown } from "../openapi/parser";

describe("OpenAPI / Swagger Specification Parser", () => {
  it("parses valid OpenAPI 3.0 JSON specification", () => {
    const sampleSpec = JSON.stringify({
      openapi: "3.0.0",
      info: { title: "Petstore API", version: "2.1.0" },
      servers: [{ url: "https://api.petstore.com/v1" }],
      paths: {
        "/pets": {
          get: {
            tags: ["Pets"],
            summary: "List all pets in inventory",
            responses: { "200": { description: "Array of pet items" } },
          },
          post: {
            tags: ["Pets"],
            summary: "Create a new pet",
            requestBody: {
              content: { "application/json": {} },
            },
            responses: { "201": { description: "Pet created" } },
          },
        },
      },
    });

    const parsed = parseOpenAPISpec(sampleSpec);
    expect(parsed).not.toBeNull();
    expect(parsed?.title).toBe("Petstore API");
    expect(parsed?.version).toBe("2.1.0");
    expect(parsed?.baseUrl).toBe("https://api.petstore.com/v1");
    expect(parsed?.endpoints.length).toBe(2);

    const getEp = parsed?.endpoints.find((e) => e.method === "GET");
    expect(getEp).toBeDefined();
    expect(getEp?.path).toBe("/pets");
    expect(getEp?.summary).toBe("List all pets in inventory");
  });

  it("converts parsed endpoints to clean GitHub Flavored Markdown table", () => {
    const parsed = {
      title: "Store API",
      version: "1.0.0",
      baseUrl: "https://api.store.com",
      endpoints: [
        {
          method: "GET" as const,
          path: "/items",
          summary: "Fetch store catalog",
          parameters: [],
          responses: [{ status: 200, description: "OK" }],
          tags: ["Inventory"],
        },
      ],
    };

    const md = endpointsToMarkdown(parsed);
    expect(md).toContain("## 📡 API Reference (Store API v1.0.0)");
    expect(md).toContain("| Method | Endpoint | Description | Status |");
    expect(md).toContain("`GET`");
    expect(md).toContain("`/items`");
    expect(md).toContain("Fetch store catalog");
    expect(md).toContain("curl -X GET");
  });
});
