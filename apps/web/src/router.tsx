import { createRouter } from "@tanstack/react-router";

import Loader from "@/components/loader";
import { queryClient } from "@/lib/query-client";
import { routeTree } from "./routeTree.gen";

export type RouterAppContext = {
  queryClient: typeof queryClient;
};

export const getRouter = () =>
  createRouter({
    routeTree,
    defaultPreload: "intent",
    defaultPendingComponent: () => <Loader />,
    context: {
      queryClient,
    },
  });

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
