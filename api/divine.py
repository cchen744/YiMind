# ============================================================================
# api/divine.py — Vercel Python Serverless Function
# ----------------------------------------------------------------------------
# Accepts a POST with JSON body:
#   {
#     "question": "...",
#     "ben":  { kw, zh_name, en_name, pinyin, lines: [0/1, ...] },
#     "bian": { kw, zh_name, en_name, pinyin, lines },
#     "hu":   { kw, zh_name, en_name, pinyin, lines },
#     "yaoValues": [6|7|8|9] * 6,     # bottom→top
#     "changingLines": [int, ...],    # indices 0..5 of old-yin/old-yang lines
#     "hasChanging": bool,
#     "lang": "zh" | "en"
#   }
#
# Forwards a streaming (SSE) chat completion from DeepSeek. The response is
# relayed as-is so the browser can reuse OpenAI-style SSE parsing.
#
# Env var required:  DEEPSEEK_API_KEY
# Optional:          DEEPSEEK_BASE_URL  (default https://api.deepseek.com)
#                    ALLOWED_ORIGIN     (CORS, default "*")
# ============================================================================

from http.server import BaseHTTPRequestHandler
import json
import os
import urllib.request
import urllib.error


DEEPSEEK_BASE = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/")
DEEPSEEK_MODEL = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "*")


def _lines_to_glyph(lines):
    """lines[0..5] bottom→top (0=broken, 1=solid) → 6-line ASCII glyph, top-down."""
    rows = []
    for v in reversed(lines):  # top → bottom display
        rows.append("━━━━━━━━" if v else "━━━    ━━━")
    return "\n".join(rows)


def _changing_pos(i, zh):
    """i ∈ 0..5, i=0 is 初, i=5 is 上."""
    if zh:
        return "初二三四五上"[i] + "爻"
    return f"line {i+1} (from the bottom)"


def build_messages(payload):
    lang = payload.get("lang", "zh")
    zh = (lang == "zh")
    q = payload.get("question", "")
    ben  = payload["ben"]
    bian = payload["bian"]
    hu   = payload["hu"]
    has_changing = payload.get("hasChanging", False)
    changing = payload.get("changingLines", [])
    yao_values = payload.get("yaoValues", [])

    # ---- System prompt: instruct the model to be rigorous & structured ----
    if zh:
        system = (
            "你是一位嫻熟《周易》的占卜師，依照朱熹《周易本義》及程頤《伊川易傳》的解卦傳統回答。"
            "給出的解讀必須：\n"
            "1) 分段解讀本卦（卦義、卦辭要旨）；\n"
            "2) 若有動爻，逐條解讀動爻的爻辭（以本卦之爻辭為主）；\n"
            "3) 解讀變卦（所趨向之情境）；\n"
            "4) 解讀互卦（事情發展中隱而未現的因素）；\n"
            "5) 最後結合所問之事給出具體指引；建議保持謙和謹慎，不作絕對判斷。\n"
            "請使用繁體中文，行文古雅而清晰，不超過 600 字。"
        )
    else:
        system = (
            "You are an experienced I Ching diviner, interpreting according to "
            "the classical tradition of Zhu Xi (Zhou Yi Ben Yi) and Cheng Yi "
            "(Yichuan Yi Zhuan). Structure your interpretation in sections: "
            "(1) the Original hexagram's meaning and core message; "
            "(2) each changing line if any, citing their line statements; "
            "(3) the Transformed hexagram as the situation's destination; "
            "(4) the Nuclear hexagram as hidden dynamics; "
            "(5) concrete guidance tied to the querent's question, advising "
            "humility and caution rather than absolutes. "
            "Keep the total under 500 words in clear, slightly classical English."
        )

    # ---- User prompt: the actual reading to interpret ----
    bridge_zh = (
        f"所問：{q}\n\n"
        f"本卦：{ben['zh_name']}（{ben['pinyin']} · {ben['en_name']} · King Wen #{ben['kw']}）\n"
        f"{_lines_to_glyph(ben['lines'])}\n\n"
    )
    bridge_en = (
        f"Question: {q}\n\n"
        f"Original hexagram: {ben['zh_name']} ({ben['pinyin']} · {ben['en_name']} · King Wen #{ben['kw']})\n"
        f"{_lines_to_glyph(ben['lines'])}\n\n"
    )
    text = bridge_zh if zh else bridge_en

    if has_changing:
        if zh:
            text += "動爻：" + "、".join(_changing_pos(i, True) for i in changing) + "\n"
            text += f"變卦：{bian['zh_name']}（{bian['pinyin']} · {bian['en_name']} · King Wen #{bian['kw']}）\n"
            text += _lines_to_glyph(bian["lines"]) + "\n\n"
        else:
            text += "Changing lines: " + ", ".join(_changing_pos(i, False) for i in changing) + "\n"
            text += f"Transformed hexagram: {bian['zh_name']} ({bian['pinyin']} · {bian['en_name']} · King Wen #{bian['kw']})\n"
            text += _lines_to_glyph(bian["lines"]) + "\n\n"
    else:
        text += ("六爻皆靜，無動爻。\n\n" if zh else "No changing lines.\n\n")

    if zh:
        text += f"互卦：{hu['zh_name']}（{hu['pinyin']} · {hu['en_name']} · King Wen #{hu['kw']}）\n"
        text += _lines_to_glyph(hu["lines"]) + "\n\n"
        text += f"六爻數值（由初至上）：{yao_values}\n"
    else:
        text += f"Nuclear hexagram: {hu['zh_name']} ({hu['pinyin']} · {hu['en_name']} · King Wen #{hu['kw']})\n"
        text += _lines_to_glyph(hu["lines"]) + "\n\n"
        text += f"Line values (bottom to top, in 6/7/8/9): {yao_values}\n"

    return [
        {"role": "system", "content": system},
        {"role": "user",   "content": text},
    ]


