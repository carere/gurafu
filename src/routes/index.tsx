import { createFileRoute } from "@tanstack/solid-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({ links: [{ rel: "canonical", href: "https://gurafu.carere.dev/" }] }),
  component: Home,
});

function Home() {
  return (
    <main class="mx-auto flex min-h-svh max-w-3xl flex-col justify-center gap-6 px-6 py-20">
      <h1 class="flex items-center gap-3 text-4xl font-semibold tracking-tight">
        <img src="/logo-light.svg" alt="" width="48" height="48" class="dark:hidden" />
        <img src="/logo-dark.svg" alt="" width="48" height="48" class="hidden dark:block" />
        Gurafu
      </h1>
      <p class="max-w-xl text-lg text-muted-foreground">
        Composable trading charts for SolidJS, built on Zaidan and TradingView Lightweight Charts.
      </p>
      <p class="text-muted-foreground">The component registry is taking shape. More soon.</p>
      <div class="flex flex-wrap gap-3">
        <Button as="a" href="https://github.com/carere/gurafu">
          View on GitHub
        </Button>
        <Button as="a" href="https://zaidan.carere.dev" variant="outline">
          Explore Zaidan
        </Button>
      </div>
    </main>
  );
}
