// 周报 docx 生成器 —— 结构与样式固化版（研究院模板 2026-09 蒸馏）
// 固化：五节骨架与节名、两张表的列、标题日期格式、模板配色（表头深青 156082 白字 /
// 数据行浅灰蓝 CCD2D8 / 总述行杏色 F6C6AD、表格无框线纯色块、标题宋体三号居中不加粗、
// 节标题宋体 12pt 加粗）。内容全部来自数据 JSON，脚本不写死任何内容。
// 内容规则（什么写哪、不另起炉灶）见 references/style-samples.md C 节。
//
// 用法：NODE_PATH="<docx 包所在 node_modules>" node weekly_template.js <数据.json> [输出.docx]
//       缺省输出名：<period>工作总结.docx
//
// 数据 JSON 形状（problems 为空则"存在的问题"整节省略；条目可为字符串或 {text, img}）：
// {
//   "period": "2026.09.21-2026.09.27",            // 覆盖周区间，终点=周日，写进标题
//   "creator": "姓名",                             // 可选，仅写文档属性
//   "lastWeekPlan": {
//     "rows": [["任务名", "9.25 / 滚动进行", "可验收效果", "已完成"]],
//     "overview": "1、项目一：要点；2、项目二：要点"   // 表尾合并行；空串则省略该行
//   },
//   "thisWeek": [
//     { "name": "项目名称一",
//       "items": [ "完成事项 + 结果或数据",
//                  { "text": "完成事项", "img": "截图.png" } ] }   // img 可选，贴条目下方
//   ],
//   "problems": "现象、已定位原因、当前状态",        // 空串/缺省 → 整节省略
//   "summary": [ { "name": "项目名称一", "text": "一段话凝练，可带关键数据" } ],
//   "nextWeek": [ ["任务名", "9.25", "可验收效果"] ]
// }
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, BorderStyle, ImageRun,
} = require("docx");
const fs = require("fs");
const path = require("path");
const kit = require("./docx_kit.js");

const SECTION = {
  plan: "上周工作计划",
  thisWeek: "本周工作内容",
  problems: "存在的问题",
  summary: "本周工作总结",
  nextWeek: "下周工作内容",
};
// 研究院模板色板（从 _tmp_template.docx XML 取证）：表头/数据行/总述行三色，表格无框线
const HEAD_FILL = "156082", BODY_FILL = "CCD2D8", OVER_FILL = "F6C6AD";
const NBORD = { style: BorderStyle.NONE, size: 0, color: "auto" };

function warn(cond, msg) { if (!cond) console.warn("[周报数据警告]", msg); }

function checkData(d) {
  warn(/^\d{4}\.\d{2}\.\d{2}-\d{4}\.\d{2}\.\d{2}$/.test(d.period || ""), "period 应为 YYYY.MM.DD-YYYY.MM.DD（终点=周日）");
  warn(d.thisWeek && d.thisWeek.length, "thisWeek 为空");
  warn(d.summary && d.summary.length, "summary 为空");
  warn(d.nextWeek && d.nextWeek.length, "nextWeek 为空");
  (d.lastWeekPlan && d.lastWeekPlan.rows || []).forEach((r, i) => {
    const s = r[3];
    const ok = s === "已完成" || s === "基本完成" || s === "进行中" || s === "未完成" || /^完成\d+%$/.test(s || "");
    warn(ok, `上周工作计划第 ${i + 1} 行完成情况"${s}"不在词表：已完成/基本完成/完成XX%/进行中/未完成`);
  });
}

// 模板同款表格：无框线、表头深青白字、数据行灰蓝、总述行杏色；单元格可为字符串或 {text, span, bold}
function gridTable(headers, rows, widths, tail) {
  const cell = (c, kind, w) => {
    const o = typeof c === "string" ? { text: c } : c;
    return new TableCell({
      children: [new Paragraph({
        spacing: { line: 276 },
        children: [new TextRun({
          text: o.text || "", size: 21,
          bold: kind !== "head" && !!o.bold,
          color: kind === "head" ? "FFFFFF" : "000000",
        })],
      })],
      columnSpan: o.span,
      shading: { fill: kind === "head" ? HEAD_FILL : kind === "over" ? OVER_FILL : BODY_FILL },
      borders: { top: NBORD, bottom: NBORD, left: NBORD, right: NBORD },
      margins: { top: 40, bottom: 40, left: 108, right: 108 },
      width: { size: w, type: WidthType.PERCENTAGE },
    });
  };
  const tailRow = tail ? new TableRow({
    cantSplit: true,
    children: [
      cell({ text: tail.label }, "over", widths[0]),
      cell({ text: tail.text, span: headers.length - 1 }, "over", 100 - widths[0]),
    ],
  }) : null;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: NBORD, bottom: NBORD, left: NBORD, right: NBORD, insideHorizontal: NBORD, insideVertical: NBORD },
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((t, i) => cell(t, "head", widths[i])) }),
      ...rows.map(r => new TableRow({
        cantSplit: true,
        children: headers.map((_, i) => cell(r[i] || "", "body", widths[i])),
      })),
      ...(tailRow ? [tailRow] : []),
    ],
  });
}

