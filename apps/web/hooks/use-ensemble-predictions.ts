import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  EnsemblePredictionRequest,
  EnsemblePredictionResult,
} from "@/lib/api/ml";
import { ensemblePredict } from "@/lib/api/ml";

export function useEnsemblePredict(
  params: EnsemblePredictionRequest,
  enabled = false
) {
  return useQuery<EnsemblePredictionResult, Error>({
    queryKey: [
      "ml",
      "ensemble",
      params.symbol,
      params.horizon,
      params.strategy,
    ],
    queryFn: () => ensemblePredict(params),
    enabled: enabled && Boolean(params.symbol),
  });
}

export function useEnsemblePredictMutation() {
  return useMutation<
    EnsemblePredictionResult,
    Error,
    EnsemblePredictionRequest
  >({
    mutationFn: ensemblePredict,
  });
}

