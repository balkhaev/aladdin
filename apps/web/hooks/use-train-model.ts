import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { TrainingResult, TrainRequest } from "@/lib/api/ml";
import { trainModel } from "@/lib/api/ml";

export function useTrainModel() {
  const queryClient = useQueryClient();

  return useMutation<TrainingResult, Error, TrainRequest>({
    mutationFn: trainModel,
    onSuccess: (data) => {
      toast.success(
        `Модель ${data.model_type} для ${data.symbol} успешно обучена!`
      );
      // Invalidate models list to show the new model
      queryClient.invalidateQueries({ queryKey: ["ml", "models"] });
    },
    onError: (error) => {
      toast.error(`Ошибка обучения: ${error.message}`);
    },
  });
}

