import { For, type JSX, splitProps } from "solid-js";
import { Button } from "./chart-control-button";

export type ChartReplayControlsProps = Omit<JSX.HTMLAttributes<HTMLFieldSetElement>, "onChange"> & {
  playing: boolean;
  speed: number;
  speeds: readonly number[];
  disabled?: boolean;
  canStep?: boolean;
  onPlayingChange?: (playing: boolean) => void;
  onSpeedChange?: (speed: number) => void;
  onStep?: () => void;
  onExit?: () => void;
  labels?: Partial<Record<"replay" | "play" | "pause" | "speed" | "step" | "exit", string>>;
  formatSpeed?: (speed: number) => string;
};
/** Request-only presentation. Clock, cutoff and restoration belong to the consumer. */
export function ChartReplayControls(props: ChartReplayControlsProps) {
  const [local, dom] = splitProps(props, [
    "playing",
    "speed",
    "speeds",
    "disabled",
    "canStep",
    "onPlayingChange",
    "onSpeedChange",
    "onStep",
    "onExit",
    "labels",
    "formatSpeed",
    "children",
  ]);
  const label = (key: keyof NonNullable<ChartReplayControlsProps["labels"]>, fallback: string) =>
    local.labels?.[key] ?? fallback;
  return (
    <fieldset
      {...dom}
      disabled={local.disabled}
      class={`flex flex-wrap items-center gap-2 ${dom.class ?? ""}`}
    >
      <legend>{label("replay", "Replay")}</legend>
      <Button
        variant="outline"
        disabled={local.disabled || (!local.playing && local.canStep === false)}
        aria-pressed={local.playing}
        onClick={() => local.onPlayingChange?.(!local.playing)}
      >
        {local.playing ? label("pause", "Pause") : label("play", "Play")}
      </Button>
      <label class="flex items-center gap-2">
        {label("speed", "Replay speed")}
        <select
          class="rounded-md border border-input bg-background px-2 py-1 focus-visible:outline-2"
          disabled={local.disabled}
          value={local.speed}
          onChange={(event) => {
            const speed = Number(event.currentTarget.value);
            if (local.speeds.includes(speed)) local.onSpeedChange?.(speed);
            event.currentTarget.value = String(local.speed);
          }}
        >
          <For each={local.speeds}>
            {(speed) => (
              <option value={speed} selected={speed === local.speed}>
                {local.formatSpeed?.(speed) ?? `${speed}×`}
              </option>
            )}
          </For>
        </select>
      </label>
      <Button
        variant="outline"
        disabled={local.disabled || local.canStep === false}
        onClick={() => local.onStep?.()}
      >
        {label("step", "Step forward")}
      </Button>
      <Button variant="outline" disabled={local.disabled} onClick={() => local.onExit?.()}>
        {label("exit", "Exit replay")}
      </Button>
      {local.children}
    </fieldset>
  );
}
