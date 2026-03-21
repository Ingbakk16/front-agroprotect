import "server-only";

import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);

function preprocessEmptyValue(value: unknown) {
  if (value === null || typeof value === "undefined") {
    return undefined;
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();
    return trimmedValue.length === 0 ? undefined : trimmedValue;
  }

  return value;
}

function preprocessNumberValue(value: unknown) {
  const normalizedValue = preprocessEmptyValue(value);

  if (typeof normalizedValue === "undefined") {
    return undefined;
  }

  if (typeof normalizedValue === "number") {
    return normalizedValue;
  }

  if (typeof normalizedValue === "string") {
    const parsedValue = Number(normalizedValue);
    return Number.isFinite(parsedValue) ? parsedValue : normalizedValue;
  }

  return normalizedValue;
}

function preprocessBooleanValue(value: unknown) {
  const normalizedValue = preprocessEmptyValue(value);

  if (typeof normalizedValue === "undefined") {
    return undefined;
  }

  if (typeof normalizedValue === "boolean") {
    return normalizedValue;
  }

  if (typeof normalizedValue === "string") {
    const loweredValue = normalizedValue.toLowerCase();

    if (["true", "1", "yes", "y", "on"].includes(loweredValue)) {
      return true;
    }

    if (["false", "0", "no", "n", "off"].includes(loweredValue)) {
      return false;
    }
  }

  return normalizedValue;
}

const optionalString = z.preprocess(preprocessEmptyValue, nonEmptyString.optional());
const requiredString = z.preprocess(preprocessEmptyValue, nonEmptyString);
const optionalNumber = z.preprocess(preprocessNumberValue, z.number().finite().optional());
const requiredNumber = z.preprocess(preprocessNumberValue, z.number().finite());
const optionalBoolean = z.preprocess(preprocessBooleanValue, z.boolean().optional());

export const dimLocationRowSchema = z.object({
  location_id: requiredString,
  location_name: requiredString,
  province_name: requiredString,
  province_key: requiredString,
  latitude: requiredNumber,
  longitude: requiredNumber,
  country_code: optionalString.transform((value) => value ?? "AR"),
  is_catalog_location: optionalBoolean.transform((value) => value ?? false),
});

export const weatherDailyRowSchema = z.object({
  location_id: requiredString,
  location_name: optionalString,
  province_name: optionalString,
  province_key: optionalString,
  date: requiredString,
  max_air_temp_c: optionalNumber.transform((value) => value ?? 0),
  min_air_temp_c: optionalNumber.transform((value) => value ?? 0),
  avg_air_temp_c: optionalNumber.transform((value) => value ?? 0),
  precipitation_mm: optionalNumber.transform((value) => value ?? 0),
  relative_humidity_pct: optionalNumber.transform((value) => value ?? 0),
  temp_range_c: optionalNumber.transform((value) => value ?? 0),
  vpd_kpa: optionalNumber.transform((value) => value ?? 0),
  gdd_base_10_c_days: optionalNumber.transform((value) => value ?? 0),
  frost_day: optionalBoolean.transform((value) => value ?? false),
  heat_stress_day: optionalBoolean.transform((value) => value ?? false),
  heavy_rain_day: optionalBoolean.transform((value) => value ?? false),
  dry_day: optionalBoolean.transform((value) => value ?? false),
  fungal_risk_day: optionalBoolean.transform((value) => value ?? false),
  is_partial_latest_day: optionalBoolean.transform((value) => value ?? false),
  is_quality_approved: optionalBoolean.transform((value) => value ?? false),
  record_loaded_at: optionalString,
  _sdc_received_at: optionalString,
  _sdc_extracted_at: optionalString,
  _sdc_sequence: optionalString,
});

