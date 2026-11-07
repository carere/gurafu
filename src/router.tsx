import { QueryClientProvider } from "@tanstack/solid-query";
import { createRouter } from "@tanstack/solid-router";
import { onCleanup } from "solid-js";
import { routeTree } from "./routeTree.gen";
import { createMarketApp } from "./services/market/app";

export function getRouter() {
  const app = createMarketApp();
  return createRouter({
    context: app,
    Wrap: (props) => {
      onCleanup(() => {
        void app.dispose();
      });
      return <QueryClientProvider client={app.queryClient}>{props.children}</QueryClientProvider>;
    },
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
  });
}

declare module "@tanstack/solid-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
