import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { PiAgentBridgeRuntime } from "./piAgentBridge.js";
import { listWorkspaceDirectories, loadWorkspaceFiles } from "./workspaceFiles.js";
import type { AgentBridgeInput } from "./types.js";

const host = "127.0.0.1";
const port = 4174;
const bridge = new PiAgentBridgeRuntime();

createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${host}:${port}`);

    if (request.method === "GET" && url.pathname === "/") {
      sendJson(response, 200, {
        name: "Emma Pi Agent Bridge",
        status: "ok",
        frontend: "http://127.0.0.1:5173",
        api: ["/api/files?root=<path>", "/api/directories?root=<path>", "/api/chat"]
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/files") {
      const root = url.searchParams.get("root");
      if (!root) {
        throw new Error("缺少工程目录 root 参数。");
      }

      const files = await loadWorkspaceFiles(root);
      sendJson(response, 200, files);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/directories") {
      const root = url.searchParams.get("root");
      if (!root) {
        throw new Error("缺少目录 root 参数。");
      }

      const listing = await listWorkspaceDirectories(root);
      sendJson(response, 200, listing);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/chat") {
      const input = (await readJson(request)) as AgentBridgeInput;
      const result = await bridge.run(input);
      sendJson(response, 200, result);
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}).listen(port, host, () => {
  console.log(`Pi Agent Bridge listening on http://${host}:${port}`);
});

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
