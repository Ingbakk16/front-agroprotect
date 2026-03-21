import "server-only";

import { riskData as mockRiskData } from "@/lib/generate-risk-data";
import type {
  IndiceClimatico,
  IndiceFinanciero,
  IndiceProduccion,
  ProvinceStats,
  RiskData,
} from "@/lib/types";
import {
  type DimLocationRow,
  dimLocationRowSchema,
  locationSnapshotRowSchema,
  martAgroProvinceCampaignRowSchema,
  taxProvinceRowSchema,
  yieldProvinceCampaignRowSchema,
  type LocationSnapshotRow,
  type MartAgroProvinceCampaignRow,
  type TaxProvinceRow,
  type YieldProvinceCampaignRow,
} from "@/lib/server/dashboard-schemas";
import { getAgroEnv } from "@/lib/server/env";
import { AgroDataError } from "@/lib/server/errors";
import {
  listResolvedExportsFromManifest,
  resolvePreferredSnapshotExportFromManifest,
  type ResolvedExport,
  type ResolvedPreferredSnapshotExport,
} from "@/lib/server/export-registry";
import { readParsedExportManifest } from "@/lib/server/manifest";
import { parseNdjsonWithSchema, readNdjsonShards } from "@/lib/server/ndjson";

export interface DashboardKpis {
  activeNodes: number;
  criticalAlerts: number;
  nationalRisk: number;
}

export interface DashboardPayloadMeta {
  degraded: boolean;
  selectionReason: string | null;
  cropKey: string | null;
  campaignName: string | null;
  weatherCoveragePct: number;
  snapshotExport: string | null;
}

export interface DashboardPayload {
  source: "gcs" | "mock";
  manifestGeneratedAt: string | null;
  kpis: DashboardKpis;
  riskData: RiskData[];
  provinceStats: ProvinceStats[];
  meta: DashboardPayloadMeta;
}

interface ResolvedExportsByLogicalName {
  dim_location: ResolvedExport;
  fct_weather_daily: ResolvedExport;
  fct_tax_province: ResolvedExport;
  fct_yield_province_campaign: ResolvedExport;
  mart_agro_province_campaign: ResolvedExport;
}

interface CampaignSelection {
  cropKey: string | null;
  campaignName: string | null;
  selectionReason: string;
}

interface ClimateScoreContext {
  humidityStress: (value: number | undefined) => number;
  maxTemperatureRisk: (value: number | undefined) => number;
  minTemperatureRisk: (value: number | undefined) => number;
  precipitationRisk: (value: number | undefined) => number;
  tempRangeRisk: (value: number | undefined) => number;
  vpdRisk: (value: number | undefined) => number;
}

interface ProvinceScoreContext {
  departmentCoverageRisk: (value: number | undefined) => number;
  grossTurnoverRisk: (value: number | undefined) => number;
  harvestedShareRisk: (value: number | undefined) => number;
  productionTonnesRisk: (value: number | undefined) => number;
  taxSpreadRisk: (value: number | undefined) => number;
  taxUsdHaRisk: (value: number | undefined) => number;
  yieldRisk: (value: number | undefined) => number;
}

interface CachedDataSourcesContext {
  generatedAt: string;
  resolvedExports: ResolvedExportsByLogicalName;
  snapshotExport: ResolvedPreferredSnapshotExport | null;
}

interface CachedDashboardPayloadContext {
  cacheKey: string;
  payload: DashboardPayload;
}

const DEFAULT_CROP_KEY = "SOJA";
const GLOBAL_INDEX_WEIGHTS = {
  climatic: 0.4,
  financial: 0.25,
  production: 0.35,
} as const;
const NEUTRAL_SCORE = 50;
const sequenceCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

let cachedDataSourcesContext: CachedDataSourcesContext | null = null;
let cachedDashboardPayloadContext: CachedDashboardPayloadContext | null = null;
let cachedMockDashboardPayload: DashboardPayload | null = null;

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function roundScore(value: number) {
  return Math.round(clamp(value));
}

function roundPercent(value: number) {
  return Math.round(value * 10) / 10;
}

