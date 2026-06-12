from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class SearchHistoryIn(BaseModel):
    query: str = Field(..., min_length=2, max_length=100)


class SearchSuggestionProduct(BaseModel):
    name: str
    slug: str
    brand: str
    image: Optional[str] = None
    min_price: float
    max_price: float


class SearchSuggestionsOut(BaseModel):
    history: List[str]
    products: List[SearchSuggestionProduct]
