import {
  type CustomData,
  type CustomSeriesOptions,
  type CustomSeriesWhitespaceData,
  customSeriesDefaultOptions,
  type ICustomSeriesPaneRenderer,
  type ICustomSeriesPaneView,
  type PaneRendererCustomData,
  type Time,
} from "lightweight-charts";

// An illustrative custom value, deliberately without native close/value fields.
export type DensityRow = CustomData<Time> & { intensity: number };
export type DensityOptions = CustomSeriesOptions & { ink: string };
export const densityRows: readonly DensityRow[] = Object.freeze([
  Object.freeze({ time: "2026-10-01", intensity: 20 }),
  Object.freeze({ time: "2026-10-02", intensity: 40 }),
  Object.freeze({ time: "2026-10-03", intensity: 30 }),
]);
export class DensityView implements ICustomSeriesPaneView<Time, DensityRow, DensityOptions> {
  private data?: PaneRendererCustomData<Time, DensityRow>;
  private options = this.defaultOptions();
  renderer(): ICustomSeriesPaneRenderer {
    return {
      draw: (target, priceToCoordinate) =>
        target.useMediaCoordinateSpace(({ context }) => {
          context.fillStyle = this.options.ink;
          for (const bar of this.data?.bars ?? []) {
            const y = priceToCoordinate(bar.originalData.intensity);
            if (y !== null) context.fillRect(bar.x - 9, y - 5, 18, 10);
          }
        }),
    };
  }
  update(data: PaneRendererCustomData<Time, DensityRow>, options: DensityOptions) {
    this.data = data;
    this.options = options;
  }
  priceValueBuilder(row: DensityRow) {
    return [row.intensity];
  }
  isWhitespace(
    row: DensityRow | CustomSeriesWhitespaceData<Time>,
  ): row is CustomSeriesWhitespaceData<Time> {
    return !("intensity" in row);
  }
  defaultOptions(): DensityOptions {
    return { ...customSeriesDefaultOptions, ink: "#d000d0" };
  }
  destroy() {
    this.data = undefined;
  }
}
