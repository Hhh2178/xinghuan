import { createServer } from "node:http";

const port = Number(process.env.XINGHUAN_PHASE2_MOCK_PORT || 18290);
const png1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l0e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const videoBytes = Buffer.from("00000018667479706d703432000000006d703432", "hex");

const server = createServer((request, response) => {
  if (request.url === "/asset.png") {
    response.writeHead(200, { "content-type": "image/png" });
    response.end(png1x1);
    return;
  }
  if (request.url === "/asset.mp4") {
    response.writeHead(200, { "content-type": "video/mp4" });
    response.end(videoBytes);
    return;
  }
  let text = "";
  request.on("data", (chunk) => {
    text += chunk;
  });
  request.on("end", () => {
    const body = text ? JSON.parse(text) : {};
    console.log(JSON.stringify({ method: request.method, url: request.url, model: body.model, prompt: body.prompt || "" }));
    response.writeHead(200, { "content-type": "application/json" });
    if (request.url === "/v1/chat/completions") {
      response.end(JSON.stringify({ choices: [{ message: { content: "Phase 2 LLM 节点连通成功" }, finish_reason: "stop" }] }));
      return;
    }
    if (request.url === "/v1/images/generations") {
      response.end(JSON.stringify({ data: [{ url: `http://127.0.0.1:${port}/asset.png` }] }));
      return;
    }
    if (request.url === "/v1/videos/generations") {
      response.end(JSON.stringify({ data: [{ url: `http://127.0.0.1:${port}/asset.mp4` }] }));
      return;
    }
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not_found" }));
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`phase2 mock provider listening on http://127.0.0.1:${port}`);
});
