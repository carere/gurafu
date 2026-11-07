import type { MarketApp } from "../../services/market/app";
import appSource from "../../services/market/app.ts?raw";
import binanceSource from "../../services/market/binance.ts?raw";
import datasetSource from "../../services/market/dataset.ts?raw";
import exchangeSource from "../../services/market/exchange.ts?raw";
import fixtureSource from "../../services/market/fixture.ts?raw";
import { Basics } from "./basics";
import basicsSource from "./basics.tsx?raw";
import { DataHistory } from "./data-history";
import dataHistorySource from "./data-history.tsx?raw";
import { ExtensionsLifecycle } from "./extensions";
import extensionsSource from "./extensions.tsx?raw";
import extensionsViewSource from "./extensions-view.ts?raw";
import { IndependentCharts } from "./independent-charts";
import independentSource from "./independent-charts.tsx?raw";
import { IndicatorsPanes } from "./indicators-panes";
import indicatorsSource from "./indicators-panes.tsx?raw";
import { NativePanes } from "./native-panes";
import panesSource from "./native-panes.tsx?raw";
import { ReplayDateNavigation } from "./replay-date";
import replaySource from "./replay-date.tsx?raw";
import replayEvidenceSource from "./replay-evidence.ts?raw";
import replaySessionSource from "./replay-session.ts?raw";
import { ServiceHistory } from "./service-history";
import serviceHistorySource from "./service-history.tsx?raw";

// Direct public compositions; the website owns the shared service runtime.
export function ExampleGallery(props: { app: MarketApp }) {
  return (
    <div class="min-w-0 space-y-12">
      <nav aria-label="Examples" class="flex flex-wrap gap-x-6 gap-y-3 border-y py-4 text-sm">
        <a class="underline underline-offset-4 focus-visible:outline-2" href="#basics">
          Basics
        </a>
        <a class="underline underline-offset-4 focus-visible:outline-2" href="#indicators-panes">
          Indicators and panes
        </a>
        <a class="underline underline-offset-4 focus-visible:outline-2" href="#data-history">
          Data and history
        </a>
        <a class="underline underline-offset-4 focus-visible:outline-2" href="#replay-date">
          Replay and date navigation
        </a>
        <a class="underline underline-offset-4 focus-visible:outline-2" href="#independent-charts">
          Independent charts
        </a>
        <a class="underline underline-offset-4 focus-visible:outline-2" href="#extensions">
          Extensions and lifecycle
        </a>
      </nav>
      <div id="basics" tabIndex={-1} class="min-w-0 space-y-6 focus-visible:outline-2">
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
      </div>
      <div id="indicators-panes" tabIndex={-1} class="min-w-0 space-y-6 focus-visible:outline-2">
        <IndicatorsPanes />
        <details class="text-sm">
          <summary class="cursor-pointer underline-offset-4 hover:underline focus-visible:outline-2">
            Read the Indicators and panes source
          </summary>
          <pre class="mt-4 overflow-x-auto rounded-lg bg-muted p-4 text-xs">
            <code>{indicatorsSource}</code>
          </pre>
        </details>
      </div>
      <div id="data-history" tabIndex={-1} class="min-w-0 space-y-6 focus-visible:outline-2">
        <DataHistory />
        <details class="text-sm">
          <summary class="cursor-pointer underline-offset-4 hover:underline focus-visible:outline-2">
            Read the Data and history source
          </summary>
          <pre class="mt-4 overflow-x-auto rounded-lg bg-muted p-4 text-xs">
            <code>{dataHistorySource}</code>
          </pre>
        </details>
        <ServiceHistory app={props.app} />
        <details class="text-sm">
          <summary class="cursor-pointer underline-offset-4 hover:underline focus-visible:outline-2">
            Read the service-backed history source
          </summary>
          <pre class="mt-4 overflow-x-auto rounded-lg bg-muted p-4 text-xs">
            <code>{serviceHistorySource}</code>
          </pre>
        </details>
        <details class="text-sm">
          <summary class="cursor-pointer underline-offset-4 hover:underline focus-visible:outline-2">
            Read the shared website services (used by history, replay and independent charts)
          </summary>
          <p class="mt-4 text-muted-foreground">
            Website-only policy. These sources are not installed with the chart registry.
          </p>
          <pre class="mt-4 overflow-x-auto rounded-lg bg-muted p-4 text-xs">
            <code>
              {"// app.ts\n"}
              {appSource}
              {"\n// dataset.ts\n"}
              {datasetSource}
              {"\n// exchange.ts\n"}
              {exchangeSource}
              {"\n// binance.ts\n"}
              {binanceSource}
              {"\n// fixture.ts\n"}
              {fixtureSource}
            </code>
          </pre>
        </details>
      </div>
      <div id="replay-date" tabIndex={-1} class="min-w-0 space-y-6 focus-visible:outline-2">
        <ReplayDateNavigation app={props.app} />
        <details class="text-sm">
          <summary class="cursor-pointer underline-offset-4 hover:underline focus-visible:outline-2">
            Read the Replay and date navigation source
          </summary>
          <pre class="mt-4 overflow-x-auto rounded-lg bg-muted p-4 text-xs">
            <code>
              {replaySource}
              {"\n"}
              {replaySessionSource}
              {"\n"}
              {replayEvidenceSource}
            </code>
          </pre>
        </details>
      </div>
      <div id="independent-charts" tabIndex={-1} class="min-w-0 space-y-6 focus-visible:outline-2">
        <IndependentCharts app={props.app} />
        <details class="text-sm">
          <summary class="cursor-pointer underline-offset-4 hover:underline focus-visible:outline-2">
            Read the Independent charts source
          </summary>
          <pre class="mt-4 overflow-x-auto rounded-lg bg-muted p-4 text-xs">
            <code>{independentSource}</code>
          </pre>
        </details>
      </div>
      <div id="extensions" tabIndex={-1} class="min-w-0 space-y-6 focus-visible:outline-2">
        <ExtensionsLifecycle />
        <details class="text-sm">
          <summary class="cursor-pointer underline-offset-4 hover:underline focus-visible:outline-2">
            Read the Extensions and lifecycle source
          </summary>
          <pre class="mt-4 overflow-x-auto rounded-lg bg-muted p-4 text-xs">
            <code>
              {extensionsSource}
              {"\n// extensions-view.ts\n"}
              {extensionsViewSource}
            </code>
          </pre>
        </details>
      </div>
    </div>
  );
}
