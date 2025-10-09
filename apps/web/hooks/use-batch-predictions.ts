import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  BatchPredictionRequest,
  BatchPredictionResult,
} from "@/lib/api/ml";
import { batchPredict } from "@/lib/api/ml";

export function useBatchPredict() {
  return useMutation<BatchPredictionResult, Error, BatchPredictionRequest>({
    mutationFn: batchPredict,
    onSuccess: (data) => {
      toast.success(`Предсказания завершены: ${data.count} успешно`);
    },
    onError: (error) => {
      toast.error(`Ошибка batch prediction: ${error.message}`);
    },
  });
}
