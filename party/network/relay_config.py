"""Skinforge party relay configuration.

The relay is a Cloudflare Worker (source in `relay-worker/`) that hosts
party rooms using Durable Objects. Each room is keyed by a SHA-256 hash
derived from the host's summoner ID + encryption key.

To deploy your own relay:
    cd relay-worker
    npx wrangler login
    npx wrangler deploy

Then update RELAY_URL below with the deployed URL (use wss:// scheme,
not https://, since the client opens a WebSocket).
"""

RELAY_URL = "wss://skinforge-party-relay.hosnyemad-5.workers.dev"
