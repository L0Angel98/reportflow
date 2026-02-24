import {
  LineCapStyle,
  LineJoinStyle,
  PDFDocument,
  StandardFonts,
  appendBezierCurve,
  degrees,
  lineTo,
  moveTo,
  setLineCap,
  setLineJoin,
  setLineWidth,
  setStrokingRgbColor,
  stroke,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage
} from "pdf-lib";
import {
  buildLayout,
  type ChartDrawOp,
  type DrawOp,
  type ImageAsset,
  type WatermarkDrawOp
} from "./layout.js";
import type { RFNode, RenderOptions } from "./types.js";

const UNIFIED_OUTER_STROKE = 1.2;

const applyTokens = (value: string, pageNumber: number, totalPages: number): string =>
  value
    .replace(/\{\{\s*pageNumber\s*\}\}/g, String(pageNumber))
    .replace(/\{\{\s*totalPages\s*\}\}/g, String(totalPages));

const toPdfRgb = (value: { r: number; g: number; b: number }) => rgb(value.r, value.g, value.b);

const roundedRectPath = (
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): string => {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  if (r === 0) {
    return `M ${x} ${y} L ${x + width} ${y} L ${x + width} ${y - height} L ${x} ${y - height} Z`;
  }
  return [
    `M ${x + r} ${y}`,
    `L ${x + width - r} ${y}`,
    `Q ${x + width} ${y} ${x + width} ${y - r}`,
    `L ${x + width} ${y - height + r}`,
    `Q ${x + width} ${y - height} ${x + width - r} ${y - height}`,
    `L ${x + r} ${y - height}`,
    `Q ${x} ${y - height} ${x} ${y - height + r}`,
    `L ${x} ${y - r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    "Z"
  ].join(" ");
};

const drawRoundedBorder = (
  page: PDFPage,
  pageHeight: number,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: { r: number; g: number; b: number },
  thickness: number
): void => {
  if (thickness <= 0 || width <= 0 || height <= 0) {
    return;
  }

  const half = thickness / 2;
  const opticalInset = 0;
  const ix = x + half + opticalInset;
  const iy = y + half + opticalInset;
  const iw = Math.max(0.1, width - thickness - opticalInset * 2);
  const ih = Math.max(0.1, height - thickness - opticalInset * 2);
  const r = Math.max(0, Math.min(radius, iw / 2, ih / 2));
  const yTop = pageHeight - iy;
  const yBottom = pageHeight - (iy + ih);
  const borderColor = toPdfRgb(color);

  if (r <= 0.001) {
    page.drawRectangle({
      x: ix,
      y: yBottom,
      width: iw,
      height: ih,
      borderColor,
      borderWidth: thickness
    });
    return;
  }

  // Un solo path continuo evita picos y cortes entre segmentos.
  const k = 0.5522847498307936; // Aproximacion de arco circular con Bezier cubica.
  const c = r * k;
  const left = ix;
  const right = ix + iw;
  const top = yTop;
  const bottom = yBottom;

  page.pushOperators(
    setLineWidth(thickness),
    setLineJoin(LineJoinStyle.Round),
    setLineCap(LineCapStyle.Butt),
    setStrokingRgbColor(color.r, color.g, color.b),
    moveTo(left + r, top),
    lineTo(right - r, top),
    appendBezierCurve(right - r + c, top, right, top - r + c, right, top - r),
    lineTo(right, bottom + r),
    appendBezierCurve(right, bottom + r - c, right - r + c, bottom, right - r, bottom),
    lineTo(left + r, bottom),
    appendBezierCurve(left + r - c, bottom, left, bottom + r - c, left, bottom + r),
    lineTo(left, top - r),
    appendBezierCurve(left, top - r + c, left + r - c, top, left + r, top),
    stroke()
  );
};

const drawWatermark = (
  op: WatermarkDrawOp,
  page: PDFPage,
  pageWidth: number,
  pageHeight: number,
  font: PDFFont,
  pageNumber: number,
  totalPages: number
): void => {
  const text = applyTokens(op.text, pageNumber, totalPages);
  const textWidth = font.widthOfTextAtSize(text, op.fontSize);
  const x = (pageWidth - textWidth) / 2;
  const y = pageHeight / 2;
  page.drawText(text, {
    x,
    y,
    size: op.fontSize,
    font,
    color: toPdfRgb(op.color),
    rotate: degrees(op.rotate),
    opacity: op.opacity
  });
};

const buildWedgePath = (
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string => {
  const steps = Math.max(8, Math.ceil(Math.abs(endAngle - startAngle) / (Math.PI / 12)));
  const points: Array<{ x: number; y: number }> = [];
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const angle = startAngle + (endAngle - startAngle) * t;
    points.push({
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius
    });
  }

  const first = points[0];
  const commands = [`M ${centerX} ${centerY}`, `L ${first.x} ${first.y}`];
  for (let index = 1; index < points.length; index += 1) {
    commands.push(`L ${points[index].x} ${points[index].y}`);
  }
  commands.push("Z");
  return commands.join(" ");
};

const drawChart = (
  op: ChartDrawOp,
  page: PDFPage,
  pageHeight: number,
  fonts: { normal: PDFFont; bold: PDFFont }
): void => {
  const pad = 10;
  const contentX = op.x + pad;
  const contentY = op.y + pad;
  const contentWidth = Math.max(1, op.width - pad * 2);
  const contentHeight = Math.max(1, op.height - pad * 2);

  const topPdfY = (topY: number): number => pageHeight - topY;
  const rectPdfY = (topY: number, height: number): number => pageHeight - (topY + height);
  const truncateTextToWidth = (
    text: string,
    maxWidth: number,
    fontSize: number,
    suffix = "..."
  ): string => {
    if (maxWidth <= 0) {
      return "";
    }
    if (fonts.normal.widthOfTextAtSize(text, fontSize) <= maxWidth) {
      return text;
    }
    let value = text.trimEnd();
    while (
      value.length > 0 &&
      fonts.normal.widthOfTextAtSize(`${value}${suffix}`, fontSize) > maxWidth
    ) {
      value = value.slice(0, -1);
    }
    return `${value}${suffix}`;
  };
  const splitWordByWidth = (word: string, maxWidth: number, fontSize: number): string[] => {
    const chunks: string[] = [];
    let start = 0;
    while (start < word.length) {
      let end = start + 1;
      while (
        end <= word.length &&
        fonts.normal.widthOfTextAtSize(word.slice(start, end), fontSize) <= maxWidth
      ) {
        end += 1;
      }
      if (end === start + 1) {
        end = Math.min(word.length, start + 1);
      } else {
        end -= 1;
      }
      chunks.push(word.slice(start, end));
      start = end;
    }
    return chunks;
  };
  const wrapAxisLabel = (
    text: string,
    maxWidth: number,
    fontSize: number,
    maxLines: number
  ): string[] => {
    const rawWords = text
      .trim()
      .split(/\s+/)
      .filter((part) => part.length > 0);
    const words = rawWords.flatMap((word) =>
      fonts.normal.widthOfTextAtSize(word, fontSize) <= maxWidth
        ? [word]
        : splitWordByWidth(word, maxWidth, fontSize)
    );
    if (words.length === 0) {
      return [""];
    }

    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (
        fonts.normal.widthOfTextAtSize(candidate, fontSize) <= maxWidth * 1.02 ||
        current.length === 0
      ) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current.length > 0) {
      lines.push(current);
    }

    if (lines.length <= maxLines) {
      return lines;
    }

    const keep = lines.slice(0, Math.max(0, maxLines - 1));
    const mergedTail = lines.slice(Math.max(0, maxLines - 1)).join(" ");
    keep.push(truncateTextToWidth(mergedTail, maxWidth, fontSize));
    return keep;
  };
  const sampleLabelIndices = (total: number, maxItems: number): number[] => {
    if (total <= 0) {
      return [];
    }
    if (total <= maxItems) {
      return Array.from({ length: total }, (_, index) => index);
    }
    if (maxItems <= 1) {
      return [0];
    }
    const step = (total - 1) / (maxItems - 1);
    const picked = new Set<number>();
    for (let index = 0; index < maxItems; index += 1) {
      picked.add(Math.round(index * step));
    }
    return Array.from(picked).sort((a, b) => a - b);
  };
  const drawTopText = (
    text: string,
    x: number,
    topY: number,
    size: number,
    font: PDFFont,
    color: { r: number; g: number; b: number },
    maxWidth?: number
  ): void => {
    page.drawText(text, {
      x,
      y: topPdfY(topY + size),
      size,
      font,
      color: toPdfRgb(color),
      maxWidth
    });
  };

  const framePath =
    op.borderRadius > 0
      ? roundedRectPath(op.x, pageHeight - op.y, op.width, op.height, op.borderRadius)
      : null;

  if (framePath) {
    page.drawSvgPath(framePath, {
      color: toPdfRgb(op.backgroundColor)
    });
  } else {
    page.drawRectangle({
      x: op.x,
      y: rectPdfY(op.y, op.height),
      width: op.width,
      height: op.height,
      color: toPdfRgb(op.backgroundColor)
    });
  }

  const values = op.values.length > 0 ? op.values : [0];
  const labels = op.labels.length > 0 ? op.labels : values.map((_, index) => `S${index + 1}`);
  const palette = op.palette.length > 0 ? op.palette : [op.textColor];

  const yAxisMin = Number.isFinite(op.options.yAxisMin) ? op.options.yAxisMin : 0;
  const autoMax = Math.max(yAxisMin + 1, ...values);
  const yAxisMaxCandidate = Number.isFinite(op.options.yAxisMax) ? op.options.yAxisMax : autoMax;
  const yAxisMax = yAxisMaxCandidate > yAxisMin ? yAxisMaxCandidate : yAxisMin + 1;
  const normalizeY = (value: number): number =>
    Math.min(1, Math.max(0, (value - yAxisMin) / (yAxisMax - yAxisMin)));

  let bodyTop = contentY;
  let bodyBottom = contentY + contentHeight;

  if (op.options.title) {
    const title = op.options.title;
    const titleWidth = fonts.bold.widthOfTextAtSize(title, 11);
    const titleX =
      op.options.titleAlign === "center"
        ? contentX + Math.max(0, (contentWidth - titleWidth) / 2)
        : op.options.titleAlign === "right"
          ? contentX + Math.max(0, contentWidth - titleWidth)
          : contentX;
    drawTopText(title, titleX, bodyTop + 1, 11, fonts.bold, op.textColor);
    bodyTop += 18;
  }

  const legendEnabled = op.options.legend;
  const legendHeight = legendEnabled ? 18 : 0;
  let legendTopY: number | null = null;
  if (legendEnabled && op.options.legendPosition === "top") {
    legendTopY = bodyTop + 1;
    bodyTop += legendHeight;
  } else if (legendEnabled) {
    bodyBottom -= legendHeight;
    legendTopY = bodyBottom + 1;
  }

  const axisLabelFontSize = 7.5;
  const axisLabelLineHeight = axisLabelFontSize + 1.5;
  const axisLabelMaxLines = op.chartType === "bar" ? 2 : 1;
  const axisLabelsHeight = op.chartType === "pie" ? 0 : axisLabelLineHeight * axisLabelMaxLines + 4;
  const plotHeight = Math.max(1, bodyBottom - bodyTop - axisLabelsHeight - 2);
  const plotWidth = contentWidth;
  const plotX = contentX;
  const plotY = bodyTop;
  const drawValueLabel = (text: string, centerX: number, preferredTopY: number): void => {
    const fontSize = 7;
    const padX = 2;
    const padY = 1;
    const textWidth = fonts.normal.widthOfTextAtSize(text, fontSize);
    const boxWidth = textWidth + padX * 2;
    const boxHeight = fontSize + padY * 2;
    const minTop = plotY + 1;
    const maxTop = plotY + plotHeight - boxHeight - 1;
    const topY = Math.max(minTop, Math.min(maxTop, preferredTopY));
    const minX = plotX;
    const maxX = plotX + plotWidth - boxWidth;
    const x = Math.max(minX, Math.min(maxX, centerX - boxWidth / 2));
    page.drawRectangle({
      x,
      y: rectPdfY(topY, boxHeight),
      width: boxWidth,
      height: boxHeight,
      color: toPdfRgb(op.backgroundColor),
      opacity: 0.92
    });
    drawTopText(text, x + padX, topY + padY, fontSize, fonts.normal, op.textColor);
  };

  if (
    op.options.grid &&
    (op.chartType === "bar" || op.chartType === "line" || op.chartType === "area")
  ) {
    const steps = 4;
    for (let step = 0; step <= steps; step += 1) {
      const ratio = step / steps;
      const y = plotY + plotHeight * (1 - ratio);
      page.drawLine({
        start: { x: plotX, y: topPdfY(y) },
        end: { x: plotX + plotWidth, y: topPdfY(y) },
        thickness: 0.4,
        color: toPdfRgb(op.mutedColor),
        opacity: 0.22
      });
    }
  }

  if (op.chartType === "bar") {
    const n = values.length;
    const slot = plotWidth / Math.max(1, n);
    const barWidth = slot * 0.62;
    for (let index = 0; index < n; index += 1) {
      const value = values[index] ?? 0;
      const ratio = normalizeY(value);
      const h = ratio * (plotHeight - 8);
      const x = plotX + index * slot + (slot - barWidth) / 2;
      const y = plotY + plotHeight - h;
      const color = palette[index % palette.length];
      if (h > 0) {
        const radius = Math.max(0, Math.min(5, barWidth / 4, h / 2));
        const bottomY = rectPdfY(y, h);
        if (radius <= 0.01) {
          page.drawRectangle({
            x,
            y: bottomY,
            width: barWidth,
            height: h,
            color: toPdfRgb(color),
            opacity: 0.92
          });
        } else {
          const bodyHeight = Math.max(0, h - radius);
          if (bodyHeight > 0) {
            page.drawRectangle({
              x,
              y: bottomY,
              width: barWidth,
              height: bodyHeight,
              color: toPdfRgb(color),
              opacity: 0.92
            });
          }
          const capY = bottomY + bodyHeight;
          const capWidth = Math.max(0, barWidth - radius * 2);
          if (capWidth > 0) {
            page.drawRectangle({
              x: x + radius,
              y: capY,
              width: capWidth,
              height: radius,
              color: toPdfRgb(color),
              opacity: 0.92
            });
          }
          page.drawCircle({
            x: x + radius,
            y: capY,
            size: radius,
            color: toPdfRgb(color),
            opacity: 0.92
          });
          page.drawCircle({
            x: x + barWidth - radius,
            y: capY,
            size: radius,
            color: toPdfRgb(color),
            opacity: 0.92
          });
        }
      }
      if (op.options.showValues) {
        const valueLabel = String(value);
        drawValueLabel(valueLabel, x + barWidth / 2, y - 12);
      }
    }
  }

  if (op.chartType === "line" || op.chartType === "area") {
    const n = values.length;
    const denominator = Math.max(1, n - 1);
    const points: Array<{ x: number; y: number }> = [];
    for (let index = 0; index < n; index += 1) {
      const ratio = normalizeY(values[index] ?? 0);
      points.push({
        x: plotX + (plotWidth * index) / denominator,
        y: plotY + plotHeight - ratio * (plotHeight - 8)
      });
    }

    if (op.chartType === "area" && points.length > 1) {
      const first = points[0];
      const last = points[points.length - 1];
      const fillPath = [
        `M ${first.x} ${topPdfY(plotY + plotHeight)}`,
        `L ${first.x} ${topPdfY(first.y)}`,
        ...points.slice(1).map((point) => `L ${point.x} ${topPdfY(point.y)}`),
        `L ${last.x} ${topPdfY(plotY + plotHeight)}`,
        "Z"
      ].join(" ");
      page.drawSvgPath(fillPath, {
        color: toPdfRgb(palette[0]),
        opacity: 0.22
      });
    }

    for (let index = 0; index < points.length - 1; index += 1) {
      page.drawLine({
        start: { x: points[index].x, y: topPdfY(points[index].y) },
        end: { x: points[index + 1].x, y: topPdfY(points[index + 1].y) },
        thickness: 1.4,
        color: toPdfRgb(palette[0])
      });
    }
    if (op.options.showPoints) {
      for (let index = 0; index < points.length; index += 1) {
        page.drawCircle({
          x: points[index].x,
          y: topPdfY(points[index].y),
          size: 2.4,
          color: toPdfRgb(palette[0])
        });
      }
    }
    if (op.options.showValues) {
      for (let index = 0; index < points.length; index += 1) {
        const valueLabel = String(values[index] ?? 0);
        const preferredTop =
          points[index].y - 14 < plotY + 1 ? points[index].y + 5 : points[index].y - 14;
        drawValueLabel(valueLabel, points[index].x, preferredTop);
      }
    }
  }

  if (op.chartType === "pie") {
    const total = values.reduce((acc, value) => acc + Math.max(0, value), 0) || 1;
    const radius = Math.min(plotWidth, plotHeight) * 0.43;
    const centerX = plotX + plotWidth / 2;
    const centerTopY = plotY + plotHeight / 2;
    const centerY = topPdfY(centerTopY);
    let angle = -Math.PI / 2;
    for (let index = 0; index < values.length; index += 1) {
      const value = Math.max(0, values[index]);
      const sweep = (value / total) * Math.PI * 2;
      const color = palette[index % palette.length];
      const path = buildWedgePath(centerX, centerY, radius, angle, angle + sweep);
      page.drawSvgPath(path, {
        color: toPdfRgb(color),
        borderColor: toPdfRgb(op.backgroundColor),
        borderWidth: 0.7
      });
      if (op.options.showValues && sweep > 0.06) {
        const mid = angle + sweep / 2;
        const label = String(values[index] ?? 0);
        const labelWidth = fonts.normal.widthOfTextAtSize(label, 7);
        drawTopText(
          label,
          centerX + Math.cos(mid) * radius * 0.62 - labelWidth / 2,
          centerTopY + Math.sin(mid) * radius * 0.62 - 4,
          7,
          fonts.normal,
          op.textColor
        );
      }
      angle += sweep;
    }
  }

  if (op.chartType !== "pie") {
    const labelCount = Math.max(labels.length, values.length);
    const picked = sampleLabelIndices(labelCount, 6);
    if (op.chartType === "bar") {
      const slot = plotWidth / Math.max(1, values.length);
      for (const labelIndex of picked) {
        const label = labels[labelIndex] ?? `S${labelIndex + 1}`;
        const centerX = plotX + labelIndex * slot + slot / 2;
        const maxWidth = Math.max(24, slot * 0.94);
        const lines = wrapAxisLabel(label, maxWidth, axisLabelFontSize, axisLabelMaxLines);
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
          const line = lines[lineIndex];
          const lineWidth = fonts.normal.widthOfTextAtSize(line, axisLabelFontSize);
          drawTopText(
            line,
            centerX - lineWidth / 2,
            plotY + plotHeight + 2 + lineIndex * axisLabelLineHeight,
            axisLabelFontSize,
            fonts.normal,
            op.mutedColor
          );
        }
      }
    } else {
      const denominator = Math.max(1, labelCount - 1);
      for (const labelIndex of picked) {
        const label = labels[labelIndex] ?? `S${labelIndex + 1}`;
        const x = plotX + (plotWidth * labelIndex) / denominator;
        const labelWidth = fonts.normal.widthOfTextAtSize(label, axisLabelFontSize);
        drawTopText(
          label,
          x - labelWidth / 2,
          plotY + plotHeight + 2,
          axisLabelFontSize,
          fonts.normal,
          op.mutedColor
        );
      }
    }
  }

  if (legendEnabled && legendTopY !== null) {
    const entryWidth = Math.max(75, plotWidth / Math.max(1, Math.min(labels.length, 4)));
    const maxItems = Math.min(labels.length, 4);
    for (let index = 0; index < maxItems; index += 1) {
      const color = palette[index % palette.length];
      const x = plotX + index * entryWidth;
      page.drawRectangle({
        x,
        y: rectPdfY(legendTopY + 1, 7),
        width: 7,
        height: 7,
        color: toPdfRgb(color)
      });
      const legendLabel = op.options.showValues
        ? `${labels[index]}: ${values[index] ?? 0}`
        : labels[index];
      const fitted = truncateTextToWidth(legendLabel, Math.max(1, entryWidth - 12), 8);
      drawTopText(fitted, x + 10, legendTopY, 8, fonts.normal, op.textColor);
    }
  }

  if (framePath) {
    drawRoundedBorder(
      page,
      pageHeight,
      op.x,
      op.y,
      op.width,
      op.height,
      op.borderRadius,
      op.borderColor,
      UNIFIED_OUTER_STROKE
    );
  } else {
    page.drawRectangle({
      x: op.x,
      y: rectPdfY(op.y, op.height),
      width: op.width,
      height: op.height,
      borderColor: toPdfRgb(op.borderColor),
      borderWidth: UNIFIED_OUTER_STROKE
    });
  }
};

const drawOp = async (
  op: DrawOp,
  page: PDFPage,
  pageHeight: number,
  fonts: { normal: PDFFont; bold: PDFFont },
  pageNumber: number,
  totalPages: number,
  imageAssets: Map<string, ImageAsset>,
  embeddedImages: Map<string, PDFImage>,
  pdfDoc: PDFDocument
): Promise<void> => {
  if (op.kind === "text") {
    for (let lineIndex = 0; lineIndex < op.lines.length; lineIndex += 1) {
      const line = applyTokens(op.lines[lineIndex], pageNumber, totalPages);
      const font = op.fontWeight === "bold" ? fonts.bold : fonts.normal;
      const lineWidth = font.widthOfTextAtSize(line, op.fontSize);
      let drawX = op.x;
      if (op.align === "center") {
        drawX = op.x + Math.max(0, (op.width - lineWidth) / 2);
      } else if (op.align === "right") {
        drawX = op.x + Math.max(0, op.width - lineWidth);
      }
      page.drawText(line, {
        x: drawX,
        y: pageHeight - (op.y + lineIndex * op.lineHeight + op.fontSize),
        size: op.fontSize,
        font,
        color: toPdfRgb(op.color),
        maxWidth: op.width,
        opacity: op.opacity,
        rotate: op.rotate ? degrees(op.rotate) : undefined
      });
    }
    return;
  }

  if (op.kind === "line") {
    page.drawLine({
      start: { x: op.x, y: pageHeight - op.y },
      end: { x: op.x + op.width, y: pageHeight - op.y },
      thickness: op.thickness,
      color: toPdfRgb(op.color),
      opacity: op.opacity
    });
    return;
  }

  if (op.kind === "rect") {
    page.drawRectangle({
      x: op.x,
      y: pageHeight - op.y - op.height,
      width: op.width,
      height: op.height,
      borderWidth: op.borderWidth ?? 0,
      borderColor: op.stroke ? toPdfRgb(op.stroke) : undefined,
      color: op.fill ? toPdfRgb(op.fill) : undefined,
      opacity: op.opacity
    });
    return;
  }

  if (op.kind === "roundedRect") {
    const path = roundedRectPath(op.x, pageHeight - op.y, op.width, op.height, op.radius);
    if (op.fill) {
      page.drawSvgPath(path, {
        color: toPdfRgb(op.fill),
        opacity: op.opacity
      });
    }
    if (op.stroke && (op.borderWidth ?? 0) > 0) {
      drawRoundedBorder(
        page,
        pageHeight,
        op.x,
        op.y,
        op.width,
        op.height,
        op.radius,
        op.stroke,
        op.borderWidth ?? 0
      );
    }
    return;
  }

  if (op.kind === "chart") {
    drawChart(op, page, pageHeight, fonts);
    return;
  }

  const asset = imageAssets.get(op.src);
  if (!asset) {
    return;
  }

  let embedded = embeddedImages.get(op.src);
  if (!embedded) {
    embedded =
      asset.mimeType === "image/png"
        ? await pdfDoc.embedPng(asset.bytes)
        : await pdfDoc.embedJpg(asset.bytes);
    embeddedImages.set(op.src, embedded);
  }

  page.drawImage(embedded, {
    x: op.x,
    y: pageHeight - op.y - op.height,
    width: op.width,
    height: op.height,
    opacity: op.opacity
  });

  if (op.grayscale) {
    // Aproximacion MVP: overlay gris translúcido para simular desaturación.
    const overlay = op.borderColor ?? { r: 0.5, g: 0.5, b: 0.5 };
    page.drawRectangle({
      x: op.x,
      y: pageHeight - op.y - op.height,
      width: op.width,
      height: op.height,
      color: toPdfRgb(overlay),
      opacity: 0.18
    });
  }

  if (op.borderRadius && op.borderRadius > 0) {
    // Aproximacion MVP: borde redondeado sin clipping de pixeles.
    const path = roundedRectPath(op.x, pageHeight - op.y, op.width, op.height, op.borderRadius);
    page.drawSvgPath(path, {
      borderColor: op.borderColor ? toPdfRgb(op.borderColor) : undefined,
      borderWidth: 0.6
    });
  }
};

export const renderToPdf = async (
  element: RFNode,
  options: RenderOptions = {}
): Promise<Uint8Array> => {
  const layout = await buildLayout(element, options);
  const pdfDoc = await PDFDocument.create();
  const normalFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fonts = { normal: normalFont, bold: boldFont };

  if (options.title) {
    pdfDoc.setTitle(options.title);
  }
  if (options.author) {
    pdfDoc.setAuthor(options.author);
  }
  if (options.subject) {
    pdfDoc.setSubject(options.subject);
  }

  const totalPages = layout.pages.length;
  const embeddedImages = new Map<string, PDFImage>();

  for (let pageIndex = 0; pageIndex < layout.pages.length; pageIndex += 1) {
    const pageLayout = layout.pages[pageIndex];
    const page = pdfDoc.addPage([layout.pageWidth, layout.pageHeight]);
    const pageNumber = pageIndex + 1;

    page.drawRectangle({
      x: 0,
      y: 0,
      width: layout.pageWidth,
      height: layout.pageHeight,
      color: toPdfRgb(pageLayout.backgroundColor)
    });

    for (const wmOp of pageLayout.watermarkOps) {
      drawWatermark(
        wmOp,
        page,
        layout.pageWidth,
        layout.pageHeight,
        fonts.bold,
        pageNumber,
        totalPages
      );
    }

    for (const op of pageLayout.headerOps) {
      await drawOp(
        op,
        page,
        layout.pageHeight,
        fonts,
        pageNumber,
        totalPages,
        layout.imageAssets,
        embeddedImages,
        pdfDoc
      );
    }

    for (const op of pageLayout.bodyOps) {
      await drawOp(
        op,
        page,
        layout.pageHeight,
        fonts,
        pageNumber,
        totalPages,
        layout.imageAssets,
        embeddedImages,
        pdfDoc
      );
    }

    for (const op of pageLayout.footerOps) {
      await drawOp(
        op,
        page,
        layout.pageHeight,
        fonts,
        pageNumber,
        totalPages,
        layout.imageAssets,
        embeddedImages,
        pdfDoc
      );
    }
  }

  return await pdfDoc.save();
};
