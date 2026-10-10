// 青软实训周报 docx 生成器 —— 实训周报模板_v2 蒸馏（2026-09-28 从模板 XML 取证）
// 固化：六节+附录骨架与节名、抬头行、五张表的列、模板样式——
//   大标题"周报"黑体三号(32)加粗居中 / 节标题黑体 13pt(26) 加粗 / 表头宋体 10pt(20) 加粗
//   淡蓝底 D9E2F3 黑字 / 表格全框线 single 0.5pt / 正文宋体 10.5pt(21) / 附录说明楷体 9.5pt。
// 空节规则（用户 2026-09-28 定）：无法填写的节保留节名，表内出一行"无"，不删节、不省略。
// 内容规则：数值不写形容词、失败路径照实写、导师口径注明出处（谁、何时、原话）。
// 用法：NODE_PATH="<docx 包所在 node_modules>" node qingsoft_weekly.js <数据.json> [输出.docx]
//       缺省输出名：<period>实训周报.docx
//
// 数据 JSON 形状（除 name/period 外全部可缺省 → 该节出"无"；行都是字符串数组）：
// {
//   "name": "本人", "team": "冲压模具组",       // 抬头：姓名 / 项目组
//   "weekNo": 1,                                  // 第几周；未定给 null → 抬头"第　周"留空
//   "period": "2026.09.21-2026.09.27",            // 周区间（终点=周日），进抬头与文件名
//   "tasks": [["STP三分类收口", "已完成", "17/17 回归通过"], ...],                  // 一
//   "experiments": [["EXP-001", "9/23", "改动点一句话", "动机一句话", "指标变化", "有效"], ...], // 二
//   "materials": [["文件名", "代码", "未脱敏", "归档路径"], ...],                    // 三
//   "knowledge": [["9/24", "工程师", "口径要点，1-2-3 分列", "纪要"], ...],          // 四
//   "shots": [{"img": "截图/x.png", "caption": "图1 ……"}, ...],                     // 二节表格下的截图
//                                                                                 //（img 相对数据 JSON 所在目录）
//   "pitfalls": [["1", "踩的坑", "怎么解决的/卡在哪"], ...],                         // 五
//   "nextWeek": ["事项一", "事项二", "事项三"]                                       // 六
// }
const {
  Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  AlignmentType, WidthType, BorderStyle, TableLayoutType,
} = require("docx");
const fs = require("fs");
const path = require("path");
const kit = require("./docx_kit.js");

const SECTION = {
  tasks: "一、本周任务完成情况",
  experiments: "二、本周实验卡片清单",
  materials: "三、产出素材登记",
  knowledge: "四、知识资产采集",
  pitfalls: "五、踩坑与解决记录",
  nextWeek: "六、下周计划",
  appendix: "附录 · 实验卡片（当天记，单卡 ≤ 1页）",
};
// 模板色板（XML 取证）：表头淡蓝底黑字；表格全框线细线；无其他色块
const HEAD_FILL = "D9E2F3";
const BORD = { style: BorderStyle.SINGLE, size: 4, color: "auto" };
const ALL_BORD = { top: BORD, bottom: BORD, left: BORD, right: BORD,
                   insideHorizontal: BORD, insideVertical: BORD };

function warn(cond, msg) { if (!cond) console.warn("[青软周报数据警告]", msg); }

function checkData(d) {
  warn(/^\d{4}\.\d{2}\.\d{2}-\d{4}\.\d{2}\.\d{2}$/.test(d.period || ""),
    "period 应为 YYYY.MM.DD-YYYY.MM.DD（终点=周日）");
  warn(!!d.name, "name（姓名）缺省，抬头留空");
  if (!d.weekNo && d.weekNo !== 0) console.warn("[青软周报数据警告] weekNo 未定，抬头周次留空（锚点确认后回填）");
}

// 模板同款表格：全框线、表头淡蓝底黑字加粗、数据行白底；行=字符串数组
function gridTable(headers, rows, widths) {
  const cell = (text, isHead, w) => new TableCell({
    children: [new Paragraph({
      spacing: { line: 276 },
      children: [new TextRun({
        text: text || "", size: isHead ? 20 : 21, bold: isHead, color: "000000",
        font: { ascii: "Times New Roman", eastAsia: "SimSun" },
      })],
    })],
    shading: isHead ? { fill: HEAD_FILL } : undefined,
    borders: { top: BORD, bottom: BORD, left: BORD, right: BORD },
    margins: { top: 40, bottom: 40, left: 108, right: 108 },
    width: { size: w, type: WidthType.PERCENTAGE },
  });
  const dataRows = (rows && rows.length) ? rows : [headers.map((_, i) => (i === 0 ? "无" : ""))];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,  // 固定布局:WPS 自动布局会无视列宽百分比,把窄列压成竖排
    borders: ALL_BORD,
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((t, i) => cell(t, true, widths[i])) }),
      ...dataRows.map(r => new TableRow({
        cantSplit: true,
        children: headers.map((_, i) => cell(r[i] || "", false, widths[i])),
      })),
    ],
  });
}