function roundIndex(value: number) {
  return Math.round(value * 100) / 100;
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function weightedAverage(weightedValues: Array<{ value: number; weight: number }>) {
  const totalWeight = weightedValues.reduce((sum, entry) => sum + entry.weight, 0);

  if (totalWeight === 0) {
    return NEUTRAL_SCORE;
  }

  const totalValue = weightedValues.reduce((sum, entry) => sum + entry.value * entry.weight, 0);
  return totalValue / totalWeight;
}

function parseTimestamp(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function compareNullableNumbers(left: number | null | undefined, right: number | null | undefined) {
  return (left ?? 0) - (right ?? 0);
}

function compareNullableStrings(left: string | null | undefined, right: string | null | undefined) {
  return sequenceCollator.compare(left ?? "", right ?? "");
}

function normalizeProvinceName(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase().trim();
}

function getProvinceJoinKey(provinceKey: string | null | undefined, provinceName: string) {
  return provinceKey?.trim().toUpperCase() || normalizeProvinceName(provinceName);
}

function createRiskNormalizer(values: number[], options?: { invert?: boolean; fallback?: number }) {
  const fallbackValue = options?.fallback ?? NEUTRAL_SCORE;
  const finiteValues = values.filter((value) => Number.isFinite(value));

  if (finiteValues.length === 0) {
    return (_value: number | undefined) => fallbackValue;
  }

  const minValue = Math.min(...finiteValues);
  const maxValue = Math.max(...finiteValues);

  if (minValue === maxValue) {
    return (_value: number | undefined) => fallbackValue;
  }

  return (value: number | undefined) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return fallbackValue;
    }

    const normalizedValue = ((value - minValue) / (maxValue - minValue)) * 100;
    return clamp(options?.invert ? 100 - normalizedValue : normalizedValue);
  };
}

function compareCampaignRecency(
  left: Pick<MartAgroProvinceCampaignRow | YieldProvinceCampaignRow, "campaign_name" | "campaign_start_year" | "campaign_end_year" | "harvest_year">,
  right: Pick<MartAgroProvinceCampaignRow | YieldProvinceCampaignRow, "campaign_name" | "campaign_start_year" | "campaign_end_year" | "harvest_year">,
) {
  const comparisons = [
    compareNullableNumbers(left.campaign_start_year, right.campaign_start_year),
    compareNullableNumbers(left.campaign_end_year, right.campaign_end_year),
    compareNullableNumbers(left.harvest_year, right.harvest_year),
    compareNullableStrings(left.campaign_name, right.campaign_name),
  ];

  for (const comparison of comparisons) {
    if (comparison !== 0) {
      return comparison;
    }
  }

  return 0;
}

function compareYieldRows(left: YieldProvinceCampaignRow, right: YieldProvinceCampaignRow) {
  const recencyComparison = compareCampaignRecency(left, right);

  if (recencyComparison !== 0) {
    return recencyComparison;
  }

  const departmentComparison = compareNullableNumbers(left.department_count, right.department_count);
  if (departmentComparison !== 0) {
    return departmentComparison;
  }

  return compareNullableNumbers(left.yield_kg_ha, right.yield_kg_ha);
}

function compareSnapshotRows(left: LocationSnapshotRow, right: LocationSnapshotRow) {
  const comparisons = [
    parseTimestamp(left.snapshot_date ?? left.date) - parseTimestamp(right.snapshot_date ?? right.date),
    parseTimestamp(left.record_loaded_at) - parseTimestamp(right.record_loaded_at),
    parseTimestamp(left._sdc_received_at) - parseTimestamp(right._sdc_received_at),
    parseTimestamp(left._sdc_extracted_at) - parseTimestamp(right._sdc_extracted_at),
    compareNullableStrings(left._sdc_sequence, right._sdc_sequence),
  ];

  for (const comparison of comparisons) {
    if (comparison !== 0) {
      return comparison;
    }
  }

  return 0;
}

function buildProvinceStats(riskData: RiskData[]): ProvinceStats[] {
  const provinceTotals = new Map<string, { count: number; sum: number }>();

  for (const location of riskData) {
    const currentValue = provinceTotals.get(location.province_name) ?? { count: 0, sum: 0 };
    currentValue.count += 1;
    currentValue.sum += location.riesgo;
    provinceTotals.set(location.province_name, currentValue);
  }

  return Array.from(provinceTotals.entries())
    .map(([province, totals]) => ({
      province,
      averageRisk: Math.round((totals.sum / totals.count) * 100),
      count: totals.count,
    }))
    .sort((left, right) => left.province.localeCompare(right.province));
}

