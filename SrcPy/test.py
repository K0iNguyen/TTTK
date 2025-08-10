from textify import html_to_markdown, split_markdown, choose_chunks

# Test with a URL
page = html_to_markdown("https://en.wikipedia.org/wiki/Artificial_intelligence")
chunks = split_markdown(page["markdown"], max_tokens=300)

print("TITLE:", page["title"])
print(f"Total chunks: {len(chunks)}\n")

# Preview first chunk
print("--- First chunk preview ---")
print(chunks[0][:500], "\n")

# Example highlight
highlight_text = "machine learning applications in AI"
top_chunks = choose_chunks(highlight_text, chunks, top_k=3)

print(f"=== Top chunks relevant to: '{highlight_text}' ===")
for i, chunk in enumerate(top_chunks, 1):
    print(f"\n--- Chunk {i} ---")
    print(chunk[:500])  # limit preview length
