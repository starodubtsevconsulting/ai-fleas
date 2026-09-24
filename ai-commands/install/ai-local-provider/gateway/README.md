# Local model browser gateway

The gateway gives an API-only local model server a small same-origin browser chat while preserving its OpenAI-compatible `/v1` routes. It has no external runtime dependencies beyond Node.js.

Run the model server on a loopback-only upstream port, then expose the gateway on the public/tunnel origin port:

```sh
node local-model-gateway.mjs \
  --listen-host 0.0.0.0 \
  --listen-port 8000 \
  --upstream http://127.0.0.1:8001
```

`GET /gateway-health` returns `200` only when the upstream model list is ready. `/`, `/index.html`, and the UI assets are served with no-cache headers so a UI previously hosted on the same origin cannot mask the active runtime. Every other request is streamed to the fixed loopback upstream, including chat completion SSE responses.

The gateway is deliberately not an authentication boundary. Protect its public origin with the profile-selected access layer and keep the model upstream bound to loopback.

Run `install.sh` to copy the two runtime files into the current user's XDG data directory. Pass an absolute destination as its only argument when a profile declares a different install root.