function buildDashboardKpis(riskData: RiskData[]): DashboardKpis {
  const activeNodes = riskData.length;
  const criticalAlerts = riskData.filter((location) => location.riesgo > 0.8).length;
  const nationalRisk = activeNodes === 0 ? 0 : Math.round(average(riskData.map((location) => location.riesgo)) * 100);

  return {
    activeNodes,
    criticalAlerts,
    nationalRisk,
  };
}

function getBaseMockDashboardPayload() {
  if (!cachedMockDashboardPayload) {
    cachedMockDashboardPayload = {
      source: "mock",
      manifestGeneratedAt: null,
      kpis: buildDashboardKpis(mockRiskData),
      riskData: mockRiskData,
      provinceStats: buildProvinceStats(mockRiskData),
      meta: {
        degraded: false,
        selectionReason: null,
        cropKey: null,
        campaignName: null,
        weatherCoveragePct: 0,
        snapshotExport: null,
      },
    };
  }

  return cachedMockDashboardPayload;
}

function buildMockDashboardPayload(options?: { degraded?: boolean; selectionReason?: string | null }): DashboardPayload {
  const basePayload = getBaseMockDashboardPayload();

  return {
    ...basePayload,
    meta: {
      ...basePayload.meta,
      degraded: options?.degraded ?? basePayload.meta.degraded,
      selectionReason: options?.selectionReason ?? basePayload.meta.selectionReason,
    },
  };
}

async function getDataSourcesContext(): Promise<CachedDataSourcesContext> {
  const { manifest } = await readParsedExportManifest();

  if (cachedDataSourcesContext?.generatedAt === manifest.generated_at) {
    return cachedDataSourcesContext;
  }

  const resolvedExportsEntries = listResolvedExportsFromManifest(manifest);
  const resolvedExports = Object.fromEntries(
    resolvedExportsEntries.map((entry) => [entry.logicalName, entry]),
  ) as unknown as ResolvedExportsByLogicalName;

  cachedDataSourcesContext = {
    generatedAt: manifest.generated_at,
    resolvedExports,
    snapshotExport: resolvePreferredSnapshotExportFromManifest(manifest),
  };

  return cachedDataSourcesContext;
}

async function loadDimLocations(dimLocationExport: ResolvedExport) {
  return readNdjsonShards<DimLocationRow>(dimLocationExport.shardPaths, (rawValue, context): DimLocationRow =>
    parseNdjsonWithSchema(dimLocationRowSchema, rawValue, context) as DimLocationRow,
  );
}

async function loadLocationSnapshots(snapshotExport: ResolvedPreferredSnapshotExport) {
  return readNdjsonShards<LocationSnapshotRow>(snapshotExport.shardPaths, (rawValue, context): LocationSnapshotRow =>
    parseNdjsonWithSchema(locationSnapshotRowSchema, rawValue, context) as LocationSnapshotRow,
  );
}

async function loadTaxProvince(taxExport: ResolvedExport) {
  return readNdjsonShards<TaxProvinceRow>(taxExport.shardPaths, (rawValue, context): TaxProvinceRow =>
    parseNdjsonWithSchema(taxProvinceRowSchema, rawValue, context) as TaxProvinceRow,
  );
}

async function loadYieldProvinceCampaign(yieldExport: ResolvedExport) {
  return readNdjsonShards<YieldProvinceCampaignRow>(
    yieldExport.shardPaths,
    (rawValue, context): YieldProvinceCampaignRow =>
      parseNdjsonWithSchema(yieldProvinceCampaignRowSchema, rawValue, context) as YieldProvinceCampaignRow,
  );
}

async function loadMartAgroProvinceCampaign(martExport: ResolvedExport) {
  return readNdjsonShards<MartAgroProvinceCampaignRow>(
    martExport.shardPaths,
    (rawValue, context): MartAgroProvinceCampaignRow =>
      parseNdjsonWithSchema(martAgroProvinceCampaignRowSchema, rawValue, context) as MartAgroProvinceCampaignRow,
  );
}

