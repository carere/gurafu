import { createFileRoute } from "@tanstack/solid-router";
import { Basics } from "@/components/examples/basics";
import basicsSource from "@/components/examples/basics.tsx?raw";
import { DataHistory } from "@/components/examples/data-history";
import dataHistorySource from "@/components/examples/data-history.tsx?raw";
import { ExtensionsLifecycle } from "@/components/examples/extensions";
import extensionsSource from "@/components/examples/extensions.tsx?raw";
import { IndicatorsPanes } from "@/components/examples/indicators-panes";
import indicatorsSource from "@/components/examples/indicators-panes.tsx?raw";
import { NativePanes } from "@/components/examples/native-panes";
import panesSource from "@/components/examples/native-panes.tsx?raw";
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
      <Basics />
      <details class="text-sm">
        <summary class="cursor-pointer underline-offset-4 hover:underline focus-visible:outline-2">
          Read the Basics source
        </summary>
        <pre class="mt-4 overflow-x-auto rounded-lg bg-muted p-4 text-xs">
          <code>{basicsSource}</code>
        </pre>
      </details>
      <NativePanes />
      <details class="text-sm">
        <summary class="cursor-pointer underline-offset-4 hover:underline focus-visible:outline-2">
          Read the native panes source
        </summary>
        <pre class="mt-4 overflow-x-auto rounded-lg bg-muted p-4 text-xs">
          <code>{panesSource}</code>
        </pre>
      </details>
      <IndicatorsPanes />
      <details class="text-sm">
        <summary class="cursor-pointer underline-offset-4 hover:underline focus-visible:outline-2">
          Read the Indicators and panes source
        </summary>
        <pre class="mt-4 overflow-x-auto rounded-lg bg-muted p-4 text-xs">
          <code>{indicatorsSource}</code>
        </pre>
      </details>
      <DataHistory />
      <details class="text-sm">
        <summary class="cursor-pointer underline-offset-4 hover:underline focus-visible:outline-2">
          Read the Data and history source
        </summary>
        <pre class="mt-4 overflow-x-auto rounded-lg bg-muted p-4 text-xs">
          <code>{dataHistorySource}</code>
        </pre>
      </details>
      <ExtensionsLifecycle />
      <details class="text-sm">
        <summary class="cursor-pointer underline-offset-4 hover:underline focus-visible:outline-2">
          Read the Extensions and lifecycle source
        </summary>
        <pre class="mt-4 overflow-x-auto rounded-lg bg-muted p-4 text-xs">
          <code>{extensionsSource}</code>
        </pre>
      </details>
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
