import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import type { Response } from "express";
import { format } from "date-fns";

export interface ReportColumn {
  key: string;
  label: string;
  width?: number; // relative width for PDF / Excel
}

export interface Report {
  title: string;
  subtitle?: string;
  columns: ReportColumn[];
  rows: Record<string, string | number | null>[];
  summary?: { label: string; value: string | number }[];
  chart?: { type: "bar" | "pie" | "line"; xKey: string; series: { key: string; label: string }[]; data: Record<string, string | number>[] };
}

function slug(title: string) {
  return `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${format(new Date(), "yyyyMMdd")}`;
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

export function toCSV(report: Report): string {
  const esc = (v: unknown) => {
    let s = cell(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [report.columns.map((c) => esc(c.label)).join(",")];
  for (const r of report.rows) lines.push(report.columns.map((c) => esc(r[c.key])).join(","));
  return "﻿" + lines.join("\n");
}

export async function toXLSX(report: Report, institution: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "FacultyHub";
  wb.created = new Date();
  const ws = wb.addWorksheet(report.title.slice(0, 31));
  const n = report.columns.length;
  ws.mergeCells(1, 1, 1, n);
  ws.getCell(1, 1).value = institution;
  ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: "FF172554" } };
  ws.mergeCells(2, 1, 2, n);
  ws.getCell(2, 1).value = `${report.title}${report.subtitle ? ` — ${report.subtitle}` : ""}`;
  ws.getCell(2, 1).font = { size: 11, color: { argb: "FF475569" } };
  ws.mergeCells(3, 1, 3, n);
  ws.getCell(3, 1).value = `Generated ${format(new Date(), "dd MMM yyyy, HH:mm")}`;
  ws.getCell(3, 1).font = { size: 9, italic: true, color: { argb: "FF94A3B8" } };

  const headerRow = ws.getRow(5);
  report.columns.forEach((c, i) => {
    const cellRef = headerRow.getCell(i + 1);
    cellRef.value = c.label;
    cellRef.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cellRef.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF172554" } };
    cellRef.alignment = { vertical: "middle" };
    ws.getColumn(i + 1).width = Math.max(12, (c.width ?? 1) * 16);
  });
  headerRow.height = 20;
  report.rows.forEach((r, idx) => {
    const row = ws.getRow(6 + idx);
    report.columns.forEach((c, i) => (row.getCell(i + 1).value = r[c.key] ?? ""));
    if (idx % 2 === 1) row.eachCell((cl) => (cl.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } }));
  });
  ws.views = [{ state: "frozen", ySplit: 5 }];
  ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: n } };

  if (report.summary?.length) {
    const s = wb.addWorksheet("Summary");
    s.columns = [{ header: "Metric", key: "label", width: 36 }, { header: "Value", key: "value", width: 20 }];
    s.getRow(1).font = { bold: true };
    report.summary.forEach((x) => s.addRow(x));
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function toPDF(report: Report, institution: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const landscape = report.columns.length > 6;
    const doc = new PDFDocument({ size: "A4", layout: landscape ? "landscape" : "portrait", margin: 36, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageW = doc.page.width - 72;
    doc.rect(0, 0, doc.page.width, 64).fill("#172554");
    doc.fillColor("#FFFFFF").fontSize(15).font("Helvetica-Bold").text(institution, 36, 18);
    doc.fontSize(10).font("Helvetica").text(`${report.title}${report.subtitle ? ` — ${report.subtitle}` : ""}`, 36, 38);
    doc.fillColor("#64748B").fontSize(8).text(`Generated ${format(new Date(), "dd MMM yyyy, HH:mm")}`, 36, 76);
    let y = 92;

    if (report.summary?.length) {
      const boxW = Math.min(150, pageW / Math.min(report.summary.length, 5));
      report.summary.slice(0, 5).forEach((s, i) => {
        const x = 36 + i * (boxW + 6);
        doc.roundedRect(x, y, boxW, 38, 4).fill("#F1F5F9");
        doc.fillColor("#64748B").fontSize(7).font("Helvetica").text(s.label.toUpperCase(), x + 8, y + 7, { width: boxW - 16 });
        doc.fillColor("#0F172A").fontSize(12).font("Helvetica-Bold").text(String(s.value), x + 8, y + 19, { width: boxW - 16 });
      });
      y += 50;
    }

    const totalW = report.columns.reduce((a, c) => a + (c.width ?? 1), 0);
    const widths = report.columns.map((c) => ((c.width ?? 1) / totalW) * pageW);
    const drawHeader = () => {
      doc.rect(36, y, pageW, 18).fill("#1E3A8A");
      let x = 36;
      doc.fillColor("#FFFFFF").fontSize(7.5).font("Helvetica-Bold");
      report.columns.forEach((c, i) => {
        doc.text(c.label, x + 4, y + 5, { width: widths[i] - 8, ellipsis: true, lineBreak: false });
        x += widths[i];
      });
      y += 18;
    };
    drawHeader();
    doc.font("Helvetica").fontSize(7.5);
    report.rows.forEach((r, idx) => {
      const rowH = 16;
      if (y + rowH > doc.page.height - 40) {
        doc.addPage();
        y = 36;
        drawHeader();
        doc.font("Helvetica").fontSize(7.5);
      }
      if (idx % 2 === 1) doc.rect(36, y, pageW, rowH).fill("#F8FAFC");
      let x = 36;
      doc.fillColor("#1E293B");
      report.columns.forEach((c, i) => {
        doc.text(cell(r[c.key]), x + 4, y + 4.5, { width: widths[i] - 8, ellipsis: true, lineBreak: false });
        x += widths[i];
      });
      y += rowH;
    });
    if (!report.rows.length) doc.fillColor("#64748B").text("No records match the selected filters.", 36, y + 10);

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0; // allow writing the footer inside the bottom margin without a page break
      doc.fillColor("#94A3B8").fontSize(7).text(`FacultyHub · Page ${i + 1} of ${range.count}`, 36, doc.page.height - 28, { width: pageW, align: "right", lineBreak: false });
    }
    doc.end();
  });
}

export async function sendReport(res: Response, report: Report, fmt: string, institution: string) {
  const name = slug(report.title);
  if (fmt === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${name}.csv"`);
    return res.send(toCSV(report));
  }
  if (fmt === "xlsx") {
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${name}.xlsx"`);
    return res.send(await toXLSX(report, institution));
  }
  if (fmt === "pdf") {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${name}.pdf"`);
    return res.send(await toPDF(report, institution));
  }
  return res.json({ success: true, data: report });
}
