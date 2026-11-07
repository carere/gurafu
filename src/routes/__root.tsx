import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from "@tanstack/solid-router";
import { Suspense } from "solid-js";
import { HydrationScript } from "solid-js/web";
import type { MarketApp } from "@/services/market/app";
import stylesheet from "@/styles.css?url";

export const Route = createRootRouteWithContext<MarketApp>()({
  head: () => ({
    meta: [
      { charset: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Gurafu" },
      {
        name: "description",
        content: "Composable trading charts for SolidJS, built on Zaidan and Lightweight Charts.",
      },
    ],
    links: [
      { rel: "stylesheet", href: stylesheet },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: () => (
    <main class="mx-auto max-w-3xl px-6 py-20">
      <h1 class="text-2xl font-semibold">Page not found</h1>
      <a class="mt-4 inline-block underline underline-offset-4" href="/">
        Return to Gurafu
      </a>
    </main>
  ),
});

function RootDocument() {
  return (
    <html lang="en">
      <head>
        <HydrationScript />
      </head>
      <body class="style-vega">
        <HeadContent />
        <Suspense>
          <Outlet />
        </Suspense>
        <Scripts />
      </body>
    </html>
  );
}
