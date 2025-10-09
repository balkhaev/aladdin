import { useQuery } from "@tanstack/react-query";
import type { ScrapersOverview } from "@/lib/api/social";
import { getScrapersOverview } from "@/lib/api/social";

export function useScrapersOverview() {
  return useQuery<ScrapersOverview, Error>({
    queryKey: ["social", "scrapers", "overview"],
    queryFn: getScrapersOverview,
    refetchInterval: 30_000, // Refresh every 30 seconds
  });
}
