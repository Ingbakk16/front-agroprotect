"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { 
  Satellite, 
  Shield, 
  Zap, 
  BarChart3, 
  MapPin, 
  Bot,
  ChevronDown,
  TrendingUp,
  AlertTriangle,
  Activity,
  ArrowRight,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RiskData, ProvinceStats, TipoIndice } from "@/lib/types";
import { AnalyticsModal } from "@/components/dashboard/analytics-modal";

// Dynamic import for map to avoid SSR issues with Leaflet
const ArgentinaMap = dynamic(
  () => import("@/components/dashboard/argentina-map").then((mod) => mod.ArgentinaMap),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-full rounded-2xl bg-surface-container-lowest overflow-hidden border border-border relative shadow-inner flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading map...</div>
      </div>
    )
  }
);

// Dynamic import for AI Chat with Gemini
const AIChatPanel = dynamic(
  () => import("@/components/dashboard/ai-chat-panel").then((mod) => mod.AIChatPanel),
  { ssr: false }
);



const features = [
  {
    icon: Satellite,
    title: "Satellite Monitoring",
    description: "Real-time data from 117+ monitoring stations distributed throughout Argentina."
  },
  {
    icon: Shield,
    title: "Risk Detection",
    description: "Advanced algorithms that detect climate and agricultural threats before they impact."
  },
  {
    icon: Zap,
    title: "Instant Alerts",
    description: "Immediate notifications when critical conditions are detected in your zone."
  },
  {
    icon: Bot,
    title: "AI Assistant",
    description: "Consult our Gemini-powered assistant with BigQuery integration for deep analysis."
  }
];

interface DashboardKpis {
  activeNodes: number;
  criticalAlerts: number;
  nationalRisk: number;
}

interface DashboardMeta {
  degraded: boolean;
  selectionReason: string | null;
  cropKey: string | null;
  campaignName: string | null;
  weatherCoveragePct: number;
  snapshotExport: string | null;
}

interface DashboardResponse {
  source: "gcs" | "mock";
  manifestGeneratedAt: string | null;
  kpis: DashboardKpis;
  riskData: RiskData[];
  provinceStats: ProvinceStats[];
  meta: DashboardMeta;
}

const EMPTY_KPIS: DashboardKpis = {
  activeNodes: 0,
  criticalAlerts: 0,
  nationalRisk: 0,
};

