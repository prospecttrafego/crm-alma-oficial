import OpenAI from "openai";

// This is using Replit's AI Integrations service, which provides OpenAI-compatible API access without requiring your own OpenAI API key.
// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

export interface ScoreFactors {
  engagement: number;
  dealValue: number;
  activityLevel: number;
  recency: number;
  completeness: number;
}

export interface LeadScoringResult {
  score: number;
  factors: ScoreFactors;
  recommendation: string;
  nextBestAction: string;
}

interface ContactData {
  id: number;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  companyName?: string | null;
  source?: string | null;
  tags?: string[] | null;
}

interface DealData {
  id: number;
  title: string;
  value?: string | null;
  stageName: string;
  stageOrder: number;
  totalStages: number;
  probability?: number | null;
  status?: string | null;
  contactName?: string | null;
  companyName?: string | null;
}

interface ActivitySummary {
  totalActivities: number;
  completedActivities: number;
  pendingActivities: number;
  lastActivityDate?: Date | null;
  activityTypes: Record<string, number>;
}

interface ConversationSummary {
  totalConversations: number;
  totalMessages: number;
  lastMessageDate?: Date | null;
  channels: string[];
}

export async function scoreContact(
  contact: ContactData,
  activities: ActivitySummary,
  conversations: ConversationSummary,
  deals: { count: number; totalValue: number; wonDeals: number }
): Promise<LeadScoringResult> {
  const completenessScore = calculateContactCompleteness(contact);
  const recencyScore = calculateRecency(activities.lastActivityDate, conversations.lastMessageDate);
  const activityScore = calculateActivityScore(activities);
  const engagementScore = calculateEngagementScore(conversations, activities);
  const dealValueScore = calculateDealValueScore(deals.totalValue, deals.wonDeals);

  const factors: ScoreFactors = {
    engagement: engagementScore,
    dealValue: dealValueScore,
    activityLevel: activityScore,
    recency: recencyScore,
    completeness: completenessScore,
  };

  const baseScore = Math.round(
    (engagementScore * 0.25 +
      dealValueScore * 0.25 +
      activityScore * 0.2 +
      recencyScore * 0.15 +
      completenessScore * 0.15) *
      100
  );

  const score = Math.min(100, Math.max(0, baseScore));

  const { recommendation, nextBestAction } = await getAIRecommendation(
    "contact",
    {
      name: `${contact.firstName} ${contact.lastName || ""}`.trim(),
      email: contact.email,
      company: contact.companyName,
      jobTitle: contact.jobTitle,
      score,
      factors,
      activities: {
        total: activities.totalActivities,
        completed: activities.completedActivities,
        pending: activities.pendingActivities,
      },
      conversations: {
        total: conversations.totalConversations,
        messages: conversations.totalMessages,
      },
      deals: {
        count: deals.count,
        totalValue: deals.totalValue,
        wonDeals: deals.wonDeals,
      },
    }
  );

  return { score, factors, recommendation, nextBestAction };
}

export async function scoreDeal(
  deal: DealData,
  activities: ActivitySummary,
  conversations: ConversationSummary
): Promise<LeadScoringResult> {
  const completenessScore = calculateDealCompleteness(deal);
  const recencyScore = calculateRecency(activities.lastActivityDate, conversations.lastMessageDate);
  const activityScore = calculateActivityScore(activities);
  const engagementScore = calculateEngagementScore(conversations, activities);
  const dealValueScore = calculateDealProgressScore(deal);

  const factors: ScoreFactors = {
    engagement: engagementScore,
    dealValue: dealValueScore,
    activityLevel: activityScore,
    recency: recencyScore,
    completeness: completenessScore,
  };

  const baseScore = Math.round(
    (engagementScore * 0.2 +
      dealValueScore * 0.3 +
      activityScore * 0.2 +
      recencyScore * 0.15 +
      completenessScore * 0.15) *
      100
  );

  const score = Math.min(100, Math.max(0, baseScore));

  const { recommendation, nextBestAction } = await getAIRecommendation(
    "deal",
    {
      title: deal.title,
      value: deal.value,
      stage: deal.stageName,
      stageProgress: `${deal.stageOrder}/${deal.totalStages}`,
      probability: deal.probability,
      status: deal.status,
      contact: deal.contactName,
      company: deal.companyName,
      score,
      factors,
      activities: {
        total: activities.totalActivities,
        completed: activities.completedActivities,
        pending: activities.pendingActivities,
      },
      conversations: {
        total: conversations.totalConversations,
        messages: conversations.totalMessages,
      },
    }
  );

  return { score, factors, recommendation, nextBestAction };
}

function calculateContactCompleteness(contact: ContactData): number {
  let filled = 0;
  const total = 6;
  if (contact.firstName) filled++;
  if (contact.lastName) filled++;
  if (contact.email) filled++;
  if (contact.phone) filled++;
  if (contact.jobTitle) filled++;
  if (contact.companyName) filled++;
  return filled / total;
}

function calculateDealCompleteness(deal: DealData): number {
  let filled = 0;
  const total = 5;
  if (deal.title) filled++;
  if (deal.value && parseFloat(deal.value) > 0) filled++;
  if (deal.contactName) filled++;
  if (deal.companyName) filled++;
  if (deal.probability !== null && deal.probability !== undefined) filled++;
  return filled / total;
}

