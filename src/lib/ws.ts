import { WebSocketServer } from "ws";
import type { Server } from "http";
import {
  getMatch, joinPlayer, syncPlayer, handleMessage, disconnectPlayer, type Match, type Player,
} from "./match";

export function attachWs(server: Server) {
  const wss = new WebSocketServer({ noServer: true });
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws: any) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);
  heartbeat.unref?.();
  server.on("close", () => clearInterval(heartbeat));

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url || "", "http://x");
    if (!url.pathname.startsWith("/ws/")) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket as any, head, (ws) => wss.emit("connection", ws, req));
  });

  wss.on("connection", (ws, req) => {
    (ws as any).isAlive = true;
    ws.on("pong", () => { (ws as any).isAlive = true; });
    const url = new URL(req.url || "", "http://x");
    const matchId = url.pathname.replace(/^\/ws\//, "");
    const m: Match | undefined = getMatch(matchId);
    if (!m) {
      ws.send(JSON.stringify({ type: "error", payload: { message: "Match not found" } }));
      ws.close();
      return;
    }
    let p: Player | null = null;
    ws.on("message", async (raw) => {
      let msg: any;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      console.log(`[ws:${matchId}] ${msg.type} from ${p?.name ?? "?"}`);
      if (msg.type === "join") {
        if (p) return;
        const sessionId = typeof msg.sessionId === "string" ? msg.sessionId.slice(0, 100) : "";
        if (!sessionId) {
          ws.send(JSON.stringify({ type: "error", payload: { message: "Invalid player session" } }));
          ws.close();
          return;
        }
        const displayName = typeof msg.displayName === "string" ? msg.displayName : "";
        const joined = joinPlayer(m, ws, displayName, sessionId);
        if (!joined) {
          const message = m.state === "lobby" ? "Match is full" : "Match has already started";
          ws.send(JSON.stringify({ type: "error", payload: { message } }));
          ws.close();
          return;
        }
        p = joined.player;
        syncPlayer(m, p);
        m.players.forEach((o) => {
          if (o.ws?.readyState !== 1) return;
          o.ws.send(JSON.stringify({
            type: "playerJoined",
            payload: {
              players: m.players.map((x) => ({
                id: x.id, name: x.name, ready: x.ready, connected: x.ws?.readyState === 1,
              })),
              config: m.config,
            },
          }));
        });
      } else if (p) {
        try {
          await handleMessage(m, p, msg);
        } catch (e: any) {
          console.error(`[ws:${matchId}] handler error`, e?.message || e);
        }
      }
    });
    ws.on("close", () => {
      if (p) disconnectPlayer(m, p, ws);
    });
  });
}
