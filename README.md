# YiMind · 易心

A bilingual (English / 繁體中文) IChing 大衍筮法 divination web app, designed to be embedded in the CLACC (Chinese Language & Culture Club) website at [claccuw.com](https://www.claccuw.com/). Users perform an authentic yarrow-stalk divination by clicking to split the stalk pile, and receive an interpretation of 本卦 / 變卦 / 互卦 from the DeepSeek API.

## Architecture

```
┌────────────────────────┐        ┌──────────────────────────┐       ┌────────────────┐
│  Wix page (claccuw)    │        │  Vercel Serverless API   │       │  DeepSeek API  │
│   <iframe src=...>     │  HTTPS │  /api/divine  (SSE proxy)│  HTTPS│ deepseek-chat  │
│   YiMind frontend      │◀──────▶│  Hides DEEPSEEK_API_KEY  │◀─────▶│                │
└────────────────────────┘        └──────────────────────────┘       └────────────────┘
```

- **Frontend** (`frontend/index.html`) — single-file HTML/CSS/JS. The 大衍筮法 algorithm runs entirely in the browser (no secrets involved), then the resulting hexagrams + user question are POSTed to the proxy.
- **Backend** (`api/divine.py`) — Vercel Python serverless function. Reads `DEEPSEEK_API_KEY` from environment, forwards to DeepSeek with streaming enabled, relays Server-Sent Events back to the frontend.
- **Algorithm** (`lib/dayan.js`) — strict 大衍筮法: 50 stalks, 49 in play, three 變 per 爻, eighteen 變 per 卦, old yin / young yang semantics intact.
- **Data** (`data/hexagrams.json`) — all 64 卦 with 卦名 (bilingual), 卦辭, 爻辭.

## Repo layout

```
frontend/index.html        # the embeddable page
api/divine.py              # Vercel serverless proxy to DeepSeek
lib/dayan.js               # 大衍筮法 algorithm (runs in browser)
lib/hexagram.js            # 本卦 / 變卦 / 互卦 derivation, lookup
data/hexagrams.json        # 64-hexagram database (zh + en)
tests/test_dayan.html      # in-browser probability distribution test
vercel.json                # Vercel config
.env.example               # template for DEEPSEEK_API_KEY
```

## Deploy (quick version)

1. Push to GitHub.
2. Import the repo in Vercel → set env var `DEEPSEEK_API_KEY`.
3. Copy the Vercel URL (e.g. `yimind.vercel.app`) into `frontend/index.html`'s `API_BASE`.
4. In Wix, add an **HTML iframe** block pointing to `https://yimind.vercel.app/`, or embed the `frontend/index.html` source directly.

See `DEPLOY.md` (coming up) for full instructions.
