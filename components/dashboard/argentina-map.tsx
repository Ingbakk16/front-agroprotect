"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { RiskData, TipoIndice } from "@/lib/types";
import { getNodeRiskLevel } from "@/lib/risk-thresholds";
import { DollarSign, Factory, Cloud, Layers, Loader2 } from "lucide-react";

// Extend Leaflet types for heat layer
declare module "leaflet" {
  function heatLayer(
    latlngs: [number, number, number][],
    options?: {
      radius?: number;
      blur?: number;
      gradient?: Record<number, string>;
      maxZoom?: number;
      maxOpacity?: number;
      minOpacity?: number;
    }
  ): L.Layer;
}

interface ArgentinaMapProps {
  data: RiskData[];
  onLocationSelect: (location: RiskData) => void;
  selectedIndex: TipoIndice;
  onIndexChange: (index: TipoIndice) => void;
}

const indexOptions: { value: TipoIndice; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'global', label: 'Global', icon: <Layers className="w-4 h-4" />, color: '#39ff14' },
  { value: 'financiero', label: 'Financial', icon: <DollarSign className="w-4 h-4" />, color: '#3b82f6' },
  { value: 'produccion', label: 'Production', icon: <Factory className="w-4 h-4" />, color: '#f59e0b' },
  { value: 'climatico', label: 'Climate', icon: <Cloud className="w-4 h-4" />, color: '#06b6d4' },
];

function getRiskValue(location: RiskData, index: TipoIndice): number {
  switch (index) {
    case 'financiero': return location.indiceFinanciero.total;
    case 'produccion': return location.indiceProduccion.total;
    case 'climatico': return location.indiceClimatico.total;
    default: return location.indiceGlobal;
  }
}

function getMarkerColor(risk: number): string {
  const riskLevel = getNodeRiskLevel(risk);

  if (riskLevel === "critical") return "#c50100";
  if (riskLevel === "surveillance") return "#fd9000";
  return "#39ff14";
}

function getMarkerSize(zoom: number): number {
  if (zoom <= 3) return 5;
  if (zoom <= 4) return 7;
  if (zoom <= 5) return 10;
  if (zoom <= 6) return 14;
  if (zoom <= 7) return 18;
  if (zoom <= 8) return 22;
  return 26;
}

function getMarkerOpacity(zoom: number): { outer: number; inner: number } {
  if (zoom <= 3) return { outer: 0.08, inner: 0.58 };
  if (zoom <= 4) return { outer: 0.1, inner: 0.64 };
  if (zoom <= 5) return { outer: 0.12, inner: 0.7 };
  if (zoom <= 6) return { outer: 0.14, inner: 0.78 };
  return { outer: 0.15, inner: 0.84 };
}

