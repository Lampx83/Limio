import { subscribe, readSince, type StreamEvent } from "./stream";

// SSE Response helper.
// - Stream event từ Redis Streams ra client theo format SSE.
// - Heartbeat mỗi 15s (comment frame) để giữ kết nối qua proxy.
// - Resume từ Last-Event-ID header nếu client reconnect.
// - Slow client: dùng AbortSignal của request — khi client disconnect, signal abort,
//   subscribe() dừng, không leak connection. Backpressure không tự handle được ở
//   web standard Streams; nếu cần, đo qua metric writer.desiredSize sau.

const HEARTBEAT_MS = 15_000;

export function sseResponse(
  channel: string,
  req: Request,
): Response {
  const lastId = req.headers.get("last-event-id") ?? "0";
  const encoder = new TextEncoder();
  const ac = new AbortController();

  // Khi client đóng kết nối, request.signal abort → ta abort signal nội bộ.
  req.signal.addEventListener("abort", () => ac.abort());

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          ac.abort();
        }
      };

      const sendEvent = (ev: StreamEvent) => {
        send(`id: ${ev.id}\ndata: ${JSON.stringify(ev.data)}\n\n`);
      };

      // Cursor cho subscribe sau replay. "$" = chỉ event MỚI sau khi subscribe.
      // Nếu replay có event, dùng id event cuối cùng làm cursor để khỏi đọc lại.
      let cursor: string = lastId === "0" ? "$" : lastId;

      // 1. Replay event đã có sau lastId (nếu lastId != "0" thì là reconnect)
      try {
        if (lastId !== "0") {
          const missed = await readSince(channel, lastId, 500);
          for (const ev of missed) sendEvent(ev);
          const lastReplayed = missed[missed.length - 1];
          if (lastReplayed) cursor = lastReplayed.id;
        }
      } catch {
        // Nếu replay fail, vẫn tiếp tục stream live — không block
      }

      // 2. Heartbeat
      const hb = setInterval(() => {
        send(`: heartbeat\n\n`);
      }, HEARTBEAT_MS);

      // 3. Subscribe live
      try {
        for await (const batch of subscribe(channel, cursor, ac.signal)) {
          for (const ev of batch) sendEvent(ev);
        }
      } catch {
        // Generator chấm dứt
      } finally {
        clearInterval(hb);
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
    cancel() {
      ac.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Tắt buffering ở Nginx/Caddy
      "X-Accel-Buffering": "no",
    },
  });
}
