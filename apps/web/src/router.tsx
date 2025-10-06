import { createRouter } from "@tanstack/react-router";

import Loader from "@/components/loader";
import { createQueryClient } from "@/lib/query-client";
import { routeTree } from "./routeTree.gen";

export type RouterAppContext = {
  queryClient: ReturnType<typeof createQueryClient>;
};

export const getRouter = () => {
  const queryClient = createQueryClient();

  return createRouter({
    routeTree,
    defaultPreload: "intent",
    defaultPendingComponent: () => <Loader />,
    context: {
      queryClient,
    },
  });
};

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
