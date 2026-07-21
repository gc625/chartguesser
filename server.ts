import { createServer } from "http";
import next from "next";
import { attachWs } from "./src/lib/ws";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT) || 3000;
const app = next({ dev });
const handle = app.getRequestHandler();

(async () => {
  await app.prepare();
  const server = createServer((req, res) => handle(req, res));
  attachWs(server);
  server.listen(port, () => console.log(`> Ready on http://localhost:${port} (dev=${dev})`));
})();
