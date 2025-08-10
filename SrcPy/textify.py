# textify.py
"""
Tiny helpers:
- html_to_markdown(url_or_file) -> {"title": str, "markdown": str}
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

import requests

def is_pdf_url(url: str) -> bool:
    """Check if the URL points to a PDF by extension or content-type."""
    # Quick check by extension or known pattern
    if url.lower().endswith('.pdf') or 'arxiv.org/pdf/' in url.lower():
        return True
    
    try:
        # Send a HEAD request to check headers without downloading full content
        response = requests.head(url, allow_redirects=True, timeout=5)
        content_type = response.headers.get("Content-Type", "").lower()
        return "application/pdf" in content_type
    except requests.RequestException:
        return False


def extract_text_from_pdf(url: str) -> str:
    """Extract text from PDF using pdfminer.six."""
    from io import BytesIO
    from pdfminer.high_level import extract_text
    
    response = requests.get(url)
    response.raise_for_status()
    pdf_file = BytesIO(response.content)
    return extract_text(pdf_file)

def html_to_markdown(url_or_html: str) -> Dict[str, str]:
    """Fetch/clean content from URL or HTML, convert to Markdown."""
    # Handle PDF URLs
    if (url_or_html.startswith(("http://", "https://")) and 
        is_pdf_url(url_or_html)):
        try:
            text = extract_text_from_pdf(url_or_html)
            return {
                "title": os.path.basename(url_or_html),
                "markdown": f"# PDF Content\n\n{text}"
            }
        except Exception as e:
            raise ValueError(f"Failed to process PDF: {str(e)}")

    # Handle HTML content
    html = (requests.get(url_or_html).text 
            if url_or_html.startswith(("http://", "https://")) 
            else url_or_html)

    # HTML processing
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
    h2t.body_width = 0  # Don't wrap text
    md = h2t.handle(main_html)

    # Normalize whitespace and clean up markdown
    md = re.sub(r"[ \t]+\n", "\n", md)
    md = re.sub(r"\n{3,}", "\n\n", md).strip()
    md = re.sub(r"\[([^\]]+)\]\(\s*\)", r"\1", md)  # Remove empty links

    return {"title": title, "markdown": md}

import re
from typing import List

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

try:
    from sentence_transformers import SentenceTransformer
    _embedder = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
except Exception:
    _embedder = None

try:
    import faiss
    _has_faiss = True
except Exception:
    _has_faiss = False


def _keyword_score(query: str, text: str) -> float:
    """Tiny fallback scorer if sentence-transformers isn't available."""
    q = set(re.findall(r"\w+", query.lower()))
    t = re.findall(r"\w+", text.lower())
    if not q or not t: return 0.0
    hits = sum(t.count(w) for w in q)
    cov  = len({w for w in q if w in t}) / max(1, len(q))
    return hits / max(1, len(t)) + 0.2 * cov


def choose_chunk_indices(query: str, chunks: List[str], top_k: int = 3) -> List[int]:
    """
    Return indices of the top_k chunks most relevant to the query.
    Prefers local embeddings; falls back to keyword overlap.
    """
    if not chunks:
        return []

    # Semantic (preferred)
    if _embedder is not None:
        import numpy as np
        qv = _embedder.encode([query], convert_to_numpy=True)[0]
        cvs = _embedder.encode(chunks, convert_to_numpy=True)

        if _has_faiss:
            index = faiss.IndexFlatL2(cvs.shape[1])
            index.add(cvs.astype('float32'))
            _, idx = index.search(qv[np.newaxis, :].astype('float32'), top_k)
            return idx[0].tolist()

        # Pure NumPy cosine similarity
        sims = (cvs @ qv) / (np.linalg.norm(cvs, axis=1) * (np.linalg.norm(qv) + 1e-9))
        order = np.argsort(-sims)[:top_k]
        return order.tolist()

    # Fallback: keyword overlap
    scored = [(_keyword_score(query, c), i) for i, c in enumerate(chunks)]
    scored.sort(reverse=True)
    return [i for s, i in scored[:top_k] if s > 0]


def choose_chunks(query: str, chunks: List[str], top_k: int = 3) -> List[str]:
    """Convenience helper that returns the actual chunk texts."""
    idxs = choose_chunk_indices(query, chunks, top_k)
    return [chunks[i] for i in idxs]


def _clean_markdown_for_prompt(s: str) -> str:
    # Strip [text](url) → text, and numeric refs like [123]
    s = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', s)
    s = re.sub(r'\[\d+\]', '', s)
    return s.strip()


def build_context(selected_text: str, chunks: List[str], top_k: int = 3) -> dict:
    """
    Returns a dictionary with one big `context` string plus metadata.
    {
      "context": str,
      "selected_text": str,
      "selected_indices": [int],
      "selected_chunks": [str]
    }
    """
    idxs = choose_chunk_indices(selected_text, chunks, top_k=top_k)
    chosen = [_clean_markdown_for_prompt(chunks[i]) for i in idxs]

    labeled = [f"[Chunk {j+1}] {txt}" for j, txt in enumerate(chosen)]
    context_str = (
        f"Selected text:\n{selected_text}\n\n"
        f"Relevant context:\n" + "\n\n---\n\n".join(labeled)
    )

    return {
        "context": context_str,
        "selected_text": selected_text,
        "selected_indices": idxs,
        "selected_chunks": chosen
    }

def build_context_from_source(selected_text: str, url_or_html: str, top_k: int = 10, max_tokens: int = 500) -> dict:
    page = html_to_markdown(url_or_html)
    chunks = split_markdown(page["markdown"], max_tokens=max_tokens)
    ctx = build_context(selected_text, chunks, top_k=top_k)
    ctx["title"] = page.get("title", "")
    return ctx