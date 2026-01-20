import { useQuery } from "@tanstack/react-query";
import { conversationsApi, type ConversationWithRelations } from "@/lib/api/conversations";

export function useInboxConversations() {
  const { data: conversations, isLoading: conversationsLoading } = useQuery<ConversationWithRelations[]>({
    queryKey: ["/api/conversations"],
    queryFn: conversationsApi.list,
  });

  return { conversations, conversationsLoading };
}
