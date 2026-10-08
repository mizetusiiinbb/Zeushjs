# CF Worker Obfuscator

A polished FastAPI web app for safely obfuscating JavaScript/Cloudflare Worker source code.

## Features
- Paste a raw GitHub URL or upload `.js`/`.mjs`
- Cloudflare Worker compatibility profile
- Identifier renaming
- String array + string encoding
- Dead-code injection
- Control-flow flattening (optional/aggressive)
- Self-defending/debug protection options
- Syntax validation before and after transformation
- Download the resulting JavaScript
- Docker/Railway ready
- No database required

## Run locally

```bash
docker compose up --build
```

Open http://localhost:8000

For a non-Docker environment, Node.js 20+ and Python 3.11+ are recommended.

## Important

Obfuscation is not encryption. It increases reverse-engineering cost but cannot make JavaScript secret. Always test the generated Worker before production deployment.