function buildSnapshotByLocationId(rows: LocationSnapshotRow[]) {
  const snapshotByLocationId = new Map<string, LocationSnapshotRow>();

  for (const row of rows) {
    const currentRow = snapshotByLocationId.get(row.location_id);

    if (!currentRow || compareSnapshotRows(row, currentRow) > 0) {
      snapshotByLocationId.set(row.location_id, row);
    }
  }

  return snapshotByLocationId;
}

function selectDefaultCampaign(rows: MartAgroProvinceCampaignRow[]): CampaignSelection {
  const selectionCandidates: Array<{ rows: MartAgroProvinceCampaignRow[]; selectionReason: string }> = [
    {
      rows: rows.filter((row) => row.crop_key === DEFAULT_CROP_KEY && row.has_weather_campaign_data),
      selectionReason: "soja_with_weather",
    },
    {
      rows: rows.filter((row) => row.crop_key === DEFAULT_CROP_KEY),
      selectionReason: "soja_latest",
    },
    {
      rows,
      selectionReason: "global_latest",
    },
  ];

  for (const candidate of selectionCandidates) {
    if (candidate.rows.length === 0) {
      continue;
    }

    const mostRecentRow = candidate.rows.reduce<MartAgroProvinceCampaignRow | null>((currentBestRow, row) => {
      if (!currentBestRow || compareCampaignRecency(row, currentBestRow) > 0) {
        return row;
      }

      return currentBestRow;
    }, null);

    if (mostRecentRow) {
      return {
        cropKey: mostRecentRow.crop_key,
        campaignName: mostRecentRow.campaign_name,
        selectionReason: candidate.selectionReason,
      };
    }
  }

  return {
    cropKey: null,
    campaignName: null,
    selectionReason: "no_campaign_found",
  };
}

function buildYieldByProvinceMap(yieldRows: YieldProvinceCampaignRow[], selection: CampaignSelection) {
  const rowsByProvince = new Map<string, YieldProvinceCampaignRow[]>();

  for (const row of yieldRows) {
    const provinceJoinKey = getProvinceJoinKey(row.province_key, row.province_name);
    const currentRows = rowsByProvince.get(provinceJoinKey) ?? [];
    currentRows.push(row);
    rowsByProvince.set(provinceJoinKey, currentRows);
  }

  const selectedRowsByProvince = new Map<string, YieldProvinceCampaignRow>();

  for (const [provinceJoinKey, provinceRows] of rowsByProvince.entries()) {
    const exactMatchRows = provinceRows.filter(
      (row) => row.crop_key === selection.cropKey && row.campaign_name === selection.campaignName,
    );
    const cropMatchRows = provinceRows.filter((row) => row.crop_key === selection.cropKey);
    const selectedRow = [exactMatchRows, cropMatchRows, provinceRows]
      .map((candidateRows) =>
        candidateRows.reduce<YieldProvinceCampaignRow | null>((currentBestRow, row) => {
          if (!currentBestRow || compareYieldRows(row, currentBestRow) > 0) {
            return row;
          }

          return currentBestRow;
        }, null),
      )
      .find((row): row is YieldProvinceCampaignRow => row !== null);

    if (selectedRow) {
      selectedRowsByProvince.set(provinceJoinKey, selectedRow);
    }
  }

  return selectedRowsByProvince;
}

function buildTaxByProvinceMap(taxRows: TaxProvinceRow[]) {
  const rowsByProvince = new Map<string, TaxProvinceRow>();

  for (const row of taxRows) {
    rowsByProvince.set(getProvinceJoinKey(row.province_key, row.province_name), row);
  }

  return rowsByProvince;
}

function buildClimateScoreContext(snapshotRows: LocationSnapshotRow[]): ClimateScoreContext {
  return {
    humidityStress: createRiskNormalizer(snapshotRows.map((row) => row.relative_humidity_pct), { invert: true }),
    maxTemperatureRisk: createRiskNormalizer(snapshotRows.map((row) => row.max_air_temp_c)),
    minTemperatureRisk: createRiskNormalizer(snapshotRows.map((row) => row.min_air_temp_c), { invert: true }),
    precipitationRisk: createRiskNormalizer(snapshotRows.map((row) => row.precipitation_mm)),
    tempRangeRisk: createRiskNormalizer(snapshotRows.map((row) => row.temp_range_c)),
    vpdRisk: createRiskNormalizer(snapshotRows.map((row) => row.vpd_kpa)),
  };
}

