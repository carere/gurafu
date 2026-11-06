# Gurafu

Gurafu provides reusable chart components and optional chart features. This glossary distinguishes the parts of a chart from application coordination around it.

## Language

**Chart instance**:
One chart with its own timeline and one or more native panes.
_Avoid_: Pane, workspace panel

**Native pane**:
A distinct plotting region within a chart instance, sharing that chart's timeline with its other panes.
_Avoid_: Separate chart, bottom overlay

**Price overlay**:
An indicator drawn in the price pane using the price scale, such as Bollinger Bands or a price moving average.
_Avoid_: Native pane, bottom indicator

**Volume histogram**:
Bars representing traded volume at each time, distinct from a moving average of volume.
_Avoid_: Volume moving average

**Price moving average**:
A moving average of a price input; SMA means simple moving average and EMA means exponential moving average.
_Avoid_: Volume moving average, unqualified moving average when the input is ambiguous

**Legend**:
The chart's OHLC preview and indicator rows, including their displayed values and visibility controls.
_Avoid_: Axis labels, tooltip

**Replay**:
Progressively revealing historical data according to a selected position in time.
_Avoid_: Trading session, live feed

**Dataset context**:
The identity of the market data a chart displays, such as its symbol and timeframe. Replacing or extending history within that identity does not create a new dataset context.
_Avoid_: Chart instance, history page

**Consumer coordination**:
Application-managed communication between separate chart instances, such as sharing crosshair time or navigation intent.
_Avoid_: Native panes, built-in synchronization
