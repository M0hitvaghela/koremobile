from __future__ import annotations

from datetime import datetime
from typing import List, Dict
from pydantic import BaseModel, Field


class CreateReviewRequest(BaseModel):
    product_id: int
    order_id: int
    rating: int = Field(..., ge=1, le=5)
    title: str = Field('', max_length=200)
    body: str = Field(..., min_length=20)


class ReviewOut(BaseModel):
    id: int
    product_id: int
    user_id: int
    rating: int
    title: str
    body: str
    is_verified: bool
    user_name: str
    created_at: datetime


class ReviewSummary(BaseModel):
    avg_rating: float
    total_reviews: int
    rating_breakdown: Dict[str, int]   # {"5": 10, "4": 5, ...}
    reviews: List[ReviewOut]