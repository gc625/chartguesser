import { WebSocketServer } from "ws";
import type { Server } from "http";
import {
  getMatch, addPlayer, handleMessage, removePlayer, type Match, type Player,
} from "./match";

export function attachWs(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url || "", "http://x");
    if (!url.pathname.startsWith("/ws/")) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket as any, head, (ws) => wss.emit("connection", ws, req));
  });

  wss.on("connection", (ws, req) => {
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
        if (m.players.length >= 2) {
          ws.send(JSON.stringify({ type: "error", payload: { message: "Match is full" } }));
          return;
        }
        p = addPlayer(m, ws, msg.displayName);
        ws.send(JSON.stringify({ type: "joined", payload: { playerId: p.id, matchId: m.id } }));
        m.players.forEach((o) => o.ws.send(JSON.stringify({
          type: "playerJoined",
          payload: { players: m.players.map((x) => ({ id: x.id, name: x.name, ready: x.ready })), config: m.config },
        })));
      } else if (p) {
        try {
          await handleMessage(m, p, msg);
        } catch (e: any) {
          console.error(`[ws:${matchId}] handler error`, e?.message || e);
        }
      }
    });
    ws.on("close", () => {
      if (p) removePlayer(m, p);
    });
  });
}
