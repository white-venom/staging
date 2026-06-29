from datetime import date, datetime, time, timedelta

import pytz

IST = pytz.timezone("Asia/Kolkata")


def ist_today() -> date:
    """Current calendar date in IST (the server clock/container runs in UTC)."""
    return datetime.now(IST).date()


def ist_now_utc_naive() -> datetime:
    """Current instant, expressed as a naive UTC datetime (matches existing `created_at` columns)."""
    return datetime.now(IST).astimezone(pytz.utc).replace(tzinfo=None)


def ist_day_bounds_utc(d: date) -> tuple[datetime, datetime]:
    """Start (inclusive) and end (exclusive) of the given IST calendar day, as naive UTC datetimes.

    Use this to filter naive-UTC `created_at` columns by IST calendar day instead of
    `func.date(created_at) == d`, which silently compares against the UTC date.
    """
    start_ist = IST.localize(datetime.combine(d, time.min))
    end_ist = IST.localize(datetime.combine(d + timedelta(days=1), time.min))
    return (
        start_ist.astimezone(pytz.utc).replace(tzinfo=None),
        end_ist.astimezone(pytz.utc).replace(tzinfo=None),
    )