function buildProvinceScoreContext(
  yieldByProvince: Map<string, YieldProvinceCampaignRow>,
  taxByProvince: Map<string, TaxProvinceRow>,
): ProvinceScoreContext {
  const yieldRows = Array.from(yieldByProvince.values());
  const taxRows = Array.from(taxByProvince.values());

  return {
    departmentCoverageRisk: createRiskNormalizer(yieldRows.map((row) => row.department_count), { invert: true }),
    grossTurnoverRisk: createRiskNormalizer(taxRows.map((row) => row.gross_turnover_tax_pct)),
    harvestedShareRisk: createRiskNormalizer(yieldRows.map((row) => row.harvested_share_pct), { invert: true }),
    productionTonnesRisk: createRiskNormalizer(yieldRows.map((row) => row.production_tonnes), { invert: true }),
    taxSpreadRisk: createRiskNormalizer(taxRows.map((row) => row.rural_property_tax_usd_ha_spread)),
    taxUsdHaRisk: createRiskNormalizer(taxRows.map((row) => row.rural_property_tax_usd_ha_avg)),
    yieldRisk: createRiskNormalizer(yieldRows.map((row) => row.yield_kg_ha), { invert: true }),
  };
}

function normalizeSnapshotIndexTotal(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return roundIndex(value <= 1 ? value : value / 100);
}

function buildClimateIndex(snapshotRow: LocationSnapshotRow | null, scoreContext: ClimateScoreContext): IndiceClimatico {
  if (!snapshotRow) {
    return {
      lluvia: NEUTRAL_SCORE,
      estresHidrico: NEUTRAL_SCORE,
      temperatura: NEUTRAL_SCORE,
      total: 0.5,
    };
  }

  const rainSignal = roundScore(
    snapshotRow.climate_rain_signal ??
      Math.max(
        scoreContext.precipitationRisk(snapshotRow.precipitation_mm),
        snapshotRow.heavy_rain_day ? 92 : 0,
        snapshotRow.fungal_risk_day ? 78 : 0,
      ),
  );

  const waterStressSignal = roundScore(
    snapshotRow.climate_water_stress_signal ??
      weightedAverage([
        { value: snapshotRow.dry_day ? 92 : 0, weight: 0.35 },
        { value: scoreContext.vpdRisk(snapshotRow.vpd_kpa), weight: 0.4 },
        { value: scoreContext.humidityStress(snapshotRow.relative_humidity_pct), weight: 0.25 },
      ]),
  );

  const temperatureSignal = roundScore(
    snapshotRow.climate_temperature_signal ??
      Math.max(
        snapshotRow.heat_stress_day ? 92 : 0,
        snapshotRow.frost_day ? 92 : 0,
        weightedAverage([
          { value: scoreContext.maxTemperatureRisk(snapshotRow.max_air_temp_c), weight: 0.4 },
          { value: scoreContext.minTemperatureRisk(snapshotRow.min_air_temp_c), weight: 0.35 },
          { value: scoreContext.tempRangeRisk(snapshotRow.temp_range_c), weight: 0.25 },
        ]),
      ),
  );

  const total = normalizeSnapshotIndexTotal(snapshotRow.climate_index_total) ??
    roundIndex((rainSignal + waterStressSignal + temperatureSignal) / 300);

  return {
    lluvia: rainSignal,
    estresHidrico: waterStressSignal,
    temperatura: temperatureSignal,
    total,
  };
}