export function ArgentinaMap({ data, onLocationSelect, selectedIndex, onIndexChange }: ArgentinaMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const heatLayerRef = useRef<L.Layer | null>(null);
  /** Ref para siempre poder hacer map.off del último zoomend del heat (evita fugas si el cleanup corre antes del rAF) */
  const heatZoomHandlerRef = useRef<(() => void) | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [canAddHeat, setCanAddHeat] = useState(false);

  const getGradient = useCallback((index: TipoIndice) => {
    switch (index) {
      case "financiero":
        return { 0.4: "#22c55e", 0.6: "#3b82f6", 1: "#c50100" };
      case "produccion":
        return { 0.4: "#22c55e", 0.6: "#f59e0b", 1: "#c50100" };
      case "climatico":
        return { 0.4: "#22c55e", 0.6: "#06b6d4", 1: "#c50100" };
      default:
        return { 0.4: "#39ff14", 0.6: "#fd9000", 1: "#c50100" };
    }
  }, []);

  const heatIntensity = useCallback((risk: number) => {
    const boosted = risk * 1.08 + 0.05;
    return Math.min(1, Math.max(0.08, boosted));
  }, []);

  const heatPoints = useMemo(() => {
    return data.map((c) => {
      const risk = getRiskValue(c, selectedIndex);
      return [c.latitude, c.longitude, heatIntensity(risk)] as [number, number, number];
    });
  }, [data, selectedIndex, heatIntensity]);

  // Initialize map
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapRef.current) return;

    let mounted = true;
    let initTimeout: NodeJS.Timeout;

    const tryInit = () => {
      if (!mounted || !container) return;
      
      const rect = container.getBoundingClientRect();
      if (rect.width < 300 || rect.height < 300) {
        initTimeout = setTimeout(tryInit, 100);
        return;
      }

      const map = L.map(container, {
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true,
      }).setView([-38, -63], 5);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 18,
      }).addTo(map);

      mapRef.current = map;

      // Wait for map to be fully ready before allowing heat layer
      map.whenReady(() => {
        setTimeout(() => {
          if (!mounted) return;
          map.invalidateSize();
          
          // Check size again after invalidate
          const size = map.getSize();
          if (size.x >= 300 && size.y >= 300) {
            setCanAddHeat(true);
            setIsLoading(false);
          } else {
            // Retry
            setTimeout(() => {
              map.invalidateSize();
              setCanAddHeat(true);
              setIsLoading(false);
            }, 500);
          }
        }, 800);
      });
    };

    // Start initialization after a delay
    initTimeout = setTimeout(tryInit, 200);

    return () => {
      mounted = false;
      clearTimeout(initTimeout);
      if (mapRef.current) {
        const m = mapRef.current;
        const hz = heatZoomHandlerRef.current;
        if (hz) {
          m.off("zoomend", hz);
          heatZoomHandlerRef.current = null;
        }
        m.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Add/update heat layer only when canAddHeat is true
  useEffect(() => {
    const map = mapRef.current;
    const container = mapContainerRef.current;
    if (!map || !canAddHeat || !container) return;

    let mounted = true;
    let retryCount = 0;
    const maxRetries = 5;

    const detachHeatZoom = () => {
      const hz = heatZoomHandlerRef.current;
      if (hz) {
        map.off("zoomend", hz);
        heatZoomHandlerRef.current = null;
      }
    };

    const addHeatLayer = async () => {
      if (!mounted || retryCount >= maxRetries) return;
      
      // Check container is visible and has dimensions
      const rect = container.getBoundingClientRect();
      if (rect.width < 300 || rect.height < 300) {
        retryCount++;
        setTimeout(addHeatLayer, 500);
        return;
      }

      // Check map size
      map.invalidateSize();
      const size = map.getSize();
      if (size.x < 300 || size.y < 300) {
        retryCount++;
        setTimeout(addHeatLayer, 500);
        return;
      }

      // Check overlay pane exists and has dimensions
      const overlayPane = map.getPane('overlayPane');
      if (!overlayPane || overlayPane.clientWidth < 100 || overlayPane.clientHeight < 100) {
        retryCount++;
        setTimeout(addHeatLayer, 500);
        return;
      }

      // Remove existing heat layer (y quitar zoom antes de recrear)
      if (heatLayerRef.current) {
        detachHeatZoom();
        try {
          map.removeLayer(heatLayerRef.current);
        } catch {
          // Ignore
        }
        heatLayerRef.current = null;
      }

      // Dynamically import leaflet.heat
      try {
        await import("leaflet.heat");
      } catch {
        return;
      }

      if (!mounted || !mapRef.current) return;

      // Final check before creating heat layer
      const finalSize = mapRef.current.getSize();
      if (finalSize.x < 300 || finalSize.y < 300) return;

      // Use requestAnimationFrame to ensure DOM is painted
      requestAnimationFrame(() => {
        if (!mounted || !mapRef.current) return;

        // One more size check
        const checkSize = mapRef.current.getSize();
        if (checkSize.x < 300 || checkSize.y < 300) return;

        const mapInstance = mapRef.current;
        const zoom = mapInstance.getZoom();

        const heatOptionsForZoom = (z: number) => {
          const radius = Math.round(72 - z * 5);
          const blur = Math.round(34 - z * 2);
          return {
            radius: Math.min(64, Math.max(30, radius)),
            blur: Math.min(32, Math.max(18, blur)),
          };
        };

        try {
          const { radius, blur } = heatOptionsForZoom(zoom);
          const heatLayer = L.heatLayer(heatPoints, {
            radius,
            blur,
            max: 1,
            maxOpacity: 0.78,
            minOpacity: 0.28,
            gradient: getGradient(selectedIndex),
            maxZoom: 14,
          });

          heatLayer.addTo(mapInstance);
          heatLayerRef.current = heatLayer;
          if (typeof heatLayer.bringToBack === "function") {
            heatLayer.bringToBack();
          }

          const syncHeatToZoom = () => {
            const layer = heatLayerRef.current as L.Layer & {
              setOptions?: (o: Record<string, unknown>) => void;
            };
            if (!layer?.setOptions || !mapRef.current) return;
            const z = mapRef.current.getZoom();
            layer.setOptions({
              ...heatOptionsForZoom(z),
              gradient: getGradient(selectedIndex),
              maxOpacity: 0.78,
              minOpacity: 0.28,
              maxZoom: 14,
            });
          };

          detachHeatZoom();
          heatZoomHandlerRef.current = syncHeatToZoom;
          mapInstance.on("zoomend", syncHeatToZoom);
        } catch {
          // Silently fail - heatmap not critical
        }
      });
    };

    // Delay initial add to ensure everything is ready
    const timeoutId = setTimeout(addHeatLayer, 300);

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      detachHeatZoom();
    };
  }, [canAddHeat, heatPoints, selectedIndex, getGradient]);

  // Add/update markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !canAddHeat) return;

    // Clear existing markers
    markersRef.current.forEach(marker => {
      try {
        map.removeLayer(marker);
      } catch {
        // Ignore
      }
    });
    markersRef.current = [];

    const zoom = map.getZoom();
    const markerSize = getMarkerSize(zoom);
    const opacity = getMarkerOpacity(zoom);
    const dotSize = Math.max(markerSize * 0.4, 3); // Minimum 3px dot
    const borderWidth = zoom <= 4 ? 1 : 1.5;

    data.forEach((location) => {
      const risk = getRiskValue(location, selectedIndex);
      const color = getMarkerColor(risk);
      
      const icon = L.divIcon({
        className: "custom-div-icon",
        html: `
          <div style="
            position: relative;
            width: ${markerSize}px;
            height: ${markerSize}px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          ">
            <div style="
              position: absolute;
              width: 100%;
              height: 100%;
              background: ${color};
              border-radius: 50%;
              opacity: ${opacity.outer};
            "></div>
            <div style="
              width: ${dotSize}px;
              height: ${dotSize}px;
              background: ${color};
              border-radius: 50%;
              border: ${borderWidth}px solid rgba(255,255,255,0.6);
              box-shadow: 0 0 ${Math.max(4, markerSize * 0.2)}px ${color}80;
              cursor: pointer;
              z-index: 10;
              opacity: ${opacity.inner};
            "></div>
          </div>
        `,
        iconSize: [markerSize, markerSize],
        iconAnchor: [markerSize / 2, markerSize / 2],
      });

      const marker = L.marker([location.latitude, location.longitude], { icon })
        .addTo(map)
        .on('click', () => onLocationSelect(location));
      
      markersRef.current.push(marker);
    });

    // Handle zoom
    const handleZoom = () => {
      const newZoom = map.getZoom();
      const newSize = getMarkerSize(newZoom);
      const newOpacity = getMarkerOpacity(newZoom);
      const newDotSize = Math.max(newSize * 0.4, 3);
      const newBorderWidth = newZoom <= 4 ? 1 : 1.5;
      
      markersRef.current.forEach((marker, idx) => {
        if (idx >= data.length) return;
        const loc = data[idx];
        const r = getRiskValue(loc, selectedIndex);
        const c = getMarkerColor(r);
        
        marker.setIcon(L.divIcon({
          className: "custom-div-icon",
          html: `
            <div style="
              position: relative;
              width: ${newSize}px;
              height: ${newSize}px;
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
            ">
              <div style="
                position: absolute;
                width: 100%;
                height: 100%;
                background: ${c};
                border-radius: 50%;
                opacity: ${newOpacity.outer};
              "></div>
              <div style="
                width: ${newDotSize}px;
                height: ${newDotSize}px;
                background: ${c};
                border-radius: 50%;
                border: ${newBorderWidth}px solid rgba(255,255,255,0.6);
                box-shadow: 0 0 ${Math.max(4, newSize * 0.2)}px ${c}80;
                cursor: pointer;
                z-index: 10;
                opacity: ${newOpacity.inner};
              "></div>
            </div>
          `,
          iconSize: [newSize, newSize],
          iconAnchor: [newSize / 2, newSize / 2],
        }));
      });
    };

    map.on('zoomend', handleZoom);
    return () => {
      map.off('zoomend', handleZoom);
    };
  }, [canAddHeat, data, selectedIndex, onLocationSelect]);

  // Handle resize
  useEffect(() => {
    const container = mapContainerRef.current;
    const map = mapRef.current;
    if (!container || !map) return;

    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [canAddHeat]);

  // Leaflet misaligns tiles/overlays when the page scrolls unless size is recomputed.
  useEffect(() => {
    const map = mapRef.current;
    const container = mapContainerRef.current;
    if (!map || !container || !canAddHeat) return;

    let rafId = 0;
    const scheduleInvalidate = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        const rect = container.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) return;
        map.invalidateSize({ animate: false });
      });
    };

    window.addEventListener("scroll", scheduleInvalidate, { passive: true });
    window.addEventListener("resize", scheduleInvalidate);

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            scheduleInvalidate();
          }
        }
      },
      { threshold: [0, 0.1, 0.5, 1] }
    );
    io.observe(container);

    return () => {
      window.removeEventListener("scroll", scheduleInvalidate);
      window.removeEventListener("resize", scheduleInvalidate);
      io.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [canAddHeat]);

  const currentOption = indexOptions.find(opt => opt.value === selectedIndex) || indexOptions[0];

  return (
    <div className="isolate z-0 w-full h-full relative rounded-2xl overflow-hidden border border-border bg-surface-container-lowest">
      {isLoading && (
        <div className="absolute inset-0 z-[1001] bg-surface-container flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <span className="text-sm text-muted-foreground">Scanning zones...</span>
          </div>
        </div>
      )}

      <div ref={mapContainerRef} className="relative z-0 h-full w-full" />

      <div className="absolute top-4 left-4 z-[1000]">
        <div className="bg-surface-container/90 backdrop-blur-md rounded-xl border border-border p-1 flex flex-col gap-1">
          {indexOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => onIndexChange(option.value)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                selectedIndex === option.value 
                  ? 'bg-primary/20 text-primary' 
                  : 'text-muted-foreground hover:bg-surface-container-high hover:text-foreground'
              }`}
            >
              <span style={{ color: option.color }}>{option.icon}</span>
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="absolute bottom-4 right-4 z-[1000]">
        <div className="bg-surface-container/90 backdrop-blur-md rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <span style={{ color: currentOption.color }}>{currentOption.icon}</span>
            <span className="text-xs font-bold text-foreground">{currentOption.label} Index</span>
          </div>
          <p className="mb-2 text-[10px] leading-snug text-muted-foreground/90">
            Heat map by index; click a node for detail.
          </p>
          <p className="mb-3 text-[10px] leading-snug text-muted-foreground/75">
            Context layers include NASA Earth observation API data.
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#39ff14]" />
              <span className="text-[10px] text-muted-foreground">Safe (0-40%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#fd9000]" />
              <span className="text-[10px] text-muted-foreground">Surveillance (40-70%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#c50100]" />
              <span className="text-[10px] text-muted-foreground">Critical (70-100%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
