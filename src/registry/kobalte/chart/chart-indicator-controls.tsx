import { createSignal, For, type JSX, splitProps } from "solid-js";
import { Button } from "./chart-control-button";

type Selection =
  | { value: readonly string[]; defaultValue?: never }
  | { value?: never; defaultValue?: readonly string[] };
export type ChartIndicatorControlsProps = Selection &
  Omit<JSX.HTMLAttributes<HTMLFieldSetElement>, "onChange"> & {
    items: readonly { value: string; label: string; disabled?: boolean }[];
    onValueChange?: (value: readonly string[]) => void;
    label?: string;
  };
/** Selection names consumer choices. Solid declarations own mounting. */
export function ChartIndicatorControls(props: ChartIndicatorControlsProps) {
  const [local, dom] = splitProps(props, [
    "value",
    "defaultValue",
    "items",
    "onValueChange",
    "label",
    "children",
  ]);
  const [selected, setSelected] = createSignal<readonly string[]>([...(local.defaultValue ?? [])]);
  const value = () => local.value ?? selected();
  function request(item: string) {
    const next = value().includes(item) ? value().filter((v) => v !== item) : [...value(), item];
    if (local.value === undefined) setSelected(next);
    local.onValueChange?.(next);
  }
  return (
    <fieldset {...dom} class={`flex flex-wrap gap-2 ${dom.class ?? ""}`}>
      <legend>{local.label ?? "Select indicators"}</legend>
      <For each={local.items}>
        {(item) => (
          <Button
            variant="outline"
            size="sm"
            disabled={item.disabled}
            aria-pressed={value().includes(item.value)}
            onClick={() => request(item.value)}
          >
            {item.label}
          </Button>
        )}
      </For>
      {local.children}
    </fieldset>
  );
}
