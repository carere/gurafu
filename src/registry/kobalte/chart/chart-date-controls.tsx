import { createUniqueId, type JSX, Show, splitProps } from "solid-js";
import { Button } from "./chart-control-button";

export type ChartDateControlsProps = Omit<JSX.HTMLAttributes<HTMLFieldSetElement>, "onChange"> & {
  value?: Date;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  onValueChange?: (value: Date) => void;
  onGoToLatest?: () => void;
  labels?: Partial<Record<"navigation" | "date" | "latest", string>>;
  formatDate?: (value: Date) => string;
};
const day = (date?: Date) =>
  date && Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : "";
/** Native calendar input uses UTC calendar days, independently of local timezone. */
export function ChartDateControls(props: ChartDateControlsProps) {
  const [local, dom] = splitProps(props, [
    "value",
    "minDate",
    "maxDate",
    "disabled",
    "onValueChange",
    "onGoToLatest",
    "labels",
    "formatDate",
    "children",
  ]);
  const id = createUniqueId();
  return (
    <fieldset
      {...dom}
      disabled={local.disabled}
      class={`flex flex-wrap items-center gap-2 ${dom.class ?? ""}`}
    >
      <legend>{local.labels?.navigation ?? "Date navigation"}</legend>
      <label for={id}>{local.labels?.date ?? "UTC date"}</label>
      <input
        id={id}
        type="date"
        class="min-w-0 rounded-md border border-input bg-background px-2 py-1 focus-visible:outline-2"
        disabled={local.disabled}
        min={day(local.minDate)}
        max={day(local.maxDate)}
        value={day(local.value)}
        onChange={(event) => {
          const selected = event.currentTarget.value;
          const date = new Date(`${selected}T00:00:00.000Z`);
          if (
            Number.isFinite(date.getTime()) &&
            day(date) === selected &&
            (!day(local.minDate) || selected >= day(local.minDate)) &&
            (!day(local.maxDate) || selected <= day(local.maxDate))
          )
            local.onValueChange?.(date);
          event.currentTarget.value = day(local.value);
        }}
      />
      <Show when={local.value && local.formatDate}>
        <span>{local.value && local.formatDate?.(local.value)}</span>
      </Show>
      <Button variant="outline" disabled={local.disabled} onClick={() => local.onGoToLatest?.()}>
        {local.labels?.latest ?? "Go to latest"}
      </Button>
      {local.children}
    </fieldset>
  );
}
