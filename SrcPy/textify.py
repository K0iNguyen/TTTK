# textify.py
"""
Tiny helpers:
- html_to_markdown(url_or_html) -> {"title": str, "markdown": str}
- split_markdown(markdown, max_tokens=350) -> [chunk1, chunk2, ...]

If tiktoken is installed, max_tokens is accurate; otherwise we approximate by chars (~4 chars/token).
"""

from __future__ import annotations
import re, requests, os
from typing import Dict, List
from bs4 import BeautifulSoup
from readability import Document
import html2text
import numpy as np
# from openai import OpenAI
from sentence_transformers import SentenceTransformer
import faiss

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
    """Split Markdown by headings/paragraphs and pack into chunks under max_tokens."""
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

# def choose_chunks(highlight: str, chunks: List[str], top_k: int = 3) -> List[str]:
#     """Return top_k chunks most relevant to the highlight."""
#     api_key = ""
#     if not api_key:
#         raise ValueError("Missing OPENAI_API_KEY in environment variables")
    
#     client = OpenAI(api_key=api_key)

#     def embed(text: str):
#         resp = client.embeddings.create(
#             model="text-embedding-3-small",
#             input=text
#         )
#         return np.array(resp.data[0].embedding)

#     highlight_vec = embed(highlight)
#     chunk_vecs = [embed(c) for c in chunks]

#     sims = [
#         np.dot(highlight_vec, v) / (np.linalg.norm(highlight_vec) * np.linalg.norm(v))
#         for v in chunk_vecs
#     ]

#     ranked = sorted(zip(sims, chunks), key=lambda x: x[0], reverse=True)
#     return [chunk for _, chunk in ranked[:top_k]]

# Load a local embedding model
# (all-MiniLM-L6-v2 is small, fast, and good for semantic similarity)
embedder = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')

def choose_chunks(query, chunks, top_k=3):
    """
    Choose the top_k chunks most relevant to the query using local embeddings.
    No OpenAI API calls.
    """
    # Embed the query and chunks
    query_vec = embedder.encode([query], convert_to_numpy=True)
    chunk_vecs = embedder.encode(chunks, convert_to_numpy=True)

    # Build FAISS index
    dim = chunk_vecs.shape[1]
    index = faiss.IndexFlatL2(dim)
    index.add(chunk_vecs)

    # Search
    distances, indices = index.search(query_vec, top_k)

    # Return top_k chunks
    return [chunks[i] for i in indices[0]]
