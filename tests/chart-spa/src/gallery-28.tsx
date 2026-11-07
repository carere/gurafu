import { createSignal, onCleanup, Show } from "solid-js";
import { ExampleGallery } from "./components/examples/gallery";
import { createMarketApp } from "./services/market/app";
import { createMarketFixture } from "./services/market/fixture";

export function Gallery28() {
  const fixture = createMarketFixture();
  const app = createMarketApp(fixture.layer);
  const [mounted, setMounted] = createSignal(true);
  onCleanup(() => void app.dispose());
  return (
    <main>
      <h1>Gurafu examples</h1>
      <p>
        Deterministic fixture · illustrative prices, static connected streams; no Binance requests.
      </p>
      <button type="button" onClick={() => setMounted(!mounted())}>
        {mounted() ? "Unmount gallery" : "Remount gallery"}
      </button>
      <Show when={mounted()}>
        <ExampleGallery app={app} />
      </Show>
    </main>
  );
}