function buildProductionIndex(
  yieldRow: YieldProvinceCampaignRow | null,
  climateIndex: IndiceClimatico,
  scoreContext: ProvinceScoreContext,
): IndiceProduccion {
  const rendimientoRisk = yieldRow ? scoreContext.yieldRisk(yieldRow.yield_kg_ha) : NEUTRAL_SCORE;
  const productionVolumeRisk = yieldRow ? scoreContext.productionTonnesRisk(yieldRow.production_tonnes) : NEUTRAL_SCORE;
  const harvestedShareRisk = yieldRow ? scoreContext.harvestedShareRisk(yieldRow.harvested_share_pct) : NEUTRAL_SCORE;
  const departmentCoverageRisk = yieldRow ? scoreContext.departmentCoverageRisk(yieldRow.department_count) : NEUTRAL_SCORE;

  const rendimiento = roundScore(rendimientoRisk);
  const calidadCultivo = roundScore(climateIndex.total * 100 * 0.6 + productionVolumeRisk * 0.4);
  const eficiencia = roundScore(harvestedShareRisk * 0.75 + departmentCoverageRisk * 0.25);

  return {
    rendimiento,
    calidadCultivo,
    eficiencia,
    total: roundIndex((rendimiento + calidadCultivo + eficiencia) / 300),
  };
}

function buildFinancialIndex(
  taxRow: TaxProvinceRow | null,
  yieldRow: YieldProvinceCampaignRow | null,
  productionIndex: IndiceProduccion,
  scoreContext: ProvinceScoreContext,
): IndiceFinanciero {
  const taxUsdHaRisk = taxRow ? scoreContext.taxUsdHaRisk(taxRow.rural_property_tax_usd_ha_avg) : NEUTRAL_SCORE;
  const taxSpreadRisk = taxRow ? scoreContext.taxSpreadRisk(taxRow.rural_property_tax_usd_ha_spread) : NEUTRAL_SCORE;
  const grossTurnoverRisk = taxRow ? scoreContext.grossTurnoverRisk(taxRow.gross_turnover_tax_pct) : NEUTRAL_SCORE;
  const productionVolumeRisk = yieldRow ? scoreContext.productionTonnesRisk(yieldRow.production_tonnes) : NEUTRAL_SCORE;
  const yieldRisk = yieldRow ? scoreContext.yieldRisk(yieldRow.yield_kg_ha) : NEUTRAL_SCORE;

  const costoInsumos = roundScore(taxUsdHaRisk * 0.5 + grossTurnoverRisk * 0.3 + taxSpreadRisk * 0.2);
  const precioMercado = roundScore(productionVolumeRisk * 0.6 + yieldRisk * 0.4);
  const rentabilidad = roundScore(
    costoInsumos * 0.45 + productionIndex.rendimiento * 0.35 + productionIndex.eficiencia * 0.2,
  );

  return {
    costoInsumos,
    precioMercado,
    rentabilidad,
    total: roundIndex((costoInsumos + precioMercado + rentabilidad) / 300),
  };
}

function buildPestSignal(snapshotRow: LocationSnapshotRow | null, climateIndex: IndiceClimatico) {
  if (!snapshotRow) {
    return roundScore((climateIndex.lluvia + climateIndex.temperatura) / 2);
  }

  return roundScore(
    Math.max(
      snapshotRow.fungal_risk_day ? 85 : 0,
      climateIndex.lluvia * 0.55 + climateIndex.temperatura * 0.45,
    ),
  );
}

