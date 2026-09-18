export interface EndpointParameter {
  name: string;
  in: string; // "path" | "query" | "header" | "cookie"
  required: boolean;
  type: string;
  description?: string;
}

export interface EndpointResponse {
  status: string | number;
  description: string;
}

export interface ParsedEndpoint {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";
  path: string;
  summary: string;
  description?: string;
  parameters: EndpointParameter[];
  requestBody?: {
    contentType: string;
    description?: string;
  };
  responses: EndpointResponse[];
  tags: string[];
}

export interface ParsedOpenAPI {
  title: string;
  version: string;
  baseUrl: string;
  endpoints: ParsedEndpoint[];
}

/**
 * Lightweight JSON & YAML-aware OpenAPI spec parser
 */
export function parseOpenAPISpec(content: string): ParsedOpenAPI | null {
  if (!content || !content.trim()) return null;

  let specObj: any = null;

  // 1. Try parsing as JSON first
  try {
    specObj = JSON.parse(content);
  } catch {
    // 2. If JSON fails, attempt basic YAML-to-object parsing or regex extraction
    specObj = parseSimpleYamlOrRegex(content);
  }

  if (!specObj) return null;

  const title = specObj.info?.title || "API Documentation";
  const version = specObj.info?.version || "1.0.0";
  let baseUrl = "";

  if (Array.isArray(specObj.servers) && specObj.servers.length > 0) {
    baseUrl = specObj.servers[0].url || "";
  } else if (specObj.host) {
    const scheme = (specObj.schemes && specObj.schemes[0]) || "https";
    const basePath = specObj.basePath || "";
    baseUrl = `${scheme}://${specObj.host}${basePath}`;
  }

  const endpoints: ParsedEndpoint[] = [];
  const paths = specObj.paths || {};

  const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "options", "head"] as const;

  for (const [pathKey, pathItem] of Object.entries<any>(paths)) {
    if (!pathItem || typeof pathItem !== "object") continue;

    for (const m of HTTP_METHODS) {
      const op = pathItem[m];
      if (!op || typeof op !== "object") continue;

      const method = m.toUpperCase() as ParsedEndpoint["method"];
      const summary = op.summary || op.description || `${method} ${pathKey}`;
      const description = op.description;
      const tags: string[] = Array.isArray(op.tags) && op.tags.length > 0 ? op.tags : ["General"];

      // Parameters
      const parameters: EndpointParameter[] = [];
      const combinedParams = [
        ...(Array.isArray(pathItem.parameters) ? pathItem.parameters : []),
        ...(Array.isArray(op.parameters) ? op.parameters : []),
      ];

      for (const p of combinedParams) {
        if (!p || !p.name) continue;
        const pType = p.schema?.type || p.type || "string";
        parameters.push({
          name: p.name,
          in: p.in || "query",
          required: Boolean(p.required),
          type: pType,
          description: p.description,
        });
      }

      // Request Body
      let requestBody: ParsedEndpoint["requestBody"];
      if (op.requestBody?.content) {
        const firstContentType = Object.keys(op.requestBody.content)[0] || "application/json";
        requestBody = {
          contentType: firstContentType,
          description: op.requestBody.description,
        };
      }

      // Responses
      const responses: EndpointResponse[] = [];
      if (op.responses && typeof op.responses === "object") {
        for (const [statusCode, resObj] of Object.entries<any>(op.responses)) {
          responses.push({
            status: statusCode,
            description: (resObj && resObj.description) || "Response",
          });
        }
      }

      endpoints.push({
        method,
        path: pathKey,
        summary,
        description,
        parameters,
        requestBody,
        responses,
        tags,
      });
    }
  }

  return {
    title,
    version,
    baseUrl,
    endpoints,
  };
}

/**
 * Fallback parser for YAML OpenAPI specifications
 */
