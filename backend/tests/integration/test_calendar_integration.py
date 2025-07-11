import os
import pytest
import asyncio
from datetime import datetime, timedelta, timezone

from httpx import AsyncClient
from app.main import app
from app.services.calendar_service import calendar_service

pytestmark = pytest.mark.asyncio

TEST_USER_ID = os.getenv("TEST_CALENDAR_USER", "test_user_001")

def _has_calendar_creds() -> bool:
    creds_path = os.getenv("GOOGLE_CLIENT_CREDENTIALS_PATH", "credentials/google_client_credentials.json")
    return os.path.exists(creds_path)


@pytest.fixture(scope="session")
async def async_client():
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client


@pytest.mark.skipif(not _has_calendar_creds(), reason="Calendar credentials not configured")
async def test_calendar_auth(async_client):
    ok = await calendar_service.authenticate(TEST_USER_ID)
    assert ok is True
    assert calendar_service.mock_mode is False


@pytest.mark.skipif(not _has_calendar_creds(), reason="Calendar credentials not configured")
async def test_today_schedule_endpoint(async_client):
    resp = await async_client.get("/api/v1/calendar/today")
    assert resp.status_code == 200
    data = resp.json()
    assert "response" in data


@pytest.mark.skipif(not _has_calendar_creds(), reason="Calendar credentials not configured")
async def test_create_event_and_availability(async_client):
    # Create quick event 30 min from now
    now = datetime.now(timezone.utc)
    start = (now + timedelta(minutes=30)).replace(microsecond=0, tzinfo=timezone.utc)
    end = start + timedelta(minutes=30)

    event_payload = {
        "summary": "Automated Test Event",
        "start": start.isoformat(),
        "end": end.isoformat(),
        "timezone": "UTC",
        "attendees": [],
        "description": "Integration test event"
    }
    create_resp = await async_client.post("/api/v1/calendar/create-event", json=event_payload)
    assert create_resp.status_code == 200
    create_data = create_resp.json()
    assert create_data.get("event")

    avail_payload = {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "timezone": "UTC"
    }
    avail_resp = await async_client.post("/api/v1/calendar/availability", json=avail_payload)
    assert avail_resp.status_code == 200
    avail_data = avail_resp.json()
    assert "response" in avail_data 
import pytest
import asyncio
from datetime import datetime, timedelta, timezone

from httpx import AsyncClient
from app.main import app
from app.services.calendar_service import calendar_service

pytestmark = pytest.mark.asyncio

TEST_USER_ID = os.getenv("TEST_CALENDAR_USER", "test_user_001")

def _has_calendar_creds() -> bool:
    creds_path = os.getenv("GOOGLE_CLIENT_CREDENTIALS_PATH", "credentials/google_client_credentials.json")
    return os.path.exists(creds_path)


@pytest.fixture(scope="session")
async def async_client():
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client


@pytest.mark.skipif(not _has_calendar_creds(), reason="Calendar credentials not configured")
async def test_calendar_auth(async_client):
    ok = await calendar_service.authenticate(TEST_USER_ID)
    assert ok is True
    assert calendar_service.mock_mode is False


@pytest.mark.skipif(not _has_calendar_creds(), reason="Calendar credentials not configured")
async def test_today_schedule_endpoint(async_client):
    resp = await async_client.get("/api/v1/calendar/today")
    assert resp.status_code == 200
    data = resp.json()
    assert "response" in data


@pytest.mark.skipif(not _has_calendar_creds(), reason="Calendar credentials not configured")
async def test_create_event_and_availability(async_client):
    # Create quick event 30 min from now
    now = datetime.now(timezone.utc)
    start = (now + timedelta(minutes=30)).replace(microsecond=0, tzinfo=timezone.utc)
    end = start + timedelta(minutes=30)

    event_payload = {
        "summary": "Automated Test Event",
        "start": start.isoformat(),
        "end": end.isoformat(),
        "timezone": "UTC",
        "attendees": [],
        "description": "Integration test event"
    }
    create_resp = await async_client.post("/api/v1/calendar/create-event", json=event_payload)
    assert create_resp.status_code == 200
    create_data = create_resp.json()
    assert create_data.get("event")

    avail_payload = {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "timezone": "UTC"
    }
    avail_resp = await async_client.post("/api/v1/calendar/availability", json=avail_payload)
    assert avail_resp.status_code == 200
    avail_data = avail_resp.json()
    assert "response" in avail_data 
 
 