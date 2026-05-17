// Test page tối thiểu — mở 2 tab cùng URL, 1 tab post event, tab kia thấy nhận.
// Đường dẫn: /api/realtime-demo/<bất-kỳ-id>/test

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const id = params.id;
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Realtime demo ${id}</title>
<style>
  body { font-family: ui-monospace, monospace; padding: 16px; max-width: 720px; margin: 0 auto; }
  #log { background: #111; color: #0f0; padding: 12px; min-height: 240px; white-space: pre-wrap; overflow-y: auto; max-height: 60vh; }
  input, button { font: inherit; padding: 8px; }
  input { width: 60%; }
  .row { margin: 12px 0; display: flex; gap: 8px; }
</style></head>
<body>
  <h2>SSE demo · channel <code>demo:${id}</code></h2>
  <p>Mở 2 tab cùng URL này. Tab nào gõ + Send sẽ broadcast tới mọi tab.</p>
  <div class="row">
    <input id="msg" placeholder="Gõ gì đó rồi Enter..." autofocus />
    <button id="send">Send</button>
  </div>
  <div id="log"></div>
<script>
  const log = (s) => { const el = document.getElementById('log'); el.textContent += s + '\\n'; el.scrollTop = el.scrollHeight; };
  const id = ${JSON.stringify(id)};
  const es = new EventSource('/api/realtime-demo/' + id + '/stream');
  es.onopen = () => log('[open] connected');
  es.onerror = () => log('[error] reconnecting...');
  es.onmessage = (e) => log('[event ' + e.lastEventId + '] ' + e.data);

  async function send() {
    const input = document.getElementById('msg');
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    const res = await fetch('/api/realtime-demo/' + id + '/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg }),
    });
    if (!res.ok) log('[POST ' + res.status + '] ' + await res.text());
  }
  document.getElementById('send').onclick = send;
  document.getElementById('msg').addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
</script>
</body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