function calculateRecency(
  lastActivityDate?: Date | null,
  lastMessageDate?: Date | null
): number {
  const now = new Date();
  const dates = [lastActivityDate, lastMessageDate].filter(Boolean) as Date[];
  if (dates.length === 0) return 0;

  const mostRecent = new Date(Math.max(...dates.map((d) => new Date(d).getTime())));
  const daysDiff = Math.floor((now.getTime() - mostRecent.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff <= 1) return 1;
  if (daysDiff <= 3) return 0.9;
  if (daysDiff <= 7) return 0.75;
  if (daysDiff <= 14) return 0.5;
  if (daysDiff <= 30) return 0.3;
  return 0.1;
}

function calculateActivityScore(activities: ActivitySummary): number {
  if (activities.totalActivities === 0) return 0;

  const completionRate = activities.completedActivities / activities.totalActivities;
  const activityCount = Math.min(activities.totalActivities / 10, 1);

  return completionRate * 0.6 + activityCount * 0.4;
}

function calculateEngagementScore(
  conversations: ConversationSummary,
  activities: ActivitySummary
): number {
  const messageScore = Math.min(conversations.totalMessages / 20, 1);
  const conversationScore = Math.min(conversations.totalConversations / 5, 1);
  const channelDiversity = Math.min(conversations.channels.length / 3, 1);
  const activityDiversity = Math.min(Object.keys(activities.activityTypes).length / 4, 1);

  return (messageScore * 0.3 + conversationScore * 0.3 + channelDiversity * 0.2 + activityDiversity * 0.2);
}

function calculateDealValueScore(totalValue: number, wonDeals: number): number {
  const valueScore = Math.min(totalValue / 500000, 1);
  const wonScore = Math.min(wonDeals / 3, 1);
  return valueScore * 0.6 + wonScore * 0.4;
}

function calculateDealProgressScore(deal: DealData): number {
  const stageProgress = deal.stageOrder / deal.totalStages;
  const probabilityScore = (deal.probability || 0) / 100;
  const valueScore = deal.value ? Math.min(parseFloat(deal.value) / 100000, 1) : 0;

  return stageProgress * 0.4 + probabilityScore * 0.3 + valueScore * 0.3;
}

async function getAIRecommendation(
  entityType: "contact" | "deal",
  data: Record<string, unknown>
): Promise<{ recommendation: string; nextBestAction: string }> {
  try {
    const prompt =
      entityType === "contact"
        ? `You are a CRM sales assistant. Analyze this contact data and provide a brief recommendation and the next best action.

Contact: ${data.name}
Email: ${data.email || "Not provided"}
Company: ${data.company || "Not provided"}
Job Title: ${data.jobTitle || "Not provided"}
Lead Score: ${data.score}/100

Score Factors:
- Engagement: ${Math.round((data.factors as ScoreFactors).engagement * 100)}%
- Deal Value: ${Math.round((data.factors as ScoreFactors).dealValue * 100)}%
- Activity Level: ${Math.round((data.factors as ScoreFactors).activityLevel * 100)}%
- Recency: ${Math.round((data.factors as ScoreFactors).recency * 100)}%
- Profile Completeness: ${Math.round((data.factors as ScoreFactors).completeness * 100)}%

Activity Summary:
- Total: ${(data.activities as any).total}, Completed: ${(data.activities as any).completed}, Pending: ${(data.activities as any).pending}

Conversation Summary:
- Conversations: ${(data.conversations as any).total}, Messages: ${(data.conversations as any).messages}

Deals:
- Count: ${(data.deals as any).count}, Total Value: R$ ${(data.deals as any).totalValue?.toLocaleString() || 0}, Won: ${(data.deals as any).wonDeals}

Provide a JSON response with:
1. "recommendation": A 2-3 sentence analysis of this contact's potential and current status
2. "nextBestAction": A specific, actionable next step to improve engagement or close deals`
        : `You are a CRM sales assistant. Analyze this deal data and provide a brief recommendation and the next best action.

Deal: ${data.title}
Value: R$ ${data.value ? parseFloat(data.value as string).toLocaleString() : "Not set"}
Stage: ${data.stage} (${data.stageProgress})
Probability: ${data.probability || 0}%
Status: ${data.status}
Contact: ${data.contact || "Not assigned"}
Company: ${data.company || "Not assigned"}
Deal Score: ${data.score}/100

Score Factors:
- Engagement: ${Math.round((data.factors as ScoreFactors).engagement * 100)}%
- Deal Progress: ${Math.round((data.factors as ScoreFactors).dealValue * 100)}%
- Activity Level: ${Math.round((data.factors as ScoreFactors).activityLevel * 100)}%
- Recency: ${Math.round((data.factors as ScoreFactors).recency * 100)}%
- Completeness: ${Math.round((data.factors as ScoreFactors).completeness * 100)}%

Activity Summary:
- Total: ${(data.activities as any).total}, Completed: ${(data.activities as any).completed}, Pending: ${(data.activities as any).pending}

Conversation Summary:
- Conversations: ${(data.conversations as any).total}, Messages: ${(data.conversations as any).messages}

Provide a JSON response with:
1. "recommendation": A 2-3 sentence analysis of this deal's progress and likelihood of closing
2. "nextBestAction": A specific, actionable next step to move this deal forward`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_completion_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      return {
        recommendation: parsed.recommendation || "Unable to generate recommendation",
        nextBestAction: parsed.nextBestAction || "Schedule a follow-up call",
      };
    }
  } catch (error) {
    console.error("AI recommendation error:", error);
  }

  return {
    recommendation: entityType === "contact"
      ? "This contact shows moderate engagement. Consider reaching out to understand their needs better."
      : "This deal is progressing. Focus on addressing any objections and moving to the next stage.",
    nextBestAction: entityType === "contact"
      ? "Schedule a discovery call to understand requirements"
      : "Follow up on pending proposals or schedule a demo",
  };
}
