// project-doc 共享构建器 —— 技术方案/说明文档用（朴素版式）
// 参数与 2026-09-23 通过视觉验收的 generate2.js 完全一致：黑白、黑体标题/宋体正文、
// 首行缩进 480、行距 312、三线表、单 section、页脚页码。
// 用法：技术方案按当次内容写一个小生成脚本 require 本文件，只写内容不写样式。
//   NODE_PATH="<docx 包所在 node_modules>" node 你的生成脚本.js
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Footer, PageNumber, AlignmentType, HeadingLevel, WidthType, BorderStyle,
} = require("docx");
const fs = require("fs");

const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

// 文档大标题（无封面：标题 + metaLine 一行元信息即文档头）
function title(text, size = 36) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 60, line: 500, lineRule: "atLeast" },
    children: [new TextRun({ text, bold: true, size, font: { eastAsia: "SimHei", ascii: "Times New Roman" }, color: "000000" })],
  });
}
function metaLine(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200, line: 276 },
    children: [new TextRun({ text, size: 21, color: "404040" })],
  });
}
function h1(text) {
  // keepNext: 标题不孤悬页尾（2026-10-10 视觉验收抓过孤行标题）
  return new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, children: [new TextRun({ text })] });
}
function body(text, extra = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 480 },
    spacing: { line: 312, after: 60 },
    children: [new TextRun({ text, size: 24 })],
    ...extra,
  });
}
// 三线表（纯黑线，学术式）；widths 为百分比数组
function threeLineTable(headers, rows, widths) {
  // 三线的上下粗线必须画在单元格层: tcBorders 会覆盖 tblBorders,
  // 表级 top/bottom 会被全 NONE 的单元格边框压掉(2026-09-24 视觉验收抓过)
  const thick = { style: BorderStyle.SINGLE, size: 6, color: "000000" };
  const cell = (text, isHeader, w, isLastRow) => new TableCell({
    children: [new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { line: 276 },
      children: [new TextRun({ text, size: 21, bold: isHeader, color: "000000" })],
    })],
    borders: isHeader
      ? { top: thick, left: NB, right: NB, bottom: { style: BorderStyle.SINGLE, size: 2, color: "000000" } }
      : { top: NB, left: NB, right: NB, bottom: isLastRow ? thick : NB },
    margins: { top: 50, bottom: 50, left: 100, right: 100 },
    width: { size: w, type: WidthType.PERCENTAGE },
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: thick, bottom: thick,
      left: NB, right: NB, insideHorizontal: NB, insideVertical: NB,
    },
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((t, i) => cell(t, true, widths[i])) }),
      ...rows.map((r, ri) => new TableRow({ cantSplit: true, children: r.map((t, i) => cell(t, false, widths[i], ri === rows.length - 1)) })),
    ],
  });
}
// 表题（放表格前一行，keepNext 防跨页分离）
function caption(text) {
  return new Paragraph({
    keepNext: true, alignment: AlignmentType.CENTER,
    spacing: { before: 140, after: 60, line: 312 },
    children: [new TextRun({ text, bold: true, size: 21, color: "000000" })],
  });
}
// 文档骨架（验证过的默认值：A4、页边距、宋体/黑体样式表、页脚页码）
function doc(children, { creator = "", docTitle = "" } = {}) {
  return new Document({
    creator,
    title: docTitle,
    styles: {
      default: {
        document: {
          run: { font: { ascii: "Times New Roman", eastAsia: "SimSun" }, size: 24, color: "000000" },
          paragraph: { spacing: { line: 312 } },
        },
        heading1: {
          run: { font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 28, bold: true, color: "000000" },
          paragraph: { spacing: { before: 240, after: 100, line: 312 }, outlineLevel: 0 },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
        },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080" })],
          })],
        }),
      },
      children,
    }],
  });
}
async function save(document, outPath) {
  const buf = await Packer.toBuffer(document);
  fs.writeFileSync(outPath, buf);
  return buf.length;
}

module.exports = { NB, title, metaLine, h1, body, threeLineTable, caption, doc, save };
