from typing import List, Dict, Union
import numpy as np
import faiss
import openai
from sentence_transformers import SentenceTransformer


# Initialize embedder once (reuse across calls)
embedder = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')

class ContextGenerator:
    def __init__(self, openai_api_key: str = None):
        self.embedder = embedder
        self.openai_client = openai.OpenAI(api_key=openai_api_key) if openai_api_key else None

    def select_chunks(
        self,
        query: str,
        chunks: List[str],
        strategy: str = "hybrid",  # "proportional", "threshold", or "hybrid"
        ratio: float = 0.2,
        max_threshold: float = 1.5,
        min_k: int = 1,
        max_k: int = 5
    ) -> List[str]:
        """Enhanced hybrid chunk selection"""
        query_vec = self.embedder.encode([query], convert_to_numpy=True)
        chunk_vecs = self.embedder.encode(chunks, convert_to_numpy=True)
        
        index = faiss.IndexFlatL2(chunk_vecs.shape[1])
        index.add(chunk_vecs)
        
        if strategy == "proportional":
            top_k = min(max(int(len(chunks) * ratio), min_k), max_k)
            _, indices = index.search(query_vec, top_k)
            return [chunks[i] for i in indices[0]]
        
        distances, indices = index.search(query_vec, len(chunks))
        
        selected = []
        for dist, idx in zip(distances[0], indices[0]):
            if (strategy == "threshold" and dist <= max_threshold) or \
               (strategy == "hybrid" and (dist <= max_threshold or len(selected) < min_k)):
                selected.append(chunks[idx])
                if len(selected) >= max_k:
                    break
        return selected

    def generate_context(
        self,
        highlight: str,
        chunks: List[str],
        strategy: str = "hybrid",
        temperature: float = 0.3,
        model: str = "gpt-4-turbo"
    ) -> Dict[str, Union[str, List[str]]]:
        """End-to-end context generation pipeline"""
        if not self.openai_client:
            raise ValueError("OpenAI client not initialized - provide API key")
        
        # 1. Select relevant chunks
        selected_chunks = self.select_chunks(
            query=highlight,
            chunks=chunks,
            strategy=strategy
        )
        
        # 2. Generate structured context
        system_msg = """You're a technical research assistant. Create a cohesive summary that:
            - Starts with a 1-sentence definition of the highlight
            - Preserves key technical details from the chunks
            - Organizes information into logical paragraphs
            - Maintains academic tone"""
        
        response = self.openai_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": f"Highlight: {highlight}\n\nRelevant chunks:\n{'- ' + '\n- '.join(selected_chunks)}"}
            ],
            temperature=temperature
        )
        
        return {
            "context": response.choices[0].message.content,
            "selected_chunks": selected_chunks,
            "strategy_used": strategy
        }

# Usage Example
if __name__ == "__main__":
    # Initialize with your OpenAI API key
    generator = ContextGenerator(openai_api_key="your-api-key")
    
    # Sample data
    all_chunks = [
        "Attention mechanisms allow models to focus on relevant input parts",
        "Transformers use multi-head attention for parallel processing",
        "The original 2017 paper introduced scaled dot-product attention",
        "RNNs process data sequentially unlike transformers",
        "Self-attention computes relationships between all positions"
    ]
    
    # Generate context
    result = generator.generate_context(
        highlight="attention mechanisms in transformers",
        chunks=all_chunks,
        strategy="hybrid"
    )
    
    print("Generated Context:")
    print(result["context"])
    print("\nChunks Used:")
    for i, chunk in enumerate(result["selected_chunks"], 1):
        print(f"{i}. {chunk[:80]}...")