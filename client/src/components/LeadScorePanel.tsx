import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, RefreshCw, Lightbulb, ArrowRight } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { leadScoresApi } from "@/lib/api/leadScores";
import type { LeadScore } from "@shared/schema";
import { useTranslation } from "@/contexts/LanguageContext";

interface LeadScorePanelProps {
  entityType: "contact" | "deal";
  entityId: number;
}

export function LeadScorePanel({ entityType, entityId }: LeadScorePanelProps) {
  const { t } = useTranslation();
  const { data: leadScore, isLoading } = useQuery<LeadScore | null>({
    queryKey: ["/api/lead-scores", entityType, entityId],
  });

  const calculateMutation = useMutation({
    mutationFn: async () => {
      return leadScoresApi.calculate(entityType, entityId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lead-scores", entityType, entityId] });
    },
  });

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-emerald-400";
    if (score >= 40) return "text-yellow-400";
    if (score >= 20) return "text-orange-400";
    return "text-red-400";
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-emerald-500";
    if (score >= 40) return "bg-yellow-500";
    if (score >= 20) return "bg-orange-500";
    return "bg-red-500";
  };

  const factors = leadScore?.factors as {
    engagement: number;
    dealValue: number;
    activityLevel: number;
    recency: number;
    completeness: number;
  } | null;

  return (
    <Card data-testid="panel-lead-score">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          {t("leadScore.title")}
        </CardTitle>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => calculateMutation.mutate()}
          disabled={calculateMutation.isPending}
          data-testid="button-calculate-score"
        >
          <RefreshCw className={`w-4 h-4 ${calculateMutation.isPending ? "animate-spin" : ""}`} />
          {leadScore ? t("leadScore.refresh") : t("leadScore.calculate")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">{t("leadScore.loading")}</div>
        ) : !leadScore ? (
          <div className="text-sm text-muted-foreground">
            {t("leadScore.empty")}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <div className={`text-4xl font-bold ${getScoreColor(leadScore.score)}`} data-testid="text-lead-score">
                {leadScore.score}
              </div>
              <div className="flex-1">
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div 
                    className={`h-full transition-all ${getProgressColor(leadScore.score)}`}
                    style={{ width: `${leadScore.score}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t("leadScore.outOf", { total: 100 })}
                </div>
              </div>
            </div>

            {factors && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {t("leadScore.scoreFactors")}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("leadScore.engagement")}</span>
                    <span>{Math.round(factors.engagement * 100)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {entityType === "deal" ? t("leadScore.progress") : t("leadScore.dealValue")}
                    </span>
                    <span>{Math.round(factors.dealValue * 100)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("leadScore.activity")}</span>
                    <span>{Math.round(factors.activityLevel * 100)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("leadScore.recency")}</span>
                    <span>{Math.round(factors.recency * 100)}%</span>
                  </div>
                  <div className="flex justify-between col-span-2">
                    <span className="text-muted-foreground">{t("leadScore.completeness")}</span>
                    <span>{Math.round(factors.completeness * 100)}%</span>
                  </div>
                </div>
              </div>
            )}

            {leadScore.recommendation && (
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-start gap-2">
                  <Lightbulb className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      {t("leadScore.aiInsight")}
                    </div>
                    <p className="text-sm" data-testid="text-recommendation">{leadScore.recommendation}</p>
                  </div>
                </div>
              </div>
            )}

            {leadScore.nextBestAction && (
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      {t("leadScore.nextBestAction")}
                    </div>
                    <p className="text-sm font-medium" data-testid="text-next-action">{leadScore.nextBestAction}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
