# Model Specification

## Scope

CoolSheet estimates annual photovoltaic-thermal (PVT) supply and optional industry demand matching for Australian commercial sites. The frontend runs 8,760 hourly timesteps using PVGIS TMY weather, a BC-Aus mains-water temperature model, isotropic plane-of-array irradiance, selectable PVT thermal model A/B, PV temperature correction, and hourly direct-use demand matching.

## Weather And Solar Geometry

- Weather source: PVGIS TMY fetched by `pvt-tmy-api/server.py` through `pvlib.iotools.get_pvgis_tmy`.
- Backend contract: each hourly record includes `dayN`, `hourN`, `solarHour`, `dni`, `dhi`, `ghi`, `ta`, and `vwind`.
- `hourN` is local clock hour and is used for demand scheduling.
- `solarHour` is true solar time and is used for solar geometry.
- The solar-geometry formula remains the existing Cooper declination/hour-angle implementation.

Reference links:

- [pvlib get_pvgis_tmy](https://pvlib-python.readthedocs.io/en/stable/reference/generated/pvlib.iotools.get_pvgis_tmy.html)
- [PVGIS API](https://re.jrc.ec.europa.eu/api/v5_3/)

## Irradiance Model

The core/default irradiance model is isotropic diffuse transposition:

```text
BHI = DNI * max(0, cos(theta_z))
GHI = BHI + DHI
Beam_POA = DNI * max(0, cos(theta_i))
Diffuse_POA = DHI * (1 + cos(beta)) / 2
Ground_POA = GHI * albedo * (1 - cos(beta)) / 2
POA = max(0, Beam_POA + Diffuse_POA + Ground_POA)
```

Perez is retained only as an external/reference benchmark in validation data. It is not the default scientific model.

## PVT Thermal Model A

Model A is locked as the approved prior-thesis/professor-provided simple linear model:

```text
eta_th = clamp(a0 + a1 * ((Tin - Ta) / G) + a2 * wind, 0, 1)
Q_th = eta_th * G * A
```

No coefficients or equation form were changed in this phase.

## PVT Thermal Model B

Model B is locked as the approved ISO 9806 Eq. 12 implementation with Newton iteration on outlet/mean fluid temperature. The current code preserves:

- absorbed term `eta0 * G`
- first- and second-order heat loss terms `a1 * dT`, `a2 * dT^2`
- wind, long-wave, wind-irradiance, and fourth-order terms where coefficients are non-zero
- Swinbank clear-sky long-wave estimate where long-wave irradiance is not supplied by TMY

No coefficients or equation form were changed in this phase.

## PV Electricity

PV electricity is computed from POA irradiance, collector/PV area, and PV efficiency. When enabled, the NOCT-based temperature correction is applied to standalone PV and cooled PVT panel temperatures.

## Industry Demand

Existing industry models remain:

- dairy farm: process-water heat and electrical benchmark
- brewery: process-water heat and electrical benchmark
- hotel: occupied-room-night thermal/electrical benchmark
- aquatic centres: area-based pool heat-loss model

Commercial laundry is now implemented as a hot-water washing model:

```text
Annual kg = kg/day * operating days/week * 52
Q_wash = kg_h * L/kg * hotWaterFraction * cp * max(0, washTemp - Tmains)
Q_rinse = kg_h * L/kg * warmRinseFraction * cp * max(0, rinseTemp - Tmains)
Q_loss = (selected Q_wash + selected Q_rinse) * userLossFraction
```

The commercial-laundry model represents hot-water washing demand only. Drying, ironing, steam finishing, motors, ventilation, and whole-site electricity are not included by default.

Australian public data sources for washing appliances are WELS and Energy Rating; direct public commercial-laundry process benchmarks are limited, so water use, hot-water fraction, temperature, and loss fraction are exposed as editable assumptions.

- [WELS Water Rating](https://www.waterrating.gov.au/)
- [Energy Rating](https://www.energyrating.gov.au/)

## Economics

Economic calculations use editable tariffs, gas price, boiler efficiency, CAPEX, OPEX, lifetime, and discount rate. Thermal savings convert useful heat to displaced gas fuel as:

```text
gas_fuel_MJ = useful_heat_kWh * 3.6 / boiler_efficiency
thermal_savings_AUD = gas_fuel_MJ * gas_price_AUD_per_MJ
```

Simple payback, NPV, CRF, LCOE, LCOH, and combined LCOE are tested independently.
