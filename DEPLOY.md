# Deploying YiMind

Three steps: push to GitHub → deploy to Vercel → embed in Wix.

## 0. First-time setup — push this project to your YiMind repo

This repo was prepared in your local workspace. Replace the existing content of `github.com/cchen744/YiMind` with it.

```bash
cd "<path to IChing and web extension.>"

# If YiMind was already cloned locally, wipe the old tree first (keep .git).
# Example (adjust path):
#   cd ~/code/YiMind
#   git rm -r --ignore-unmatch .
#   cp -R "<workspace>/." .

# Otherwise, initialize fresh and push:
git init
git add .
git commit -m "YiMind v0: 大衍筮法 + DeepSeek interpretation"
git branch -M main
git remote add origin https://github.com/cchen744/YiMind.git
git push -u origin main --force   # --force wipes any old content
```

## 1. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import `cchen744/YiMind`.
2. When prompted for project settings, **leave them at defaults**. Vercel will detect `vercel.json`.
3. Under **Environment Variables**, add:
   - `DEEPSEEK_API_KEY` = your key from [platform.deepseek.com](https://platform.deepseek.com/)
   - (Optional) `ALLOWED_ORIGIN` = `https://www.claccuw.com` — once you've embedded on Wix, set this to restrict CORS to your site only. For initial testing, leave unset (defaults to `*`).
4. Click **Deploy**. You'll get a URL like `https://yimind.vercel.app`.
5. Open that URL — you should see the intro page. Enter a question and step through a full divination to confirm DeepSeek streaming works.

Future pushes to `main` auto-deploy.

### Local dev (optional)

```bash
npm i -g vercel
cp .env.example .env.local         # fill in DEEPSEEK_API_KEY
vercel dev                          # http://localhost:3000
```

## 2. Embed in Wix

In the Wix editor:

1. Add an element → **Embed Code → Embed HTML (iframe)**.
2. Set the URL to `https://yimind.vercel.app/`.
3. Resize the iframe: width 100%, height ~900px (tall enough for the divining screen without scrollbars on desktop).
4. Publish.

### Alternative: embed the HTML fragment directly

If you prefer not to iframe, you can instead drop an **HTML block** into Wix containing only the visible portion, and have the JS fetch directly from `https://yimind.vercel.app/api/divine`. But this requires inlining all CSS + JS into the block, which loses the clean module separation. Recommend iframe.

### CORS lockdown

Once the iframe is live and working, tighten CORS:
- Vercel → Settings → Env Variables → add `ALLOWED_ORIGIN=https://www.claccuw.com` (include `https://editor.wix.com` if you want Wix preview to work).
- Redeploy.

## 3. Verification checklist

- [ ] Home page loads at `/`
- [ ] Language toggle switches between 繁體中文 and English
- [ ] Entering a question and clicking "Begin" shows the stalk canvas
- [ ] Clicking the stalks 18 times builds a hexagram (progress counter advances)
- [ ] Result screen shows 本/變/互卦 (變卦 hidden if no changing lines)
- [ ] Clicking "Ask DeepSeek" streams text character-by-character
- [ ] `tests/test_dayan.html` shows all tests PASS when opened in browser
- [ ] `node tests/run_tests.mjs` shows `ALL PASS` in a local terminal

## 4. Cost & rate limits

DeepSeek V3 (`deepseek-chat`) is ~$0.14/M input tokens, $0.28/M output tokens. A single divination uses ~500 input + ~600 output tokens → under $0.0003 per reading. A busy month (10,000 readings) is under $3. Vercel Hobby plan has 100 GB-hours of serverless execution per month — each interpretation call is <5 seconds wall-clock, so you can serve tens of thousands of readings free.

## 5. Known limitations / future ideas

- **Hexagram data is minimal.** `data/hexagrams.json` currently has names + pinyin only, no 卦辭/爻辭. DeepSeek supplies those from its training. If you want the reading strictly bound to a specific classical source (e.g. 《周易本義》), extend the JSON and add the text into the system prompt.
- **No reading history.** Each divination is stateless. If you want to record user questions/results, add a Vercel KV binding.
- **Mobile click accuracy on a 600px pile with 49 stalks is fiddly.** Consider adding a "long-press then release" gesture that shows the split position in real time before committing.
