"""Hybrid retrieval: own BM25 + optional vector similarity, fused with RRF.
Works with BM25 alone when embeddings are unavailable."""
import math
import re
from collections import Counter
from typing import Optional

import numpy as np

TOKEN = re.compile(r"[a-z0-9#$%.]+(?:-[a-z0-9]+)*", re.I)
STOP = {"the", "a", "an", "of", "to", "and", "or", "in", "on", "for", "is", "are", "it", "we", "our", "with", "as", "at", "by"}


def tokenize(text: str) -> list[str]:
    return [t.lower().strip(".") for t in TOKEN.findall(text) if t.lower() not in STOP]


class BM25:
    def __init__(self, docs: list[str], k1: float = 1.5, b: float = 0.75):
        self.k1, self.b = k1, b
        self.tokens = [tokenize(d) for d in docs]
        self.n = len(docs)
        self.avgdl = (sum(len(t) for t in self.tokens) / self.n) if self.n else 0.0
        df: Counter = Counter()
        for t in self.tokens:
            df.update(set(t))
        self.idf = {w: math.log(1 + (self.n - c + 0.5) / (c + 0.5)) for w, c in df.items()}
        self.tf = [Counter(t) for t in self.tokens]

    def scores(self, query: str) -> list[float]:
        q = tokenize(query)
        out = []
        for i, tf in enumerate(self.tf):
            dl = len(self.tokens[i]) or 1
            s = 0.0
            for w in q:
                if w in tf:
                    f = tf[w]
                    s += self.idf.get(w, 0) * f * (self.k1 + 1) / (f + self.k1 * (1 - self.b + self.b * dl / (self.avgdl or 1)))
            out.append(s)
        return out


def _ranks(scores: list[float]) -> dict[int, int]:
    order = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
    return {i: r for r, i in enumerate(order, start=1) if scores[i] > 0}


class HybridIndex:
    def __init__(self, items: list[dict], vectors: Optional[np.ndarray] = None):
        self.items = items
        self.bm25 = BM25([it["text"] for it in items])
        self.vectors = vectors  # shape (n, d), L2-normalised, or None

    def search(self, query: str, k: int = 3, query_vector: Optional[np.ndarray] = None, rrf_k: int = 60) -> list[dict]:
        if not self.items:
            return []
        bm = self.bm25.scores(query)
        bm_ranks = _ranks(bm)
        cos = None
        vec_ranks: dict[int, int] = {}
        if self.vectors is not None and query_vector is not None:
            cos = (self.vectors @ query_vector).tolist()
            vec_ranks = _ranks(cos)
        fused: dict[int, float] = {}
        for ranks in (bm_ranks, vec_ranks):
            for i, r in ranks.items():
                fused[i] = fused.get(i, 0.0) + 1.0 / (rrf_k + r)
        top = sorted(fused, key=fused.get, reverse=True)[:k]
        best_bm = max(bm) if bm and max(bm) > 0 else 1.0
        return [{
            "item": self.items[i],
            "rrf": round(fused[i], 5),
            "bm25": round(bm[i], 4),
            "bm25_norm": round(bm[i] / best_bm, 4),
            "cosine": round(cos[i], 4) if cos is not None else None,
            "mode": "hybrid" if cos is not None else "bm25_only",
        } for i in top]
