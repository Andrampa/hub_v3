# Charts and data-viz

The FAO Design System does **not** ship a charting library. You bring your own (Chart.js, ECharts, Plotly, D3, Highcharts, Recharts, Observable Plot). What the design system governs is **color**, **typography**, and **placement** of charts inside the component catalog.

## Color palettes to pass into your chart library

### Primary sequential (single-hue)
Use when one variable is being ramped from low to high.
```
#E5ECF4, #B8CCE2, #87A8CB, #4B7FB2, #116BAC, #0B4F80
```

### Categorical (up to 8 series)
Use for bar/line/pie with a handful of distinct series. Starts with FAO Blue, brings in UN Blue, Caption Blue, Orange, Emergency, Gray Dark. Avoid putting Orange and Emergency next to each other — saturations are close.
```
#116BAC  FAO Blue
#5792C9  UN Blue
#1C4767  Caption Blue
#F58320  Orange
#980000  Emergency Red
#545454  Gray Dark
#999999  Gray Medium
#E5ECF4  Primary Light
```

### Diverging (bipolar values, e.g. % change)
```
#980000 → #E5ECF4 → #116BAC
```

### Quick paste for Chart.js
```js
const faoPalette = {
  primary: '#116BAC',
  primaryLight: '#E5ECF4',
  unBlue: '#5792C9',
  caption: '#1C4767',
  orange: '#F58320',
  emergency: '#980000',
  grayDark: '#545454',
  grayMedium: '#999999',
  grayLight: '#F2F2F2',
};

const categorical = [
  faoPalette.primary, faoPalette.unBlue, faoPalette.caption,
  faoPalette.orange, faoPalette.emergency, faoPalette.grayDark,
  faoPalette.grayMedium, faoPalette.primaryLight,
];
```

## Chart typography

Pass Open Sans through your chart config — charts that default to system-ui or Arial stand out visually from the rest of the interface.

```js
// Chart.js
Chart.defaults.font.family = "'Open Sans', Helvetica, Arial, sans-serif";
Chart.defaults.color = '#545454';          // body text color
Chart.defaults.borderColor = '#F2F2F2';    // axis/grid lines
```

## Placement

Wrap every chart in a `.card` → `.card-body`. This gives it the FAO border, padding, and shadow and lets it sit in a `.row` / `.col-*` grid cleanly.

```html
<div class="card h-100">
  <div class="card-body">
    <h6 class="title-category">Indicator</h6>
    <h5 class="card-title">Chart title</h5>
    <div class="ratio ratio-16x9">
      <canvas id="myChart"></canvas>
    </div>
    <p class="small text-color-gray-medium mb-0 mt-2">Source: FAOSTAT, 2024</p>
  </div>
</div>
```

Using `.ratio.ratio-16x9` (or `.ratio-3x2` for squarer charts, `.ratio-21x9` for long time series) keeps the chart responsive without giving it a fixed height.

## KPI tiles

Don't invent a "`kpi`" class — reuse `.card`:

```html
<div class="card h-100">
  <div class="card-body">
    <h6 class="title-category">Label</h6>
    <h3 class="card-title mb-0">Value</h3>
    <p class="card-text small mb-0 text-color-gray-medium">Sub-text</p>
  </div>
</div>
```

Colour accents:
- `.bg-primary-light` for "featured" KPIs.
- `.text-color-emergency` on the number for "alert" KPIs.
- `.bg-gray-light` for secondary / contextual tiles.

## Maps

For geospatial dashboards, use Leaflet + the official UN basemap tiles (URL in `components.md` § maps). Don't pull in Mapbox / OSM tiles — the UN tiles respect political-boundary norms FAO is required to align with.

Country overlays should use the FAO palette (ramp from `#E5ECF4` to `#116BAC`). For highlighting single countries, use the official flag icon classes (`.flag.flag-<iso3>`) — but in popups or legends, not as mark styles.

## Tables of data

For tabular data displays, the design system's `.table.table-bordered` with `<thead class="bg-gray-light">` is the house style. See `components.md` § Lists for the Project list / Meetings list tabular patterns.

## Things to avoid

- Rainbow sequential palettes (viridis, turbo, inferno) — they clash with FAO Blue's cool tone.
- Red/green dichotomies — fails color-blind accessibility; use FAO Blue / FAO Orange instead.
- Chart libraries' default fonts (system-ui) — set Open Sans globally once at init.
- Gradient fills or glossy 3D bars — not consistent with the flat FAO aesthetic.
