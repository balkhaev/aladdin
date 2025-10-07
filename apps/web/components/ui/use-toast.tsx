/**
 * Toast Hook (совместимость с shadcn/ui)
 * Использует sonner для отображения уведомлений
 */

import { toast as sonnerToast } from "sonner";

type ToastProps = {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
};

export function useToast() {
  const toast = ({ title, description, variant }: ToastProps) => {
    if (variant === "destructive") {
      sonnerToast.error(title || "Ошибка", {
        description,
      });
    } else {
      sonnerToast.success(title || "Успешно", {
        description,
      });
    }
  };

  return {
    toast,
  };
}
