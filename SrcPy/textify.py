# textify.py
"""
Tiny helpers:
- html_to_markdown(url_or_html) -> {"title": str, "markdown": str}
- split_markdown(markdown, max_tokens=350) -> [chunk1, chunk2, ...]

If tiktoken is installed, max_tokens is accurate; otherwise we approximate by chars (~4 chars/token).
"""

from __future__ import annotations
import re, requests
from typing import Dict, List
from bs4 import BeautifulSoup
from readability import Document
import html2text

try:
    import tiktoken
    _enc = tiktoken.get_encoding("cl100k_base")
    def _tok_len(s: str) -> int: return len(_enc.encode(s))
    _TOK = True
except Exception:
    def _tok_len(s: str) -> int: return max(1, len(s) // 4)
    _TOK = False


def html_to_markdown(url_or_html: str) -> Dict[str, str]:
    """Fetch/clean HTML, keep main article, convert to Markdown."""
    html = requests.get(url_or_html).text if url_or_html.startswith(("http://", "https://")) else url_or_html

    # Strip obvious boilerplate early
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "noscript", "iframe", "svg"]):
        tag.decompose()
    cleaned_html = str(soup)

    # Main content extraction
    doc = Document(cleaned_html)
    title = (doc.short_title() or (soup.title.string if soup.title else "")).strip()
    main_html = doc.summary(html_partial=True) or (soup.body.decode() if soup.body else cleaned_html)

    # HTML -> Markdown
    h2t = html2text.HTML2Text()
    h2t.ignore_links = False
    h2t.ignore_images = True
    md = h2t.handle(main_html)

    # Normalize whitespace
    md = re.sub(r"[ \t]+\n", "\n", md)
    md = re.sub(r"\n{3,}", "\n\n", md).strip()

    return {"title": title, "markdown": md}


def split_markdown(md: str, max_tokens: int = 350) -> List[str]:
    """Split Markdown by headings/paragraphs and pack into chunks under ~max_tokens."""
    # 1) split by headings to keep structure, then paragraphs
    blocks = re.split(r"(?m)^#{1,6}\s+.*$", md)
    paras: List[str] = []
    for b in blocks:
        for p in re.split(r"\n\s*\n", b):
            p = p.strip()
            if p:
                paras.append(p)

    # 2) pack paragraphs into chunks under the token cap
    chunks: List[str] = []
    buf, buf_tok = [], 0
    for p in paras:
        t = _tok_len(p)

        # if a single paragraph is too big, split roughly by sentences
        if t > max_tokens:
            sentences = re.split(r"(?<=[.!?])\s+", p)
            cur, cur_tok = [], 0
            for s in sentences:
                st = _tok_len(s)
                if cur and cur_tok + st > max_tokens:
                    chunks.append(" ".join(cur))
                    cur, cur_tok = [], 0
                cur.append(s)
                cur_tok += st
            if cur:
                chunks.append(" ".join(cur))
            continue

        # normal packing
        if buf and buf_tok + t > max_tokens:
            chunks.append("\n\n".join(buf))
            buf, buf_tok = [], 0
        buf.append(p)
        buf_tok += t

    if buf:
        chunks.append("\n\n".join(buf))
    return chunks
