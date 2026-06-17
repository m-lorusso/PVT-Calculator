#!/usr/bin/env python3
"""
End-to-end check: call the REAL backend tmy() (server.py) to produce records
including the new solarHour field, and dump them for the Node front-end harness.
This proves the production backend code path works, not a re-implementation.
"""
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "pvt-tmy-api"))
import server  # noqa: E402

CITIES = {"sydney": (-33.8698, 151.2083),
          "melbourne": (-37.8136, 144.9631),
          "perth": (-31.9505, 115.8605)}

for name, (lat, lon) in CITIES.items():
    print(f"[{name}] calling backend tmy() ...", file=sys.stderr)
    res = server.tmy(lat, lon)
    recs = res["records"]
    has_solar = sum(1 for r in recs if "solarHour" in r)
    print(f"  records={len(recs)}  with solarHour={has_solar}  sample={recs[12]}", file=sys.stderr)
    with open(f"validation/backend_{name}.json", "w") as fh:
        json.dump({"city": name, "lat": lat, "lon": lon, "tz": res["tz"],
                   "tilt": 30.0, "albedo": 0.2, "eta": 0.20, "area": 20.0,
                   "records": recs}, fh)
print("done", file=sys.stderr)