function title(text) {   // 黑体三号加粗居中（模板取证）
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 160, line: 400, lineRule: "atLeast" },
    children: [new TextRun({ text, size: 32, bold: true, font: { ascii: "Times New Roman", eastAsia: "SimHei" }, color: "000000" })],
  });
}
function sectionHead(text) {   // 黑体 13pt 加粗（模板取证），keepNext 防孤行
  return new Paragraph({
    keepNext: true,
    spacing: { before: 200, after: 80, line: 312 },
    children: [new TextRun({ text, size: 26, bold: true, font: { ascii: "Times New Roman", eastAsia: "SimHei" }, color: "000000" })],
  });
}
function itemPara(text) {
  return new Paragraph({
    spacing: { line: 312, after: 60 },
    children: [new TextRun({ text, size: 21, font: { ascii: "Times New Roman", eastAsia: "SimSun" }, color: "000000" })],
  });
}

// 截图：PNG/JPEG 尺寸嗅探，按宽 460 等比缩放（与研究院版同机制）；识别失败跳过并告警
function imageParas(imgPath) {
  if (!fs.existsSync(imgPath)) { console.warn("[青软周报数据警告] 截图不存在，已跳过:", imgPath); return []; }
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
  if (!dim) { console.warn("[青软周报数据警告] 仅支持 png/jpg，已跳过:", imgPath); return []; }
  const w = 460, h = Math.round(w * dim.h / dim.w);
  return [new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 40 },
    children: [new ImageRun({ data: b, transformation: { width: w, height: h }, type: dim.type })],
  })];
}
function shotCaption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 140 },
    children: [new TextRun({ text, size: 18, color: "595959", font: { ascii: "Times New Roman", eastAsia: "SimSun" } })],
  });
}

async function main() {
  const dataPath = process.argv[2];
  if (!dataPath) { console.error("用法: node qingsoft_weekly.js <数据.json> [输出.docx]"); process.exit(1); }
  const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  checkData(data);
  const out = process.argv[3] || `${data.period}实训周报.docx`;
  const weekTxt = (data.weekNo || data.weekNo === 0)
    ? `第${data.weekNo}周` : "第　周";

  const ch = [];
  ch.push(title("周报"));
  ch.push(new Paragraph({
    spacing: { after: 120, line: 312 },
    children: [new TextRun({
      text: `姓名：${data.name || "　　　"}　项目组：${data.team || "　　　"}　周次：${weekTxt}（${data.period || ""}）`,
      size: 21, font: { ascii: "Times New Roman", eastAsia: "SimSun" }, color: "000000",
    })],
  }));

  ch.push(sectionHead(SECTION.tasks));
  ch.push(gridTable(["任务项", "状态", "说明"], data.tasks, [32, 14, 54]));

  ch.push(sectionHead(SECTION.experiments));
  ch.push(gridTable(
    ["实验编号", "日期", "改动点（一句话）", "动机（一句话）", "指标变化", "结论"],
    data.experiments, [11, 8, 23, 20, 24, 14]));
  // 截图挂在实验卡片清单下（不新增节）：[{img, caption}]，img 相对数据 JSON 所在目录
  (data.shots || []).forEach(s => {
    ch.push(...imageParas(path.resolve(path.dirname(dataPath), s.img)));
    ch.push(shotCaption(s.caption || ""));
  });

  ch.push(sectionHead(SECTION.materials));
  ch.push(gridTable(["素材名称", "类型(数据/代码/知识/过程)", "脱敏状态", "归档路径"],
    data.materials, [30, 18, 12, 40]));

  ch.push(sectionHead(SECTION.knowledge));
  ch.push(gridTable(["日期", "谁讲的", "讲了什么（工艺逻辑/规范/判断经验，要点1-2-3）", "固化方式"],
    data.knowledge, [9, 12, 57, 22]));

  ch.push(sectionHead(SECTION.pitfalls));
  ch.push(gridTable(["#", "踩的坑", "怎么解决的（或还没解决，卡在哪）"],
    data.pitfalls, [6, 37, 57]));

  ch.push(sectionHead(SECTION.nextWeek));
  const nx = (data.nextWeek && data.nextWeek.length) ? data.nextWeek : ["无"];
  nx.forEach((t, i) => ch.push(itemPara(`${i + 1}. ${t}`)));

  // 附录：固定卡式（模板原文，不随数据变）——卡片当天先记进工作日志 EXP 条目
  ch.push(new Paragraph({
    keepNext: true,
    spacing: { before: 240, after: 60, line: 312 },
    children: [new TextRun({ text: SECTION.appendix, size: 19, font: { ascii: "Times New Roman", eastAsia: "KaiTi" }, color: "000000" })],
  }));
  ch.push(itemPara("编号：EXP-＿＿＿　　日期：＿＿＿＿　　记录人：＿＿＿＿"));
  ch.push(gridTable(["项", "内容"], [
    ["改动点", "改了什么（参数 / 结构 / 数据 / 流程）"],
    ["动机", "为什么改（预期解决什么问题）"],
    ["设置", "与 baseline 的差异（只列不同项）"],
    ["结果", "关键指标（写数值，不写\u201c有提升\u201d这种话）"],
    ["结论", "□有效　□无效　□待定　＋ 一句话原因"],
    ["下一步", "基于本次结果的下一个动作"],
  ], [14, 86]));

  const docx = kit.doc(ch, { creator: data.name || "", docTitle: `${data.period}实训周报` });
  const n = await kit.save(docx, out);
  console.log("written:", path.resolve(out), n, "bytes");
}

main().catch(e => { console.error(e); process.exit(1); });
