# test_build_context.py
from textify import build_context_from_source

url = "https://en.wikipedia.org/wiki/Google_Neural_Machine_Translation"   # PDF URL works if pdfminer.six is installed
highlight = "including GPT and LLaMA"

ctx = build_context_from_source(
    selected_text=highlight,
    url_or_html=url,
    top_k=3,
    max_tokens=320
)

print("TITLE:", ctx.get("title", ""))
print("Selected indices:", ctx.get("selected_indices", []))
print("Num selected chunks:", len(ctx.get("selected_chunks", [])))

print("\n=== Context preview (first 700 chars) ===")
context_text = ctx.get("context", "")
print(context_text[:700], "...\n")

print("=== Per-chunk previews ===")
for i, ch in enumerate(ctx.get("selected_chunks", []), 1):
    print(f"\n--- Chunk {i} ({len(ch)} chars) ---")
    print(ch[:400], "...")