async function buildGcsDashboardPayload(): Promise<DashboardPayload> {
  const { generatedAt, resolvedExports, snapshotExport } = await getDataSourcesContext();

  if (!snapshotExport) {
    throw new AgroDataError(
      "Missing compact dashboard snapshot export. Expected marts.app_location_snapshot or marts.latest_weather_by_location.",
    );
  }

  const cacheKey = `${generatedAt}:${snapshotExport.canonicalKey}`;

  if (cachedDashboardPayloadContext?.cacheKey === cacheKey) {
    return cachedDashboardPayloadContext.payload;
  }

  const [dimLocations, snapshotRows, martRows, taxRows, yieldRows] = await Promise.all([
    loadDimLocations(resolvedExports.dim_location),
    loadLocationSnapshots(snapshotExport),
    loadMartAgroProvinceCampaign(resolvedExports.mart_agro_province_campaign),
    loadTaxProvince(resolvedExports.fct_tax_province),
    loadYieldProvinceCampaign(resolvedExports.fct_yield_province_campaign),
  ]);

  const uniqueDimLocations = Array.from(new Map(dimLocations.map((row) => [row.location_id, row])).values());
  const snapshotByLocationId = buildSnapshotByLocationId(snapshotRows);
  const weatherCoveragePct =
    uniqueDimLocations.length === 0 ? 0 : roundPercent((snapshotByLocationId.size / uniqueDimLocations.length) * 100);

  const selection = selectDefaultCampaign(martRows);
  const taxByProvince = buildTaxByProvinceMap(taxRows);
  const yieldByProvince = buildYieldByProvinceMap(yieldRows, selection);
  const climateScoreContext = buildClimateScoreContext(Array.from(snapshotByLocationId.values()));
  const provinceScoreContext = buildProvinceScoreContext(yieldByProvince, taxByProvince);

  const riskData = uniqueDimLocations.reduce<RiskData[]>((locations, location) => {
    const provinceJoinKey = getProvinceJoinKey(location.province_key, location.province_name);
    const snapshotRow = snapshotByLocationId.get(location.location_id) ?? null;
    const isActive = snapshotRow?.is_active ?? (Boolean(snapshotRow) || location.is_catalog_location);

    if (!isActive) {
      return locations;
    }

    const yieldRow = yieldByProvince.get(provinceJoinKey) ?? null;
    const taxRow = taxByProvince.get(provinceJoinKey) ?? null;
    const indiceClimatico = buildClimateIndex(snapshotRow, climateScoreContext);
    const indiceProduccion = buildProductionIndex(yieldRow, indiceClimatico, provinceScoreContext);
    const indiceFinanciero = buildFinancialIndex(taxRow, yieldRow, indiceProduccion, provinceScoreContext);
    const indiceGlobal = roundIndex(
      indiceClimatico.total * GLOBAL_INDEX_WEIGHTS.climatic +
        indiceProduccion.total * GLOBAL_INDEX_WEIGHTS.production +
        indiceFinanciero.total * GLOBAL_INDEX_WEIGHTS.financial,
    );

    locations.push({
      location_id: location.location_id,
      location_name: snapshotRow?.location_name ?? location.location_name,
      province_name: snapshotRow?.province_name ?? location.province_name,
      latitude: snapshotRow?.latitude ?? location.latitude,
      longitude: snapshotRow?.longitude ?? location.longitude,
      country_code: snapshotRow?.country_code ?? location.country_code,
      is_active: true,
      indiceGlobal,
      indiceFinanciero,
      indiceProduccion,
      indiceClimatico,
      riesgo: indiceGlobal,
      lluvia: indiceClimatico.lluvia,
      estres: indiceClimatico.estresHidrico,
      plagas: buildPestSignal(snapshotRow, indiceClimatico),
    });

    return locations;
  }, []);

  riskData.sort((left, right) => {
    const provinceComparison = left.province_name.localeCompare(right.province_name);
    return provinceComparison !== 0 ? provinceComparison : left.location_name.localeCompare(right.location_name);
  });

  const payload: DashboardPayload = {
    source: "gcs",
    manifestGeneratedAt: generatedAt,
    kpis: buildDashboardKpis(riskData),
    riskData,
    provinceStats: buildProvinceStats(riskData),
    meta: {
      degraded: weatherCoveragePct < 100 || selection.selectionReason !== "soja_with_weather",
      selectionReason: selection.selectionReason,
      cropKey: selection.cropKey,
      campaignName: selection.campaignName,
      weatherCoveragePct,
      snapshotExport: snapshotExport.canonicalKey,
    },
  };

  cachedDashboardPayloadContext = {
    cacheKey,
    payload,
  };

  return payload;
}

export async function getDashboardPayload(): Promise<DashboardPayload> {
  const env = getAgroEnv();

  if (env.AGRO_DATA_SOURCE === "mock") {
    return buildMockDashboardPayload();
  }

  try {
    return await buildGcsDashboardPayload();
  } catch (error) {
    if (env.AGRO_FALLBACK_TO_MOCK) {
      return buildMockDashboardPayload({
        degraded: true,
        selectionReason: "fallback_to_mock",
      });
    }

    if (error instanceof AgroDataError) {
      throw error;
    }

    throw new AgroDataError("Failed to build dashboard payload from AgroProtect exports.", { cause: error });
  }
}
