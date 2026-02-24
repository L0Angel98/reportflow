# ReportFlow examples

## 1) Maintenance report (A4)

```bash
pnpm render:maintenance
```

Includes:

- checklist table with 200 rows
- long observations text with overflow handling
- 2 images with `maxHeight`
- header/footer page numbering

## 2) IoT operational report (LETTER)

```bash
pnpm render:iot
```

Includes:

- KPI summary row
- long historical table
- repeated table headers across pages

## 3) Executive IoT report (A4)

```bash
pnpm render:executive
```

Includes:

- branded visual cover
- global `ThemeProvider`
- non-splittable KPI cards
- chart
- long table for pagination stress
- long observations section
- global watermark (`CONFIDENCIAL`)

## 4) Executive Performance report (same template, 4 themes)

```bash
pnpm render:executive-performance:teal
pnpm render:executive-performance:blue
pnpm render:executive-performance:green
pnpm render:executive-performance:purple
```

The same template file `examples/executive-performance-report.tsx` is reused with:

- teal corporate palette
- blue financial palette
- green industrial palette
- purple SaaS palette

Only theme tokens change; layout and typography stay identical.

## 5) Operations & Trends report (canvas/editorial showcase)

```bash
pnpm render:operations:blue
pnpm render:operations:teal
```

Includes:

- dynamic cover with large narrative blocks and visual rhythm
- KPI dashboard section with mixed block sizes
- multiple charts integrated with text (area, line, bar, pie)
- insights section with cards and badges
- long detailed table with repeated header
- executive closure with long text plus final KPIs
- same template rendered with different themes
