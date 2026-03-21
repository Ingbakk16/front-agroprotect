"use client";

import { useEffect, useState } from "react";
import { X, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { ProvinceStats } from "@/lib/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";

interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  provinceStats: ProvinceStats[];
}

interface ProvinceAnalyticsResponse {
  source: "gcs" | "mock";
  manifestGeneratedAt: string | null;
  provinceStats: ProvinceStats[];
  meta: {
    cropKey: string | null;
    campaignName: string | null;
    selectionReason: string | null;
  };
}

const getRiskColor = (risk: number) => {
  if (risk > 70) return "#c50100";
  if (risk > 40) return "#fd9000";
  return "#39ff14";
};

const getRiskLevel = (risk: number) => {
  if (risk > 70) return "Critical";
  if (risk > 40) return "Surveillance";
  return "Safe";
};

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { province: string; averageRisk: number; count: number } }> }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-surface-container-highest border border-border rounded-lg p-3 shadow-xl">
        <p className="font-bold text-foreground text-sm">{data.province}</p>
        <p className="text-muted-foreground text-xs mt-1">
          Risk: <span style={{ color: getRiskColor(data.averageRisk) }}>{data.averageRisk}%</span>
        </p>
        <p className="text-muted-foreground text-xs">
          Nodes: {data.count}
        </p>
      </div>
    );
  }
  return null;
};

export function AnalyticsModal({
  isOpen,
  onClose,
  provinceStats,
}: AnalyticsModalProps) {
  const [analyticsData, setAnalyticsData] = useState<ProvinceAnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const controller = new AbortController();

    async function loadProvinceAnalytics() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch("/api/data/provinces", {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Province analytics request failed with status ${response.status}`);
        }

        const payload = (await response.json()) as ProvinceAnalyticsResponse;
        setAnalyticsData(payload);
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }

        const message = fetchError instanceof Error ? fetchError.message : "Failed to load province analytics.";
        setError(message);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadProvinceAnalytics();

    return () => {
      controller.abort();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const activeProvinceStats = analyticsData?.provinceStats ?? provinceStats;
  const sortedStats = [...activeProvinceStats].sort((a, b) => b.averageRisk - a.averageRisk);
  const avgNational = sortedStats.length === 0
    ? 0
    : Math.round(sortedStats.reduce((sum, province) => sum + province.averageRisk, 0) / sortedStats.length);

  const criticalCount = sortedStats.filter(p => p.averageRisk > 70).length;
  const vigilanceCount = sortedStats.filter(p => p.averageRisk > 40 && p.averageRisk <= 70).length;
  const safeCount = sortedStats.filter(p => p.averageRisk <= 40).length;
  const subtitleParts = [analyticsData?.meta.cropKey, analyticsData?.meta.campaignName].filter(Boolean);

  return (
    <div 
      className="fixed inset-0 z-[2000] flex items-start justify-center bg-black/80 backdrop-blur-md p-4 md:p-6 overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card border border-border w-full max-w-5xl rounded-2xl p-6 md:p-8 relative my-4 md:my-10">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors z-10 bg-surface-container rounded-full p-1.5"
        >
          <X className="w-5 h-5" />
        </button>
        
        <h2 className="text-2xl font-black text-primary mb-2">
          Risk Analytics by Province
        </h2>
        <p className="text-muted-foreground text-sm mb-6">
          Comparative analysis of risk indices in all monitored provinces
          {subtitleParts.length > 0 ? ` - ${subtitleParts.join(" / ")}` : ""}
        </p>
        {isLoading ? (
          <p className="text-xs text-muted-foreground mb-4">Refreshing province analytics...</p>
        ) : analyticsData?.source === "mock" ? (
          <p className="text-xs text-secondary mb-4">Showing fallback demo analytics while live province data is unavailable.</p>
        ) : error ? (
          <p className="text-xs text-destructive mb-4">{error}</p>
        ) : null}

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-surface-container rounded-xl p-4 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-on-tertiary-container" />
              <span className="text-xs text-muted-foreground uppercase font-bold">Critical</span>
            </div>
            <p className="text-2xl font-black text-on-tertiary-container">{criticalCount}</p>
            <p className="text-xs text-muted-foreground">provinces</p>
          </div>
          <div className="bg-surface-container rounded-xl p-4 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-secondary-container" />
              <span className="text-xs text-muted-foreground uppercase font-bold">Surveillance</span>
            </div>
            <p className="text-2xl font-black text-secondary-container">{vigilanceCount}</p>
            <p className="text-xs text-muted-foreground">provinces</p>
          </div>
          <div className="bg-surface-container rounded-xl p-4 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-primary-container" />
              <span className="text-xs text-muted-foreground uppercase font-bold">Safe</span>
            </div>
            <p className="text-2xl font-black text-primary-container">{safeCount}</p>
            <p className="text-xs text-muted-foreground">provinces</p>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-surface-container rounded-xl p-4 border border-border mb-6">
          <h3 className="text-sm font-bold text-foreground mb-4">Risk Index by Province</h3>
          {sortedStats.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
              No province analytics available.
            </div>
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={sortedStats}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis 
                    type="number" 
                    domain={[0, 100]} 
                    tick={{ fill: '#85967c', fontSize: 10 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  />
                  <YAxis 
                    dataKey="province" 
                    type="category" 
                    tick={{ fill: '#dfe2ef', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    width={95}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <ReferenceLine x={avgNational} stroke="#85967c" strokeDasharray="5 5" label={{ value: `Average: ${avgNational}%`, position: 'top', fill: '#85967c', fontSize: 10 }} />
                  <Bar dataKey="averageRisk" radius={[0, 4, 4, 0]} barSize={16}>
                    {sortedStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getRiskColor(entry.averageRisk)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Data Table */}
        <div className="w-full">
          <div className="bg-surface-container rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-border bg-surface-container-high">
                  <th className="text-left p-3 font-bold text-muted-foreground text-xs uppercase">Province</th>
                  <th className="text-center p-3 font-bold text-muted-foreground text-xs uppercase">Nodes</th>
                  <th className="text-center p-3 font-bold text-muted-foreground text-xs uppercase">Risk</th>
                  <th className="text-center p-3 font-bold text-muted-foreground text-xs uppercase">Status</th>
                  <th className="text-right p-3 font-bold text-muted-foreground text-xs uppercase">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedStats.map((stat, index) => {
                  const trend = index % 3 === 0 ? "up" : index % 3 === 1 ? "down" : "stable";
                  return (
                    <tr key={stat.province} className="hover:bg-surface-container-high/50 transition-colors">
                      <td className="p-3 font-medium text-foreground">{stat.province}</td>
                      <td className="p-3 text-center text-muted-foreground tabular">{stat.count}</td>
                      <td className="p-3 text-center">
                        <span 
                          className="font-bold tabular"
                          style={{ color: getRiskColor(stat.averageRisk) }}
                        >
                          {stat.averageRisk}%
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span 
                          className="px-2 py-1 rounded-full text-xs font-bold"
                          style={{ 
                            backgroundColor: `${getRiskColor(stat.averageRisk)}20`,
                            color: getRiskColor(stat.averageRisk)
                          }}
                        >
                          {getRiskLevel(stat.averageRisk)}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {trend === "up" && <TrendingUp className="w-4 h-4 text-on-tertiary-container inline" />}
                        {trend === "down" && <TrendingDown className="w-4 h-4 text-primary-container inline" />}
                        {trend === "stable" && <Minus className="w-4 h-4 text-muted-foreground inline" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
