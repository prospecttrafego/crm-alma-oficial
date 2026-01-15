/**
 * Hook for message search functionality
 * Provides search state, results, and pagination with proper accumulation
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { conversationsApi, type MessageSearchResult } from "@/lib/api/conversations";

interface UseMessageSearchOptions {
  conversationId?: number;
  enabled?: boolean;
}

interface UseMessageSearchReturn {
  query: string;
  setQuery: (query: string) => void;
  results: MessageSearchResult[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
  reset: () => void;
}

/**
 * Hook for searching messages with proper pagination (results accumulate)
 */
export function useMessageSearch(options: UseMessageSearchOptions = {}): UseMessageSearchReturn {
  const { conversationId, enabled = true } = options;

  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [accumulatedResults, setAccumulatedResults] = useState<MessageSearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Track the previous offset to detect when we're loading more
  const prevOffsetRef = useRef(offset);

  // Search query
  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
  } = useQuery({
    queryKey: ["/api/messages/search", query, conversationId, offset],
    queryFn: () =>
      conversationsApi.searchMessages({
        q: query,
        conversationId,
        limit,
        offset,
      }),
    enabled: enabled && query.length >= 2,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Accumulate results when data changes
  useEffect(() => {
    if (data) {
      setTotal(data.total);

      if (offset === 0) {
        // New search or query change - replace results
        setAccumulatedResults(data.results);
      } else if (offset > prevOffsetRef.current) {
        // Loading more - append results
        setAccumulatedResults((prev) => [...prev, ...data.results]);
      }

      prevOffsetRef.current = offset;
    }
  }, [data, offset]);

  const hasMore = accumulatedResults.length < total;

  const loadMore = useCallback(() => {
    if (hasMore && !isFetching) {
      setOffset((prev) => prev + limit);
    }
  }, [hasMore, isFetching]);

  const reset = useCallback(() => {
    setQuery("");
    setOffset(0);
    setAccumulatedResults([]);
    setTotal(0);
    prevOffsetRef.current = 0;
  }, []);

  const handleSetQuery = useCallback((newQuery: string) => {
    setQuery(newQuery);
    setOffset(0);
    setAccumulatedResults([]);
    setTotal(0);
    prevOffsetRef.current = 0;
  }, []);

  return {
    query,
    setQuery: handleSetQuery,
    results: accumulatedResults,
    total,
    isLoading: isLoading || (isFetching && offset > 0), // Show loading when fetching more
    isError,
    error: error as Error | null,
    hasMore,
    loadMore,
    reset,
  };
}
