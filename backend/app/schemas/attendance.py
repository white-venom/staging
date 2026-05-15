import uuid
from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, Field


class CheckInRequest(BaseModel):
    start_km: int = Field(..., ge=0, examples=[12540])


class CheckOutRequest(BaseModel):
    end_km: int = Field(..., ge=0, examples=[12610])


class AttendanceResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    date: date
    start_km: int
    end_km: Optional[int]
    start_time: datetime
    end_time: Optional[datetime]
    status: str
    is_late: bool
    penalty_amount: float
    is_penalty_approved: bool

    class Config:
        from_attributes = True
