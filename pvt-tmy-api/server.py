#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
TMY API backend: FastAPI /tmy route implementation
Dependencies: fastapi, uvicorn, pvlib, timezonefinder, tzdata, pandas
Features:
- Fetches PVGIS TMY data (pvlib.iotools.get_pvgis_tmy)
- Auto-detects timezone from coordinates and localizes timestamps
- Returns {"meta": ..., "tz": "...", "records": [...]}
- In-memory caching with 24h TTL to reduce PVGIS calls
- /health endpoint and CORS for deployment/testing
"""

from __future__ import annotations

import os
import re
import smtplib
import ssl
import time
from email.message import EmailMessage
from typing import Optional, Any, Dict

import pvlib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from zoneinfo import ZoneInfo
from timezonefinder import TimezoneFinder

# Global timezone finder (singleton for performance)
_tf = TimezoneFinder()

# In-memory TMY cache
_TMY_CACHE: Dict[str, Dict[str, Any]] = {}
_TMY_CACHE_TTL_SEC = 24 * 3600
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _load_env_file(path: str) -> None:
    """Load simple KEY=value pairs without adding a dotenv dependency."""
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip("\"'")
            if key and key not in os.environ:
                os.environ[key] = value


_API_DIR = os.path.dirname(os.path.abspath(__file__))
_load_env_file(os.path.join(_API_DIR, ".env"))


def _cache_key(lat: float, lon: float, rotate_last_n_day1: int) -> str:
    return f"{lat:.4f},{lon:.4f},rot={int(rotate_last_n_day1)}"


# FastAPI app
app = FastAPI(title="TMY API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def fnum(x: Any, default: float = 0.0) -> float:
    """Safely convert value to float, returning default on error."""
    try:
        if x is None:
            return default
        return float(x)
    except (TypeError, ValueError):
        return default


class EmailReportRequest(BaseModel):
    recipient: str
    subject: str = "Annual PVT Calculator report"
    body_text: str = "Please find attached the Annual PVT Calculator report."
    report_html: str
    filename: str = "annual-pvt-report.html"


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _validate_email(value: str, field_name: str) -> str:
    email = (value or "").strip()
    if "\n" in email or "\r" in email or not _EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail=f"{field_name} must be a valid email address.")
    return email


def _safe_email_header(value: str, fallback: str) -> str:
    clean = (value or fallback).replace("\r", " ").replace("\n", " ").strip()
    return clean or fallback


def tmy(
    lat: float,
    lon: float,
    tzName: Optional[str] = None,
    gmtOffset: Optional[float] = None,
    rotate_last_n_day1: int = 0,
) -> Dict[str, Any]:
    """
    Fetch PVGIS TMY data, localize to timezone, return unified dict.
    Results are cached in-memory for 24 hours.
    """
    cache_key = _cache_key(lat, lon, rotate_last_n_day1)
    cached = _TMY_CACHE.get(cache_key)
    now = time.time()
    if cached and (now - cached["ts"] <= _TMY_CACHE_TTL_SEC):
        return cached["data"]

    # 0) Fetch PVGIS TMY data
    try:
        df, meta = pvlib.iotools.get_pvgis_tmy(lat, lon, map_variables=True)
    except Exception as e:
        return {
            "error": f"TMY fetch failed: {str(e)}",
            "tz": "UTC",
            "records": [],
            "meta": None,
        }

    # 1) Localize to UTC
    if df.index.tz is None:
        df = df.tz_localize("UTC")

    # 2) Determine timezone from coordinates
    tz_name = _tf.timezone_at(lng=lon, lat=lat)
    if tz_name is None:
        tz_used = ZoneInfo("UTC")
        tz_used_name = "UTC"
    else:
        tz_used = ZoneInfo(tz_name)
        tz_used_name = tz_name

    # 3) Convert to local timezone
    try:
        df = df.tz_convert(tz_used)
    except Exception:
        df = df.tz_convert("UTC")
        tz_used = ZoneInfo("UTC")
        tz_used_name = "UTC"

    # 4) Build records
    # hourN comes straight from the local timestamp (1 = midnight-1am .. 24 = 11pm-midnight).
    # A running per-day counter was used before, but after UTC->local conversion the first
    # day starts mid-day, so the counter misaligned day 1's solar hours (e.g. full DNI
    # reported at "midnight"). Timestamp-based hour numbering is always aligned.
    #
    # solarHour is the TRUE solar time (0..24, 12 = solar noon), derived from the UTC
    # instant + longitude + equation of time. It is DST-free and meridian-corrected, so
    # the front-end solar-geometry formulas (which assume hour 12 = solar noon) get the
    # correct sun position. Local-clock hourN, which carries DST + meridian offset, is
    # kept for demand-side scheduling (hot-water / pool loads happen at clock hours).
    # Validated against pvlib: collapses zenith error from RMS ~3-10deg to ~0.4deg.
    utc_index = df.index.tz_convert("UTC")
    eot_min = pvlib.solarposition.equation_of_time_spencer71(utc_index.dayofyear)
    solar_hours = (
        utc_index.hour + utc_index.minute / 60.0 + lon / 15.0 + np.asarray(eot_min) / 60.0
    ) % 24.0

    records = []

    for i, (ts, row) in enumerate(df.iterrows()):
        dayN = int(ts.dayofyear)
        hourN = int(ts.hour) + 1
        dni = fnum(row.get("dni"))
        dhi = fnum(row.get("dhi"))
        ghi = fnum(row.get("ghi"))
        ta = fnum(row.get("t2m", row.get("temp_air")))
        vwind = fnum(row.get("ws10m", row.get("wind_speed")))

        records.append(
            {"dayN": dayN, "hourN": hourN, "solarHour": float(solar_hours[i]),
             "dni": dni, "dhi": dhi, "ghi": ghi, "ta": ta, "vwind": vwind}
        )

    # Rotate logic: move last N records of day1 to the beginning
    if rotate_last_n_day1 and rotate_last_n_day1 > 0:
        m = 0
        for idx, rec in enumerate(records):
            if rec["dayN"] != 1:
                m = idx
                break
        if m == 0:
            m = len(records)
        n = min(rotate_last_n_day1, m)
        if n > 0:
            lastN = records[m - n : m]
            firstPart = records[: m - n]
            records = lastN + firstPart + records[m:]
            # hourN is timestamp-based now, so no re-numbering after rotation.

    result = {
        "meta": jsonable_encoder(meta),
        "tz": str(tz_used_name),
        "records": records,
    }
    _TMY_CACHE[cache_key] = {"ts": now, "data": result}
    return result


# ============================================================================
# FastAPI Routes
# ============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "message": "TMY API is running"}


def _validate_coords(lat: float, lon: float) -> None:
    """Reject out-of-range coordinates with a clean 400 instead of a PVGIS error."""
    if not (-90.0 <= lat <= 90.0):
        raise HTTPException(status_code=400, detail=f"lat must be between -90 and 90 (got {lat}).")
    if not (-180.0 <= lon <= 180.0):
        raise HTTPException(status_code=400, detail=f"lon must be between -180 and 180 (got {lon}).")


@app.get("/tmy")
async def get_tmy(
    lat: float,
    lon: float,
    tz: Optional[str] = None,
    gmtOffset: Optional[float] = None,
    rotate_last_n_day1: int = 0,
):
    """GET TMY data by lat/lon coordinates."""
    _validate_coords(lat, lon)
    result = tmy(lat, lon, tz, gmtOffset, rotate_last_n_day1)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@app.post("/tmy")
async def post_tmy(
    lat: float,
    lon: float,
    tz: Optional[str] = None,
    gmtOffset: Optional[float] = None,
    rotate_last_n_day1: int = 0,
):
    """POST TMY data by lat/lon coordinates."""
    _validate_coords(lat, lon)
    result = tmy(lat, lon, tz, gmtOffset, rotate_last_n_day1)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@app.post("/email-report")
async def email_report(payload: EmailReportRequest):
    """Send a generated report HTML file by email when SMTP is configured."""
    smtp_host = os.getenv("SMTP_HOST", "").strip()
    smtp_from = os.getenv("SMTP_FROM", "").strip()
    if not smtp_host or not smtp_from:
        raise HTTPException(
            status_code=501,
            detail=(
                "Email sending is not configured. Set SMTP_HOST and SMTP_FROM "
                "on the TMY API server. If your SMTP server requires login, also "
                "set SMTP_USER and SMTP_PASSWORD."
            ),
        )

    recipient = _validate_email(payload.recipient, "recipient")
    sender = _validate_email(smtp_from, "SMTP_FROM")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    smtp_use_ssl = _env_bool("SMTP_SSL", smtp_port == 465)
    smtp_use_tls = _env_bool("SMTP_TLS", not smtp_use_ssl)
    filename = _safe_email_header(payload.filename, "annual-pvt-report.html")
    subject = _safe_email_header(payload.subject, "Annual PVT Calculator report")
    body_text = (payload.body_text or "Please find attached the Annual PVT Calculator report.").strip()
    report_html = payload.report_html or ""
    if len(report_html) < 100:
        raise HTTPException(status_code=400, detail="report_html is missing or too short.")

    message = EmailMessage()
    message["From"] = sender
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(body_text)
    message.add_attachment(
        report_html.encode("utf-8"),
        maintype="text",
        subtype="html",
        filename=filename,
    )

    try:
        if smtp_use_ssl:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=30) as smtp:
                if smtp_user:
                    smtp.login(smtp_user, smtp_password)
                smtp.send_message(message)
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as smtp:
                if smtp_use_tls:
                    smtp.starttls(context=ssl.create_default_context())
                if smtp_user:
                    smtp.login(smtp_user, smtp_password)
                smtp.send_message(message)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Email send failed: {exc}") from exc

    return {"status": "sent", "recipient": recipient}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
