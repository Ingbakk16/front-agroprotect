export const NODE_CRITICAL_RISK_THRESHOLD = 0.52;
export const NODE_SURVEILLANCE_RISK_THRESHOLD = 0.4;

export type NodeRiskLevel = "critical" | "surveillance" | "safe";

export function getNodeRiskLevel(risk: number): NodeRiskLevel {
  if (risk > NODE_CRITICAL_RISK_THRESHOLD) {
    return "critical";
  }

  if (risk > NODE_SURVEILLANCE_RISK_THRESHOLD) {
    return "surveillance";
  }

  return "safe";
}