export default function LandingPage() {
  const [selectedLocation, setSelectedLocation] = useState<RiskData | null>(null);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<TipoIndice>('global');
  const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(null);
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
      try {
        setIsDashboardLoading(true);
        setDashboardError(null);

        const response = await fetch("/api/data/dashboard", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Dashboard request failed with status ${response.status}`);
        }

        const payload = (await response.json()) as DashboardResponse;

        if (!isMounted) {
          return;
        }

        setDashboardData(payload);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message = error instanceof Error ? error.message : "Failed to load dashboard data.";
        setDashboardError(message);
      } finally {
        if (isMounted) {
          setIsDashboardLoading(false);
        }
      }
    }

    void loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, []);

  const riskData = dashboardData?.riskData ?? [];
  const kpis = dashboardData?.kpis ?? EMPTY_KPIS;
  const provinceStats = dashboardData?.provinceStats ?? [];

  useEffect(() => {
    if (!selectedLocation) {
      return;
    }

    const refreshedLocation = riskData.find((location) => location.location_id === selectedLocation.location_id) ?? null;

    if (!refreshedLocation) {
      setSelectedLocation(null);
      return;
    }

    setSelectedLocation(refreshedLocation);
  }, [riskData, selectedLocation]);

  const handleLocationSelect = useCallback((location: RiskData) => {
    setSelectedLocation(location);
    // Stay on details tab when selecting a location
  }, []);

  const scrollToDashboard = () => {
    dashboardRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Satellite className="w-5 h-5 text-primary" />
              </div>
              <span className="text-xl font-black tracking-tight">
                <span className="text-primary">Agro</span>Protect
              </span>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Features
              </a>
              <a href="#dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Dashboard
              </a>
              <button 
                onClick={() => setIsAnalyticsOpen(true)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Analytics
              </button>
              <Button 
                onClick={scrollToDashboard}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                View Demo
              </Button>
            </div>

            {/* Mobile menu button */}
            <button 
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Nav */}
          {mobileMenuOpen && (
            <div className="md:hidden bg-surface-container border-t border-border">
              <div className="px-4 py-4 space-y-3">
                <a href="#features" className="block text-sm text-muted-foreground hover:text-foreground">
                  Features
                </a>
                <a href="#dashboard" className="block text-sm text-muted-foreground hover:text-foreground">
                  Dashboard
                </a>
                <button 
                  onClick={() => { setIsAnalyticsOpen(true); setMobileMenuOpen(false); }}
                  className="block text-sm text-muted-foreground hover:text-foreground"
                >
                  Analytics
                </button>
                <Button 
                  onClick={() => { scrollToDashboard(); setMobileMenuOpen(false); }}
                  className="w-full bg-primary text-primary-foreground"
                >
                  View Demo
                </Button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-secondary/10 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm text-primary font-medium">Real-Time Monitoring</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tight text-balance">
              <span className="text-foreground">Precision Sentinel</span>
              <br />
              <span className="text-primary">for Argentine Agriculture</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto text-pretty">
              Precision agricultural monitoring system with AI. We detect climate and phytosanitary risks 
              before they affect your crops.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button 
                size="lg"
                onClick={scrollToDashboard}
                className="bg-primary text-primary-foreground hover:bg-primary/90 text-lg px-8 py-6 rounded-xl font-semibold group"
              >
                Explore Dashboard
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => setIsAnalyticsOpen(true)}
                className="text-lg px-8 py-6 rounded-xl font-semibold border-border hover:bg-accent"
              >
                <BarChart3 className="w-5 h-5 mr-2" />
                View Analytics
              </Button>
            </div>

            {/* Stats Preview */}
            <div className="grid grid-cols-3 gap-4 sm:gap-8 pt-12 max-w-xl mx-auto">
              <div className="text-center">
                <div className="text-2xl sm:text-4xl font-black text-primary tabular-nums">{isDashboardLoading ? "--" : kpis.activeNodes}</div>
                <div className="text-xs sm:text-sm text-muted-foreground mt-1">Active Stations</div>
              </div>
              <div className="text-center">
                <div className="text-2xl sm:text-4xl font-black text-secondary tabular-nums">{isDashboardLoading ? "--" : `${kpis.nationalRisk}%`}</div>
                <div className="text-xs sm:text-sm text-muted-foreground mt-1">National Risk</div>
              </div>
              <div className="text-center">
                <div className="text-2xl sm:text-4xl font-black text-destructive tabular-nums">{isDashboardLoading ? "--" : kpis.criticalAlerts}</div>
                <div className="text-xs sm:text-sm text-muted-foreground mt-1">Critical Alerts</div>
              </div>
            </div>

            {/* Scroll indicator */}
            <button 
              onClick={scrollToDashboard}
              className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce"
            >
              <ChevronDown className="w-8 h-8 text-muted-foreground" />
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black mb-4">
              <span className="text-primary">Cutting-Edge</span> Technology
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              We combine satellite data, IoT sensors, and AI algorithms to provide you 
              with the most accurate information in the agricultural sector.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="group p-6 rounded-2xl bg-surface-container border border-border hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dashboard Section */}
      <section id="dashboard" ref={dashboardRef} className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black mb-4">
              <span className="text-primary">Interactive</span> Dashboard
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Explore the real-time risk map. Click on any point to get 
              detailed information and consult with our AI assistant.
            </p>
            {isDashboardLoading ? (
              <p className="mt-3 text-sm text-muted-foreground">Loading dashboard data...</p>
            ) : dashboardData?.source === "mock" ? (
              <p className="mt-3 text-sm text-secondary">
                Showing fallback demo data while the live export finishes syncing.
              </p>
            ) : dashboardError ? (
              <p className="mt-3 text-sm text-destructive">{dashboardError}</p>
            ) : null}
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="p-6 rounded-2xl bg-surface-container border border-border">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <div className="text-3xl font-black text-destructive tabular-nums">{isDashboardLoading ? "--" : kpis.criticalAlerts}</div>
                  <div className="text-sm text-muted-foreground">Critical Alerts</div>
                </div>
              </div>
            </div>
            <div className="p-6 rounded-2xl bg-surface-container border border-border">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <div className="text-3xl font-black text-secondary tabular-nums">{isDashboardLoading ? "--" : `${kpis.nationalRisk}%`}</div>
                  <div className="text-sm text-muted-foreground">National Risk</div>
                </div>
              </div>
            </div>
            <div className="p-6 rounded-2xl bg-surface-container border border-border">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Activity className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <div className="text-3xl font-black text-primary tabular-nums">{isDashboardLoading ? "--" : kpis.activeNodes}</div>
                  <div className="text-sm text-muted-foreground">Active Nodes</div>
                </div>
              </div>
            </div>
          </div>

          {/* Map and Detail Panel */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Map */}
            <div className="lg:col-span-2 h-[500px] lg:h-[600px] rounded-2xl overflow-hidden border border-border bg-surface-container-lowest">
              <ArgentinaMap 
                data={riskData} 
                onLocationSelect={handleLocationSelect}
                selectedIndex={selectedIndex}
                onIndexChange={setSelectedIndex}
              />
            </div>

            {/* Detail Panel */}
            <div className="h-[500px] lg:h-[600px] rounded-2xl border border-border bg-surface-container overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="font-semibold">Zone Details</span>
                </div>
                <Button
                  size="sm"
                  onClick={() => setIsChatOpen(true)}
                  className="bg-primary/10 text-primary hover:bg-primary/20 border-0"
                >
                  <Bot className="w-4 h-4 mr-2" />
                  AI Assistant
                </Button>
              </div>

              {/* Content */}
              <div className="flex-1 p-6 overflow-y-auto">
                {selectedLocation ? (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-xl font-bold text-primary">{selectedLocation.location_name}</h3>
                      <p className="text-sm text-muted-foreground">{selectedLocation.province_name}</p>
                    </div>

                    {/* Global Index */}
                    <div className={`p-4 rounded-xl ${
                      selectedLocation.indiceGlobal > 0.7 
                        ? 'bg-destructive/10 border border-destructive/30' 
                        : selectedLocation.indiceGlobal > 0.4 
                        ? 'bg-secondary/10 border border-secondary/30' 
                        : 'bg-primary/10 border border-primary/30'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className={`w-4 h-4 ${
                            selectedLocation.indiceGlobal > 0.7 
                              ? 'text-destructive' 
                              : selectedLocation.indiceGlobal > 0.4 
                              ? 'text-secondary' 
                              : 'text-primary'
                          }`} />
                          <span className="font-bold text-sm">Global Index</span>
                        </div>
                        <span className={`text-lg font-black ${
                          selectedLocation.indiceGlobal > 0.7 
                            ? 'text-destructive' 
                            : selectedLocation.indiceGlobal > 0.4 
                            ? 'text-secondary' 
                            : 'text-primary'
                        }`}>
                          {Math.round(selectedLocation.indiceGlobal * 100)}%
                        </span>
                      </div>
                      <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-700 ${
                            selectedLocation.indiceGlobal > 0.7 
                              ? 'bg-destructive' 
                              : selectedLocation.indiceGlobal > 0.4 
                              ? 'bg-secondary' 
                              : 'bg-primary'
                          }`}
                          style={{ width: `${selectedLocation.indiceGlobal * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Financial Index */}
                    <div className="p-4 rounded-xl bg-surface-container-high border border-border">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-sm text-blue-400">1. Financial Index</span>
                        <span className="font-bold text-blue-400">{Math.round(selectedLocation.indiceFinanciero.total * 100)}%</span>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Input Costs</span>
                            <span className="text-foreground">{selectedLocation.indiceFinanciero.costoInsumos}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 transition-all duration-700" style={{ width: `${selectedLocation.indiceFinanciero.costoInsumos}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Market Price</span>
                            <span className="text-foreground">{selectedLocation.indiceFinanciero.precioMercado}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                            <div className="h-full bg-blue-400 transition-all duration-700" style={{ width: `${selectedLocation.indiceFinanciero.precioMercado}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Profitability</span>
                            <span className="text-foreground">{selectedLocation.indiceFinanciero.rentabilidad}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                            <div className="h-full bg-blue-300 transition-all duration-700" style={{ width: `${selectedLocation.indiceFinanciero.rentabilidad}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Production Index */}
                    <div className="p-4 rounded-xl bg-surface-container-high border border-border">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-sm text-amber-400">2. Production Index</span>
                        <span className="font-bold text-amber-400">{Math.round(selectedLocation.indiceProduccion.total * 100)}%</span>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Yield</span>
                            <span className="text-foreground">{selectedLocation.indiceProduccion.rendimiento}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 transition-all duration-700" style={{ width: `${selectedLocation.indiceProduccion.rendimiento}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Crop Quality</span>
                            <span className="text-foreground">{selectedLocation.indiceProduccion.calidadCultivo}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                            <div className="h-full bg-amber-400 transition-all duration-700" style={{ width: `${selectedLocation.indiceProduccion.calidadCultivo}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Efficiency</span>
                            <span className="text-foreground">{selectedLocation.indiceProduccion.eficiencia}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                            <div className="h-full bg-amber-300 transition-all duration-700" style={{ width: `${selectedLocation.indiceProduccion.eficiencia}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Climate Index */}
                    <div className="p-4 rounded-xl bg-surface-container-high border border-border">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-sm text-cyan-400">3. Climate Index</span>
                        <span className="font-bold text-cyan-400">{Math.round(selectedLocation.indiceClimatico.total * 100)}%</span>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Rain Probability</span>
                            <span className="text-foreground">{selectedLocation.indiceClimatico.lluvia}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                            <div className="h-full bg-cyan-500 transition-all duration-700" style={{ width: `${selectedLocation.indiceClimatico.lluvia}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Water Stress</span>
                            <span className="text-foreground">{selectedLocation.indiceClimatico.estresHidrico}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                            <div className="h-full bg-cyan-400 transition-all duration-700" style={{ width: `${selectedLocation.indiceClimatico.estresHidrico}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Temperature Risk</span>
                            <span className="text-foreground">{selectedLocation.indiceClimatico.temperatura}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                            <div className="h-full bg-cyan-300 transition-all duration-700" style={{ width: `${selectedLocation.indiceClimatico.temperatura}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    <Button 
                      onClick={() => setIsChatOpen(true)}
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <Bot className="w-4 h-4 mr-2" />
                      Consult AI Assistant
                    </Button>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center mb-4">
                      <MapPin className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-bold mb-2">Select a location</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Click on any zone in the heat map to view details for that area.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Map Legend */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_10px_#39ff14]" />
              <span className="text-sm text-muted-foreground">Low Risk</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-secondary shadow-[0_0_10px_#fd9000]" />
              <span className="text-sm text-muted-foreground">Vigilancia</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-destructive shadow-[0_0_10px_#c50100]" />
              <span className="text-sm text-muted-foreground">Critical</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-surface-container-low">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-black mb-4">
            Protect Your <span className="text-primary">Crops</span> Today
          </h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join the producers who already trust AgroProtect to protect their investments 
            and maximize their agricultural yields.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button 
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 text-lg px-8 py-6 rounded-xl font-semibold"
            >
              Request Demo
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button 
              size="lg"
              variant="outline"
              onClick={() => setIsAnalyticsOpen(true)}
              className="text-lg px-8 py-6 rounded-xl font-semibold border-border hover:bg-accent"
            >
              View Statistics
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-surface-container border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Satellite className="w-4 h-4 text-primary" />
              </div>
              <span className="font-bold">
                <span className="text-primary">Agro</span>Protect
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Precision Sentinel Dashboard - Argentina
            </p>
          </div>
        </div>
      </footer>

      {/* Analytics Modal */}
      <AnalyticsModal
        isOpen={isAnalyticsOpen}
        onClose={() => setIsAnalyticsOpen(false)}
        provinceStats={provinceStats}
      />

      {/* AI Chat Modal - Powered by Gemini + MCP */}
      {isChatOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface-container border border-border w-full max-w-lg h-[600px] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-container-low">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">AgroProtect AI</h3>
                  <p className="text-xs text-muted-foreground">
                    Powered by Google Gemini + BigQuery
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="p-2 rounded-lg hover:bg-surface-container-high transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Chat Content */}
            <div className="flex-1 overflow-hidden">
              <AIChatPanel 
                selectedLocation={selectedLocation} 
                allData={riskData}
                embedded
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
