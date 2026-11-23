"""Trafilatura article-text extraction as a Vercel Python function: POST /api/trafilatura.

The Node extractor chain (src/stages/extract/chain.ts) has already fetched the page; it posts the HTML here and
gets the main text back. Trafilatura is Python-only, so it runs as its own small function in the same project.
Auth: Authorization: Bearer RUN_SECRET (same as the run API).
Request: {"html": "...", "url": "https://..."}  Response: {"text": "..." | null, "version": "x.y.z"}
"""

import hmac
import json
import os
from http.server import BaseHTTPRequestHandler

import trafilatura

MAX_BODY = 8_000_000


def extract(html: str, url: str | None) -> str | None:
    return trafilatura.extract(
        html,
        url=url,
        include_comments=False,
        include_tables=False,
        include_images=False,
        favor_precision=True,
        deduplicate=True,
    )


class handler(BaseHTTPRequestHandler):
    def _send(self, status: int, body: dict) -> None:
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self) -> None:  # noqa: N802 (http.server naming)
        secret = os.environ.get("RUN_SECRET", "")
        given = self.headers.get("authorization", "")
        if not secret or not hmac.compare_digest(given, f"Bearer {secret}"):
            return self._send(401, {"error": "unauthorized"})
        length = int(self.headers.get("content-length") or 0)
        if length <= 0 or length > MAX_BODY:
            return self._send(400, {"error": "body missing or too large"})
        try:
            req = json.loads(self.rfile.read(length))
            html = req["html"]
        except (ValueError, KeyError, TypeError):
            return self._send(400, {"error": "expected JSON {html, url}"})
        try:
            text = extract(html, req.get("url"))
        except Exception as e:  # a page trafilatura can't parse is a normal outcome, not a server error
            return self._send(200, {"text": None, "error": str(e)[:300], "version": trafilatura.__version__})
        return self._send(200, {"text": text, "version": trafilatura.__version__})

    def do_GET(self) -> None:  # noqa: N802
        self._send(200, {"ok": True, "version": trafilatura.__version__})