// 模板同款标题：宋体三号（32 半点）居中不加粗；节标题：宋体 12pt 加粗（docx_kit 默认为黑体系，此处按模板覆盖）
function weeklyTitle(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 160, line: 400, lineRule: "atLeast" },
    children: [new TextRun({ text, size: 32, font: { ascii: "Times New Roman", eastAsia: "SimSun" }, color: "000000" })],
  });
}
function sectionHead(text) {
  return new Paragraph({
    keepNext: true,
    spacing: { before: 200, after: 80, line: 312 },
    children: [new TextRun({ text, size: 24, bold: true, font: { ascii: "Times New Roman", eastAsia: "SimSun" }, color: "000000" })],
  });
}

function projectHead(text) {
  return new Paragraph({
    keepNext: true,
    spacing: { before: 120, after: 60, line: 312 },
    children: [new TextRun({ text, bold: true, size: 24, color: "000000" })],
  });
}
function itemPara(text) {
  return new Paragraph({
    spacing: { line: 312, after: 60 },
    children: [new TextRun({ text, size: 24, color: "000000" })],
  });
}
// PNG/JPEG 尺寸嗅探，按宽 420 等比缩放；识别失败跳过该图
function imageParas(imgPath) {
  if (!fs.existsSync(imgPath)) { console.warn("[周报数据警告] 图片不存在，已跳过:", imgPath); return []; }
  const b = fs.readFileSync(imgPath);
  let dim = null;
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50) dim = { w: b.readUInt32BE(16), h: b.readUInt32BE(20), type: "png" };
  else if (b[0] === 0xFF && b[1] === 0xD8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xFF) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
        dim = { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7), type: "jpg" }; break;
      }
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  if (!dim) { console.warn("[周报数据警告] 仅支持 png/jpg，已跳过:", imgPath); return []; }
  const w = 420, h = Math.round(w * dim.h / dim.w);
  return [new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 120 },
    children: [new ImageRun({ data: b, transformation: { width: w, height: h }, type: dim.type })],
  })];
}

async function main() {
  const dataPath = process.argv[2];
  if (!dataPath) { console.error("用法: node weekly_template.js <数据.json> [输出.docx]"); process.exit(1); }
  const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  checkData(data);
  const out = process.argv[3] || `${data.period}工作总结.docx`;

  const ch = [];
  ch.push(weeklyTitle(`${data.period}工作总结`));

  ch.push(sectionHead(SECTION.plan));
  ch.push(gridTable(
    ["预期任务", "预期完成时间", "预期达到效果", "完成情况"],
    data.lastWeekPlan.rows, [34, 18, 30, 18],
    data.lastWeekPlan.overview ? { label: "工作情况总述", text: data.lastWeekPlan.overview } : null,
  ));

  ch.push(sectionHead(SECTION.thisWeek));
  (data.thisWeek || []).forEach((p, i) => {
    ch.push(projectHead(`${i + 1}. ${p.name}`));
    (p.items || []).forEach((it, j) => {
      const t = typeof it === "string" ? { text: it } : it;
      ch.push(itemPara(`（${j + 1}）${t.text}`));
      if (t.img) ch.push(...imageParas(path.resolve(path.dirname(dataPath), t.img)));
    });
  });

  if (data.problems && String(data.problems).trim()) {
    ch.push(sectionHead(SECTION.problems));
    ch.push(kit.body(String(data.problems)));
  }

  ch.push(sectionHead(SECTION.summary));
  (data.summary || []).forEach((s, i) => {
    ch.push(projectHead(`${i + 1}. ${s.name}`));
    ch.push(kit.body(s.text));
  });

  ch.push(sectionHead(SECTION.nextWeek));
  ch.push(gridTable(["预期任务", "预期完成时间", "预期达到效果"], data.nextWeek, [40, 18, 42]));

  const docx = kit.doc(ch, { creator: data.creator || "", docTitle: `${data.period}工作总结` });
  const n = await kit.save(docx, out);
  console.log("written:", path.resolve(out), n, "bytes");
}

main().catch(e => { console.error(e); process.exit(1); });
