// 本地静态服务（原型自测用）：显式 no-store，避免 Chrome 对 Last-Modified 走启发式缓存，
// 改了 modules/*/pages.js 后刷新即生效，不必每次升 ?v= 才能看到改动。
//
// 用法：node tools/serve.mjs [port]   // 默认 4199，仅绑定 127.0.0.1
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";

const ROOT = resolve(process.cwd());
const PORT = Number(process.argv[2]) || 4199;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8"
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    if (url.pathname === "/favicon.ico") {   /* 原型不配图标，直接 204，免得审计台里挂一条无关 404 */
      res.writeHead(204, { "Cache-Control": "no-store" }).end();
      return;
    }
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const abs = normalize(join(ROOT, rel));
    if (abs !== ROOT && !abs.startsWith(ROOT + sep)) {
      res.writeHead(403, { "Cache-Control": "no-store" }).end("forbidden");
      return;
    }
    let target = abs;
    const st = await stat(target).catch(() => null);
    if (st && st.isDirectory()) target = join(target, "index.html");
    const body = await readFile(target);
    res.writeHead(200, {
      "Content-Type": MIME[extname(target).toLowerCase()] || "application/octet-stream",
      "Content-Length": body.length,
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    });
    res.end(body);
  } catch (err) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" })
      .end("404 " + (err && err.code ? err.code : "not found"));
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log("serve: http://127.0.0.1:" + PORT + "/index.html  (no-store, root=" + ROOT + ")");
});
