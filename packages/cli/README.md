# @reportflow/cli

CLI to render ReportFlow templates into PDF files.

## Install

```bash
pnpm add -D @reportflow/cli
```

## Usage

```bash
reportflow render --template ./examples/report.tsx --data ./examples/data/maintenance.json --out ./out/report.pdf
reportflow dev --template ./examples/report.tsx --data ./examples/data/maintenance.json --out ./out/report.pdf
```

## Commands

- `render`: one-shot PDF generation
- `dev`: watch mode for template/data changes

License: MIT
