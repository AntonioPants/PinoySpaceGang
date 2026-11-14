import hashlib
import json
from pathlib import Path

import jsonschema
import pytest

from scripts.environment.build_profiles import parse_hourly, radiation_summary, summarize, density, stats, PARAMS, UNITS
from scripts.environment.soil import fetch_soil

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data/environment'


def payload(values):
    return {'parameters': {p: {'units': UNITS[p]} for p in PARAMS}, 'header': {'fill_value': -999, 'time_standard': 'UTC'}, 'properties': {'parameter': {p: {'2020010100': v} for p, v in zip(PARAMS, values)}}}


def test_units_density_and_meteorological_wind():
    row = parse_hourly(payload([10, 90, 0, 50, 100, 1.2]), 2020)[0]
    assert row['air_temperature_k'] == 273.15
    assert row['pressure_pa'] == 100000
    assert row['wind_east_m_s'] == -10  # Wind FROM east moves west.
    assert abs(row['wind_north_m_s']) < 1e-10
    assert row['precipitation_mm_h'] == 1.2
    assert 1.26 < row['air_density_kg_m3'] < 1.28


def test_fill_values_stay_missing_and_bad_units_rejected():
    data = payload([-999, -999, -999, 50, 100, 0])
    row = parse_hourly(data, 2020)[0]
    assert row['wind_speed_m_s'] is None and row['air_temperature_k'] is None
    assert row['wind_east_m_s'] is None and row['air_density_kg_m3'] is None
    data['parameters']['PS']['units'] = 'Pa'
    with pytest.raises(ValueError, match='Unexpected units'):
        parse_hourly(data, 2020)
    assert stats([None], 24, 'm/s')['mean'] is None


def test_direction_wrap_and_joint_scenarios():
    rows = [parse_hourly(payload([10, angle, 20, 50, 100, 0]), 2020)[0] for angle in [359, 1]]
    s = summarize(rows, 24, -106)
    angle = s['vector_mean_wind_from_deg']
    assert min(angle, 360 - angle) < 1e-8
    assert s['statistics']['wind_speed_m_s']['coverage_fraction'] == 2/24
    for choice in s['scenarios'].values():
        assert any(choice.items() <= r.items() for r in rows)


def test_radiation_conversion_excludes_annual_slot_and_preserves_polar_missing():
    data = {'parameters': {'ALLSKY_SRF_ALB': {'units': 'dimensionless'}, 'ALLSKY_SFC_SW_DWN': {'units': 'kW-hr/m^2/day'}}, 'header': {'fill_value': -999}, 'properties': {'parameter': {'ALLSKY_SRF_ALB': {'202001': -999, '202013': .9}, 'ALLSKY_SFC_SW_DWN': {'202001': 4.8, '202013': 100}}}}
    r = radiation_summary(data, [1], [2020])
    assert r['solar_daily_mean_w_m2']['mean'] == pytest.approx(200)
    assert r['albedo']['mean'] is None
    assert r['albedo']['valid_count'] == 0


def test_committed_profiles_are_complete_and_traceable():
    schema = json.loads((DATA / 'profile.schema.json').read_text())
    validator = jsonschema.Draft202012Validator(schema, format_checker=jsonschema.FormatChecker())
    catalog = json.loads((DATA / 'catalog.json').read_text())
    assert len(catalog['sites']) == 6
    for site in catalog['sites']:
        path = DATA / site['file']
        assert hashlib.sha256(path.read_bytes()).hexdigest() == site['sha256']
        profile = json.loads(path.read_text())
        validator.validate(profile)
        assert profile['site']['id'] == site['id']
        assert len(profile['sources']) == 11
        annual_hours = sum(period['statistics']['wind_speed_m_s']['expected_count'] for period in profile['months'].values())
        assert annual_hours == 87672
        for period in [*profile['months'].values(), *profile['seasons'].values()]:
            for field, stat in period['statistics'].items():
                assert stat['valid_count'] <= stat['expected_count']
                if stat['valid_count']:
                    assert stat['min'] <= stat['p05'] <= stat['p50'] <= stat['p95'] <= stat['max']
            for scenario in period['scenarios'].values():
                assert scenario is not None
                assert 0 < scenario['air_density_kg_m3'] < 2
            assert period['radiation']['albedo']['mean'] is None or 0 <= period['radiation']['albedo']['mean'] <= 1
        assert profile['soil']['bearing_capacity_pa'] is None
        for horizon in profile['soil']['survey']['horizons']:
            for key in ['sand_pct','silt_pct','clay_pct','map_unit_component_pct']:
                assert horizon[key] is None or 0 <= horizon[key] <= 100
            assert horizon['bulk_density_kg_m3'] is None or 0 < horizon['bulk_density_kg_m3'] < 4000


def test_soil_survey_preserves_nulls_depth_and_density_conversion(monkeypatch, tmp_path):
    import io
    table = {'Table': [
        ['mukey','muname','areasymbol','areaname','cokey','compname','compkind','comppct_r','taxorder','hzname','hzdept_r','hzdepb_r','sandtotal_r','silttotal_r','claytotal_r','dbthirdbar_r'],
        ['1','Test map','XX000','Test area','2','Test soil','Series','75','Entisols','A','0','43','0',None,'25','1.6'],
    ]}
    monkeypatch.setattr('urllib.request.urlopen', lambda *args, **kwargs: io.BytesIO(json.dumps(table).encode()))
    result = fetch_soil({'longitude': -106, 'latitude': 32}, tmp_path)
    horizon = result['horizons'][0]
    assert horizon['bulk_density_kg_m3'] == 1600
    assert horizon['sand_pct'] == 0 and horizon['silt_pct'] is None
    assert horizon['bottom_cm'] == 43  # Never pretend this was a measured 0–30 cm average.
    assert horizon['map_unit_component_pct'] == 75


def test_missing_soil_coverage_is_not_zero_properties(monkeypatch, tmp_path):
    import io
    monkeypatch.setattr('urllib.request.urlopen', lambda *args, **kwargs: io.BytesIO(b'{}'))
    result = fetch_soil({'longitude': 0, 'latitude': 0}, tmp_path)
    assert result['status'] == 'no_coverage'
    assert result['horizons'] == []