function parseSimpleYamlOrRegex(yaml: string): any {
  // Check if it's an OpenAPI or Swagger file
  if (!yaml.includes("openapi:") && !yaml.includes("swagger:")) {
    return null;
  }

  const spec: any = {
    info: { title: "API Documentation", version: "1.0.0" },
    paths: {},
  };

  const titleMatch = yaml.match(/title:\s*["']?([^"'\r\n]+)["']?/i);
  if (titleMatch) spec.info.title = titleMatch[1].trim();

  const versionMatch = yaml.match(/version:\s*["']?([^"'\r\n]+)["']?/i);
  if (versionMatch) spec.info.version = versionMatch[1].trim();

  const hostMatch = yaml.match(/host:\s*["']?([^"'\r\n]+)["']?/i);
  if (hostMatch) spec.host = hostMatch[1].trim();

  const urlMatch = yaml.match(/url:\s*["']?([^"'\r\n]+)["']?/i);
  if (urlMatch) spec.servers = [{ url: urlMatch[1].trim() }];

  // Extract paths and methods via line scanner
  const lines = yaml.split(/\r?\n/);
  let inPaths = false;
  let currentPath = "";
  let currentMethod = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (/^paths\s*:/.test(line)) {
      inPaths = true;
      continue;
    }

    if (inPaths && /^([a-zA-Z0-9_-]+)\s*:/.test(line) && !line.startsWith(" ") && !line.startsWith("\t")) {
      // exited paths section
      break;
    }

    if (!inPaths) continue;

    // Path pattern: "  /api/v1/users:"
    const pathMatch = line.match(/^ {2}(\/[^:]+):/);
    if (pathMatch) {
      currentPath = pathMatch[1].trim();
      if (!spec.paths[currentPath]) spec.paths[currentPath] = {};
      continue;
    }

    // Method pattern: "    get:"
    const methodMatch = line.match(/^ {4}(get|post|put|patch|delete|options|head):/i);
    if (methodMatch && currentPath) {
      currentMethod = methodMatch[1].toLowerCase();
      spec.paths[currentPath][currentMethod] = {
        summary: "",
        tags: [],
        responses: { 200: { description: "Success" } },
      };
      continue;
    }

    // Summary inside method
    if (currentPath && currentMethod) {
      const summaryMatch = line.match(/^ {6}summary:\s*["']?([^"'\r\n]+)["']?/i);
      if (summaryMatch) {
        spec.paths[currentPath][currentMethod].summary = summaryMatch[1].trim();
      }

      const descMatch = line.match(/^ {6}description:\s*["']?([^"'\r\n]+)["']?/i);
      if (descMatch && !spec.paths[currentPath][currentMethod].summary) {
        spec.paths[currentPath][currentMethod].summary = descMatch[1].trim();
      }
    }
  }

  return spec;
}

/**
 * Formats a ParsedOpenAPI structure into clean, beautifully structured markdown.
 */
export function endpointsToMarkdown(parsed: ParsedOpenAPI): string {
  if (!parsed.endpoints || parsed.endpoints.length === 0) {
    return "";
  }

  const lines: string[] = [];
  lines.push(`## 📡 API Reference (${parsed.title} v${parsed.version})`);
  lines.push("");
  if (parsed.baseUrl) {
    lines.push(`> **Base URL**: \`${parsed.baseUrl}\``);
    lines.push("");
  }

  // Group endpoints by tag
  const grouped = new Map<string, ParsedEndpoint[]>();
  for (const ep of parsed.endpoints) {
    const tag = ep.tags[0] || "General";
    if (!grouped.has(tag)) grouped.set(tag, []);
    grouped.get(tag)!.push(ep);
  }

  for (const [tag, endpoints] of grouped.entries()) {
    lines.push(`### ${tag}`);
    lines.push("");
    lines.push("| Method | Endpoint | Description | Status |");
    lines.push("| :--- | :--- | :--- | :--- |");

    for (const ep of endpoints) {
      const badge = getMethodBadge(ep.method);
      const responsesPreview = ep.responses.map((r) => `\`${r.status}\``).join(", ") || "`200`";
      lines.push(`| ${badge} | \`${ep.path}\` | ${ep.summary.replace(/\|/g, "\\|")} | ${responsesPreview} |`);
    }
    lines.push("");

    // Add cURL snippet examples inside collapsible details
    for (const ep of endpoints.slice(0, 3)) {
      lines.push(`<details>`);
      lines.push(`<summary><b>Example Request:</b> <code>${ep.method} ${ep.path}</code></summary>`);
      lines.push("");
      lines.push("```bash");
      const host = parsed.baseUrl || "https://api.example.com";
      if (ep.method === "GET") {
        lines.push(`curl -X GET "${host}${ep.path}" \\`);
        lines.push(`  -H "Accept: application/json"`);
      } else {
        lines.push(`curl -X ${ep.method} "${host}${ep.path}" \\`);
        lines.push(`  -H "Content-Type: application/json" \\`);
        lines.push(`  -d '{"example": "value"}'`);
      }
      lines.push("```");
      lines.push("");
      lines.push("</details>");
      lines.push("");
    }
  }

  return lines.join("\n");
}

function getMethodBadge(method: string): string {
  switch (method) {
    case "GET":
      return `\`GET\``;
    case "POST":
      return `\`POST\``;
    case "PUT":
      return `\`PUT\``;
    case "PATCH":
      return `\`PATCH\``;
    case "DELETE":
      return `\`DELETE\``;
    default:
      return `\`${method}\``;
  }
}
