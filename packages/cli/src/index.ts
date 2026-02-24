#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { watch } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { renderToPdf, type RFNode } from "@reportflow/core";

type ArgMap = Record<string, string | boolean>;

interface ParsedArgs {
  command?: string;
  flags: ArgMap;
  positional: string[];
}

type TemplateFactory = (data: unknown) => RFNode | Promise<RFNode>;

interface TsxApi {
  register: () => () => void;
}

let tsxUnregister: (() => void) | undefined;

const ensureTsx = async (): Promise<void> => {
  if (!tsxUnregister) {
    const api = (await import("tsx/esm/api")) as TsxApi;
    tsxUnregister = api.register();
  }
};

const parseArgs = (argv: string[]): ParsedArgs => {
  const [command, ...rest] = argv;
  const flags: ArgMap = {};
  const positional: string[] = [];

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
      continue;
    }

    flags[key] = next;
    index += 1;
  }

  return { command, flags, positional };
};

const getRequiredFlag = (flags: ArgMap, key: string): string => {
  const value = flags[key];
  if (typeof value !== "string") {
    throw new Error(`Falta --${key}`);
  }
  return value;
};

const loadTemplate = async (templatePath: string): Promise<TemplateFactory> => {
  await ensureTsx();
  const url = `${pathToFileURL(templatePath).href}?v=${Date.now()}`;
  const mod = await import(url);
  const candidate = (mod.default ?? mod.template ?? mod.createTemplate) as unknown;
  if (typeof candidate !== "function") {
    throw new Error(
      "La plantilla debe exportar `default` o `template` como función que retorne un RFNode."
    );
  }
  return candidate as TemplateFactory;
};

const renderOnce = async (
  templatePathRaw: string,
  dataPathRaw: string,
  outPathRaw: string
): Promise<void> => {
  const templatePath = path.resolve(templatePathRaw);
  const dataPath = path.resolve(dataPathRaw);
  const outPath = path.resolve(outPathRaw);

  const [templateFactory, dataText] = await Promise.all([
    loadTemplate(templatePath),
    readFile(dataPath, "utf-8")
  ]);

  const data = JSON.parse(dataText) as unknown;
  const node = await templateFactory(data);
  const pdf = await renderToPdf(node, {
    assetBaseDir: path.dirname(templatePath),
    title: "ReportFlow Report"
  });

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, Buffer.from(pdf));
  console.log(`[reportflow] PDF generado: ${outPath}`);
};

const printHelp = (): void => {
  console.log(`
ReportFlow CLI

Uso:
  reportflow render --template ./examples/report.tsx --data ./examples/data/maintenance.json --out ./out/report.pdf
  reportflow dev --template ./examples/report.tsx --data ./examples/data/maintenance.json --out ./out/report.pdf
`);
};

const runRender = async (flags: ArgMap): Promise<void> => {
  const template = getRequiredFlag(flags, "template");
  const data = getRequiredFlag(flags, "data");
  const out = typeof flags.out === "string" ? flags.out : "./out/report.pdf";
  await renderOnce(template, data, out);
};

const runDev = async (flags: ArgMap): Promise<void> => {
  const template = getRequiredFlag(flags, "template");
  const data = getRequiredFlag(flags, "data");
  const out = typeof flags.out === "string" ? flags.out : "./out/report.pdf";

  const templateAbs = path.resolve(template);
  const dataAbs = path.resolve(data);
  const templateDir = path.dirname(templateAbs);
  const dataDir = path.dirname(dataAbs);
  const dirs = Array.from(new Set([templateDir, dataDir]));

  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;

  const schedule = (): void => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(async () => {
      if (running) {
        return;
      }
      running = true;
      try {
        await renderOnce(templateAbs, dataAbs, out);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[reportflow] Error en render: ${message}`);
      } finally {
        running = false;
      }
    }, 200);
  };

  await renderOnce(templateAbs, dataAbs, out);
  console.log("[reportflow] Modo watch activo. Ctrl+C para salir.");

  const watchers = dirs.map((dir) =>
    watch(dir, { recursive: false }, (_event, filename) => {
      if (!filename) {
        return;
      }
      const changedPath = path.resolve(dir, filename.toString());
      if (changedPath === templateAbs || changedPath === dataAbs) {
        schedule();
      }
    })
  );

  const closeAll = (): void => {
    for (const watcher of watchers) {
      watcher.close();
    }
    if (tsxUnregister) {
      tsxUnregister();
    }
  };

  process.on("SIGINT", () => {
    closeAll();
    process.exit(0);
  });
};

const main = async (): Promise<void> => {
  try {
    const parsed = parseArgs(process.argv.slice(2));
    if (!parsed.command || parsed.command === "help" || parsed.command === "--help") {
      printHelp();
      return;
    }

    if (parsed.command === "render") {
      await runRender(parsed.flags);
      return;
    }

    if (parsed.command === "dev") {
      await runDev(parsed.flags);
      return;
    }

    throw new Error(`Comando desconocido: ${parsed.command}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[reportflow] ${message}`);
    process.exitCode = 1;
  }
};

void main();
