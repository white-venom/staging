import uuid
from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, Field


class CheckInRequest(BaseModel):
    start_km: int = Field(..., ge=0, examples=[12540])
    image: Optional[str] = Field(None, description="Base64 encoded odometer image with superimposed location")
    latitude: Optional[float] = Field(None, examples=[28.6139])
    longitude: Optional[float] = Field(None, examples=[77.2090])


class CheckOutRequest(BaseModel):
    end_km: int = Field(..., ge=0, examples=[12610])
    image: Optional[str] = Field(None, description="Base64 encoded odometer image with superimposed location")
    latitude: Optional[float] = Field(None, examples=[28.6139])
    longitude: Optional[float] = Field(None, examples=[77.2090])


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
    start_km_image_url: Optional[str] = None
    end_km_image_url: Optional[str] = None
    start_latitude: Optional[float] = None
    start_longitude: Optional[float] = None
    end_latitude: Optional[float] = None
    end_longitude: Optional[float] = None

    class Config:
        from_attributes = True
