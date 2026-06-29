# Locked Weather Fixtures

These files are locked PVGIS TMY outputs produced through `pvt-tmy-api/server.py`.
They are used for offline validation and should not be refreshed casually.

Refresh command from the repository root:

```text
npm run fixtures:weather
npm run test:weather-fixtures
```

Review generated diffs before accepting fixture changes. Live PVGIS, pvlib, and
timezone dependencies can change over time.
