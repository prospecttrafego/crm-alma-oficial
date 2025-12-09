import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

interface LeadScoreBadgeProps {
  score: number | null | undefined;
  size?: "sm" | "default";
  showIcon?: boolean;
}

export function LeadScoreBadge({ score, size = "default", showIcon = true }: LeadScoreBadgeProps) {
  if (score === null || score === undefined) {
    return null;
  }

  const getScoreColor = (s: number) => {
    if (s >= 80) return "bg-green-500/20 text-green-400 border-green-500/30";
    if (s >= 60) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    if (s >= 40) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    if (s >= 20) return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    return "bg-red-500/20 text-red-400 border-red-500/30";
  };

  const getScoreLabel = (s: number) => {
    if (s >= 80) return "Hot";
    if (s >= 60) return "Warm";
    if (s >= 40) return "Neutral";
    if (s >= 20) return "Cool";
    return "Cold";
  };

  return (
    <Badge 
      variant="outline" 
      className={`${getScoreColor(score)} ${size === "sm" ? "text-xs px-1.5 py-0" : ""}`}
      data-testid={`badge-lead-score-${score}`}
    >
      {showIcon && <Sparkles className="w-3 h-3 mr-1" />}
      {score} - {getScoreLabel(score)}
    </Badge>
  );
}