export const locationSnapshotRowSchema = z.object({
  location_id: requiredString,
  location_name: optionalString,
  province_name: optionalString,
  province_key: optionalString,
  latitude: optionalNumber,
  longitude: optionalNumber,
  country_code: optionalString.transform((value) => value ?? "AR"),
  is_active: optionalBoolean,
  snapshot_date: optionalString,
  date: optionalString,
  is_quality_approved: optionalBoolean.transform((value) => value ?? false),
  is_partial_latest_day: optionalBoolean.transform((value) => value ?? false),
  precipitation_mm: optionalNumber.transform((value) => value ?? 0),
  relative_humidity_pct: optionalNumber.transform((value) => value ?? 0),
  temp_range_c: optionalNumber.transform((value) => value ?? 0),
  max_air_temp_c: optionalNumber.transform((value) => value ?? 0),
  min_air_temp_c: optionalNumber.transform((value) => value ?? 0),
  vpd_kpa: optionalNumber.transform((value) => value ?? 0),
  gdd_base_10_c_days: optionalNumber.transform((value) => value ?? 0),
  frost_day: optionalBoolean.transform((value) => value ?? false),
  heat_stress_day: optionalBoolean.transform((value) => value ?? false),
  heavy_rain_day: optionalBoolean.transform((value) => value ?? false),
  dry_day: optionalBoolean.transform((value) => value ?? false),
  fungal_risk_day: optionalBoolean.transform((value) => value ?? false),
  climate_rain_signal: optionalNumber,
  climate_water_stress_signal: optionalNumber,
  climate_temperature_signal: optionalNumber,
  climate_index_total: optionalNumber,
  record_loaded_at: optionalString,
  _sdc_received_at: optionalString,
  _sdc_extracted_at: optionalString,
  _sdc_sequence: optionalString,
});

export const taxProvinceRowSchema = z.object({
  province_name: requiredString,
  province_key: requiredString,
  rural_property_tax_usd_ha_avg: optionalNumber.transform((value) => value ?? 0),
  rural_property_tax_usd_ha_spread: optionalNumber.transform((value) => value ?? 0),
  gross_turnover_tax_pct: optionalNumber.transform((value) => value ?? 0),
});

export const yieldProvinceCampaignRowSchema = z.object({
  province_name: requiredString,
  province_key: requiredString,
  crop_name: requiredString,
  crop_key: requiredString,
  campaign_name: requiredString,
  campaign_start_year: optionalNumber,
  campaign_end_year: optionalNumber,
  harvest_year: optionalNumber,
  department_count: optionalNumber.transform((value) => value ?? 0),
  harvested_share_pct: optionalNumber.transform((value) => value ?? 0),
  production_tonnes: optionalNumber.transform((value) => value ?? 0),
  yield_kg_ha: optionalNumber.transform((value) => value ?? 0),
});

export const martAgroProvinceCampaignRowSchema = z.object({
  province_name: requiredString,
  province_key: requiredString,
  crop_name: requiredString,
  crop_key: requiredString,
  campaign_name: requiredString,
  campaign_start_year: optionalNumber,
  campaign_end_year: optionalNumber,
  harvest_year: optionalNumber,
  department_count: optionalNumber.transform((value) => value ?? 0),
  harvested_share_pct: optionalNumber.transform((value) => value ?? 0),
  production_tonnes: optionalNumber.transform((value) => value ?? 0),
  yield_kg_ha: optionalNumber.transform((value) => value ?? 0),
  rural_property_tax_usd_ha_avg: optionalNumber.transform((value) => value ?? 0),
  rural_property_tax_usd_ha_spread: optionalNumber.transform((value) => value ?? 0),
  gross_turnover_tax_pct: optionalNumber.transform((value) => value ?? 0),
  has_weather_campaign_data: optionalBoolean.transform((value) => value ?? false),
  has_tax_data: optionalBoolean.transform((value) => value ?? false),
});

export type DimLocationRow = z.infer<typeof dimLocationRowSchema>;
export type WeatherDailyRow = z.infer<typeof weatherDailyRowSchema>;
export type LocationSnapshotRow = z.infer<typeof locationSnapshotRowSchema>;
export type TaxProvinceRow = z.infer<typeof taxProvinceRowSchema>;
export type YieldProvinceCampaignRow = z.infer<typeof yieldProvinceCampaignRowSchema>;
export type MartAgroProvinceCampaignRow = z.infer<typeof martAgroProvinceCampaignRowSchema>;