class handler(BaseHTTPRequestHandler):
    # Turn off default stdout access logs noise in Vercel logs
    def log_message(self, format, *args):  # noqa: A002
        pass

    # ---- CORS preflight ----
    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors()
        self.end_headers()

    def _send_cors(self):
        self.send_header("Access-Control-Allow-Origin", ALLOWED_ORIGIN)
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send_error(self, code, msg):
        self.send_response(code)
        self._send_cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps({"error": msg}, ensure_ascii=False).encode("utf-8"))

    def do_POST(self):
        # ---- Read request body ----
        try:
            n = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(n) if n > 0 else b""
            payload = json.loads(raw.decode("utf-8") or "{}")
        except Exception as e:
            return self._send_error(400, f"invalid JSON: {e}")

        api_key = os.environ.get("DEEPSEEK_API_KEY")
        if not api_key:
            return self._send_error(500, "API key not configured")

        # ---- Build messages ----
        try:
            messages = build_messages(payload)
        except KeyError as e:
            return self._send_error(400, f"missing field: {e}")

        body = {
            "model": DEEPSEEK_MODEL,
            "messages": messages,
            "stream": True,
            "temperature": 0.9,  # bit of prose variation is ok
            "max_tokens": 1200,
        }
        req = urllib.request.Request(
            f"{DEEPSEEK_BASE}/v1/chat/completions",
            data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "Accept": "text/event-stream",
            },
            method="POST",
        )

        # ---- Stream upstream response back to client as SSE ----
        try:
            upstream = urllib.request.urlopen(req, timeout=60)
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", errors="ignore")[:500]
            return self._send_error(e.code, f"Upstream HTTP {e.code}: {detail}")
        except Exception as e:
            return self._send_error(502, f"Upstream service unreachable: {e}")

        self.send_response(200)
        self._send_cors()
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache, no-transform")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()

        try:
            # Read in small chunks and forward verbatim.
            # urllib's response doesn't expose flushable iterator; use .read(n).
            while True:
                chunk = upstream.read(512)
                if not chunk:
                    break
                self.wfile.write(chunk)
                try:
                    self.wfile.flush()
                except Exception:
                    break
        finally:
            try: upstream.close()
            except Exception: pass
