"use client";

import { MousePointerClick } from "lucide-react";
import { RiskData } from "@/lib/types";

interface DetailPanelProps {
  selectedLocation: RiskData | null;
}

export function DetailPanel({ selectedLocation }: DetailPanelProps) {
  return (
    <aside className="bg-surface-container-lowest/80 backdrop-blur-xl font-sans tabular-nums fixed right-80 top-16 h-[calc(100vh-64px)] w-80 border-l border-border flex flex-col p-6 z-40 shadow-[0_0_40px_rgba(10,14,23,0.8)]">
      {!selectedLocation ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30">
          <MousePointerClick className="w-12 h-12 mb-4" />
          <p className="font-bold text-xs uppercase">
            Select a node
            <br />
            on the map
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          <div className="mb-8">
            <h3 className="text-lg font-bold text-[#efffe3]">
              {selectedLocation.location_name}
            </h3>
            <p className="text-muted-foreground text-xs uppercase font-bold tracking-widest">
              {selectedLocation.province_name}
            </p>
          </div>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-[11px] mb-2 font-bold uppercase text-muted-foreground">
                <span>Rain Probability</span>
                <span className="text-foreground">{selectedLocation.lluvia}%</span>
              </div>
              <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-container transition-all duration-700"
                  style={{ width: `${selectedLocation.lluvia}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[11px] mb-2 font-bold uppercase text-muted-foreground">
                <span>Water Stress</span>
                <span className="text-foreground">{selectedLocation.estres}%</span>
              </div>
              <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                <div
                  className="h-full bg-secondary-container transition-all duration-700"
                  style={{ width: `${selectedLocation.estres}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[11px] mb-2 font-bold uppercase text-muted-foreground">
                <span>Risk Index</span>
                <span className="text-on-tertiary-container">
                  {Math.round(selectedLocation.riesgo * 100)}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                <div
                  className="h-full bg-on-tertiary-container transition-all duration-700"
                  style={{ width: `${selectedLocation.riesgo * 100}%` }}
                />
              </div>
            </div>
          </div>
          <div className="mt-auto p-4 bg-foreground/5 rounded-xl border border-border">
            <p className="text-[10px] font-bold text-secondary-container uppercase mb-2">
              AI Recommendation
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed italic">
              {selectedLocation.riesgo > 0.7
                ? "Critical alert detected. Prioritize irrigation and pest control."
                : "Stable status. Continue with preventive monitoring."}
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
