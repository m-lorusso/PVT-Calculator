#!/usr/bin/env python3
"""
Prove the proposed fix: feeding a DST-free SOLAR hour (UTC + longitude + EoT)
into the existing app zenith formula collapses the clock-vs-solar zenith error.

This validates the backward-compatible 'solarHour' field approach BEFORE we touch
any production code. Compares three variants against pvlib true zenith:
  A. current  : app formula fed local clock hour          (status quo)
  B. fixed    : app formula fed solar hour (UTC+lon+EoT)   (proposed)
  C. fixed+dec: also replace Cooper decl with Spencer      (upper bound)
"""
import math, sys
import numpy as np
import pvlib
from zoneinfo import ZoneInfo
from timezonefinder import TimezoneFinder

CITIES = {"Sydney": (-33.8698, 151.2083),
          "Melbourne": (-37.8136, 144.9631),
          "Perth": (-31.9505, 115.8605)}
_tf = TimezoneFinder(); D2R = math.pi/180


def app_decl(n):  return 23.45*math.sin(D2R*(360/365)*(n+284))

def app_zenith(decl_deg, hour, lat):
    d = D2R*decl_deg; w = D2R*15*(hour-12); L = D2R*lat
    return math.degrees(math.acos(min(1, max(-1,
        math.sin(d)*math.sin(L)+math.cos(d)*math.cos(L)*math.cos(w)))))


for city, (lat, lon) in CITIES.items():
    df = pvlib.iotools.get_pvgis_tmy(lat, lon, map_variables=True)[0]
    if df.index.tz is None: df = df.tz_localize("UTC")
    tz = _tf.timezone_at(lng=lon, lat=lat) or "UTC"
    df = df.tz_convert(ZoneInfo(tz))

    solpos = pvlib.solarposition.get_solarposition(df.index, lat, lon)
    z_true = solpos["zenith"].to_numpy(float)
    up = z_true < 90

    n = df.index.dayofyear.to_numpy()
    h_clock = df.index.hour.to_numpy()

    # solar hour from UTC (DST-free) + longitude + equation of time
    utc = df.index.tz_convert("UTC")
    eot = pvlib.solarposition.equation_of_time_spencer71(utc.dayofyear).to_numpy(float)  # minutes
    h_solar = (utc.hour.to_numpy() + utc.minute.to_numpy()/60 + lon/15.0 + eot/60.0) % 24
    decl_spencer = np.degrees(pvlib.solarposition.declination_spencer71(n))

    zA = np.array([app_zenith(app_decl(nn), hh, lat) for nn, hh in zip(n, h_clock)])
    zB = np.array([app_zenith(app_decl(nn), hh, lat) for nn, hh in zip(n, h_solar)])
    zC = np.array([app_zenith(dd, hh, lat) for dd, hh in zip(decl_spencer, h_solar)])

    def stats(z):
        e = z[up]-z_true[up]
        return f"RMS {np.sqrt(np.mean(e**2)):5.2f}  max {np.max(np.abs(e)):5.2f}"
    print(f"{city:10s}  A current : {stats(zA)}")
    print(f"{'':10s}  B +solarH : {stats(zB)}")
    print(f"{'':10s}  C +decl   : {stats(zC)}")
    print()
