import {
  consumeStream,
  convertToModelMessages,
  streamText,
  UIMessage,
} from "ai";
import { groq } from "@ai-sdk/groq";
import { google } from "@ai-sdk/google";

import { getDashboardPayload, getLocationDetailPayload } from "@/lib/server/agro-data";
import { AgroConfigError, AgroNotFoundError } from "@/lib/server/errors";

export const maxDuration = 30;

interface ChatRequestBody {
  messages: UIMessage[];
  locationId?: string | null;
}

type AIProvider = "google" | "groq";

const DEFAULT_GOOGLE_MODEL = "gemini-2.0-flash";
const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant";

function getConfiguredProvider(): AIProvider {
  const configuredProvider = process.env.AI_PROVIDER?.trim().toLowerCase();

  if (configuredProvider === "google" || configuredProvider === "groq") {
    return configuredProvider;
  }

  if (process.env.GROQ_API_KEY) {
    return "groq";
  }

  return "google";
}

function getConfiguredModel(provider: AIProvider) {
  const configuredModel = process.env.AI_MODEL?.trim();

  if (configuredModel) {
    return configuredModel;
  }

  return provider === "groq" ? DEFAULT_GROQ_MODEL : DEFAULT_GOOGLE_MODEL;
}

function getChatModel() {
  const provider = getConfiguredProvider();
  const modelName = getConfiguredModel(provider);

  if (provider === "groq") {
    if (!process.env.GROQ_API_KEY) {
      throw new AgroConfigError("GROQ_API_KEY is required when AI_PROVIDER=groq.");
    }

    return {
      provider,
      modelName,
      model: groq(modelName),
    };
  }

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new AgroConfigError("GOOGLE_GENERATIVE_AI_API_KEY is required when AI_PROVIDER=google.");
  }

  return {
    provider,
    modelName,
    model: google(modelName),
  };
}

function getRiskStatusLabel(risk: number) {
  if (risk > 0.8) {
    return "CRITICAL";
  }

  if (risk > 0.5) {
    return "SURVEILLANCE";
  }

  return "SAFE";
}

function formatNullableNumber(value: number | null | undefined, suffix = "") {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "N/A";
  }

  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  }).format(value)}${suffix}`;
}

function buildDashboardSummaryContext(dashboardPayload: Awaited<ReturnType<typeof getDashboardPayload>>) {
  return `
DASHBOARD SUMMARY:
- Data source: ${dashboardPayload.source}
- Manifest generated at: ${dashboardPayload.manifestGeneratedAt ?? "N/A"}
- Active nodes: ${dashboardPayload.kpis.activeNodes}
- Critical alerts: ${dashboardPayload.kpis.criticalAlerts}
- National risk: ${dashboardPayload.kpis.nationalRisk}%
- Crop focus: ${dashboardPayload.meta.cropKey ?? "N/A"}
- Campaign: ${dashboardPayload.meta.campaignName ?? "N/A"}
- Weather coverage: ${dashboardPayload.meta.weatherCoveragePct}%
- Snapshot export: ${dashboardPayload.meta.snapshotExport ?? "N/A"}
`.trim();
}

function buildLocationContext(locationDetailPayload: Awaited<ReturnType<typeof getLocationDetailPayload>>) {
  const { detail, source, manifestGeneratedAt } = locationDetailPayload;
  const { summary, provinceContext } = detail;

  return `
SELECTED LOCATION DETAIL:
- Data source: ${source}
- Manifest generated at: ${manifestGeneratedAt ?? "N/A"}
- Location: ${summary.location_name}
- Province: ${summary.province_name}
- Coordinates: ${summary.latitude.toFixed(4)}, ${summary.longitude.toFixed(4)}
- Snapshot date: ${detail.snapshotDate ?? "N/A"}
- Crop focus: ${detail.cropKey ?? "N/A"}
- Campaign: ${detail.campaignName ?? "N/A"}
- Selection reason: ${detail.selectionReason ?? "N/A"}
- Global risk: ${Math.round(summary.riesgo * 100)}% (${getRiskStatusLabel(summary.riesgo)})
- Climate index: ${Math.round(summary.indiceClimatico.total * 100)}%
- Financial index: ${Math.round(summary.indiceFinanciero.total * 100)}%
- Production index: ${Math.round(summary.indiceProduccion.total * 100)}%
- Rain signal: ${summary.indiceClimatico.lluvia}%
- Water stress: ${summary.indiceClimatico.estresHidrico}%
- Temperature risk: ${summary.indiceClimatico.temperatura}%
- Pest pressure proxy: ${summary.plagas}%
- Yield: ${formatNullableNumber(provinceContext.yieldKgHa, " kg/ha")}
- Harvested share: ${formatNullableNumber(provinceContext.harvestedSharePct, "%")}
- Department count: ${formatNullableNumber(provinceContext.departmentCount)}
- Production tonnes: ${formatNullableNumber(provinceContext.productionTonnes)}
- Rural property tax average: ${formatNullableNumber(provinceContext.ruralPropertyTaxUsdHaAvg, " USD/ha")}
- Rural property tax spread: ${formatNullableNumber(provinceContext.ruralPropertyTaxUsdHaSpread, " USD/ha")}
- Gross turnover tax: ${formatNullableNumber(provinceContext.grossTurnoverTaxPct, "%")}
- Weather campaign data available: ${provinceContext.hasWeatherCampaignData === null ? "N/A" : provinceContext.hasWeatherCampaignData ? "yes" : "no"}
- Tax data available: ${provinceContext.hasTaxData === null ? "N/A" : provinceContext.hasTaxData ? "yes" : "no"}
`.trim();
}

async function buildChatContext(locationId?: string | null) {
  const dashboardPayload = await getDashboardPayload();
  const sections = [buildDashboardSummaryContext(dashboardPayload)];

  if (!locationId) {
    sections.push("No specific location is selected right now. Provide general dashboard guidance unless the user asks to focus on a province or node.");
    return sections.join("\n\n");
  }

  try {
    const locationDetailPayload = await getLocationDetailPayload(locationId);
    sections.push(buildLocationContext(locationDetailPayload));
  } catch (error) {
    if (error instanceof AgroNotFoundError) {
      sections.push(`The requested locationId \"${locationId}\" was not found. Fall back to dashboard-level guidance.`);
      return sections.join("\n\n");
    }

    throw error;
  }

  return sections.join("\n\n");
}

export async function POST(req: Request) {
  const { messages, locationId }: ChatRequestBody = await req.json();
  const context = await buildChatContext(locationId);
  const { provider, modelName, model } = getChatModel();

  const systemPrompt = `You are AgroProtect AI, an expert assistant in agricultural risk analysis for Argentina.
You receive curated frontend data prepared from AgroProtect exports in GCS.
Some UI labels are product-friendly proxies, especially market price, profitability, rain probability, and pest pressure. Treat them as derived signals, not direct market observations.
The current language model provider is ${provider} using model ${modelName}.

CURRENT DATA CONTEXT:
${context}

Your role is to:
- Analyze the selected location or the dashboard summary using the provided live data
- Explain the meaning of risk levels, climate signals, tax pressure, and yield context
- Provide concise, practical agricultural recommendations for Argentina
- Be explicit when a metric is a proxy or when context is provincial instead of location-specific
- If no location is selected, answer using the general dashboard summary only

Keep responses concise but informative. Use specific numbers when helpful.
Always respond in English.`;

  const result = streamText({
    model,
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    abortSignal: req.signal,
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    consumeSseStream: consumeStream,
  });
}
