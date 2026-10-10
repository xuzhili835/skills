# 多模态预处理(可选前置层:PDF / 图片 → 文本)

> 对应正文:**可选层**,挂在切块嵌入**之前**。知识源含 PDF / 扫描件 / 图片才需要;纯业务表 / 纯文本跳过本篇。本层只负责**把非文本变成文本块**,产出后**下游全复用**(切块 → 嵌入 → 检索 → 作答 一行不改)。

## 边界:做到哪、不做到哪
- **做**:类型分流 → 抽取 / OCR → 质量过滤 → 产出文本块接切块。
- **不做**:OCR 引擎内部调参、版面深度还原、cell 级表格结构化、语音——那是文档解析引擎的活,不在本 skill。本层**调现成库**,不重造轮子。

## 预处理骨架(可抄)

```java
List<TextChunk> preprocess(List<Upload> files) {
    List<TextChunk> out = new ArrayList<>();
    for (Upload f : files) {
        if (isImage(f) || isScannedPdf(f)) {        // 扫描件 / 图片 → OCR
            String text = ocrEngine.extract(f);       // [可替换] Tesseract / PaddleOCR / 云 OCR
            if (ocrQuality(text, f) < THRESHOLD) continue;  // 质量闸门:烂 OCR 不入库(变噪声)
            out.addAll(toChunks(text, f));
        } else if (isDigitalPdf(f)) {                // 数字 PDF(文本可选中)→ 直接抽,不走 OCR
            for (PdfPageText p : pdfTextExtractor.extract(f)) {
                if (p.isTable())
                    out.addAll(toChunks(tableToText(p), f));   // 表格保留行列结构
                else
                    out.addAll(toChunks(p.text(), f));
            }
        } else {
            out.addAll(toChunks(readPlainText(f), f));        // 纯文本直接进
        }
    }
    return out;   // 产出文本块 → 喂回 vector-store.md 层 2 的切块嵌入入库
}
```
> 产出的 `TextChunk` 和现有 seeding 切块产物**同构**,直接接 `vector-store.md` 层 2。本层是**前置适配**,不碰检索 / 作答。判扫描件:`每页可抽文本字符数 < 阈值` → 当扫描件走 OCR(别把扫描件当数字 PDF 抽空)。

## 选型怎么接
- **OCR**:Tesseract(开源、语言包全)/ **PaddleOCR**(中文 + 表格强,中文场景首选)/ 云 OCR(精度最高、付费)。接法都是"调 API / 命令行拿文本",挑一个装上即可。
- **数字 PDF 抽文本**:PyMuPDF / PDFPlumber / pdfminer(任一)。
- **表格**:Camelot(带线条表格准)/ PDFPlumber(基础)/ Unstructured.io(混合省心)。表格必须**转成保留行列结构的文本**(Markdown 表格或 `行|列|值`),丢成乱序字串就没法检索了。

## 质量闸门(决定 RAG 效果,别省)
OCR / 抽取质量**直接决定**下游质量——错字 → 切块嵌入全是噪声、检索召回垃圾。入库前必过:
- **OCR 置信度**:低于阈值(如 Tesseract 平均 conf < 60)的页丢弃或人工复核,别无脑入库;
- **抽空率**:一页抽出来的文本极少(< 50 字符)→ 可能是扫描件被当数字 PDF、或 OCR 失败 → 走 OCR 重试或丢弃;
- **首批抽样人工校验**:建库前抽几条看 OCR 质量,别等用户答出错答案才发现。

> ⚠️ **上面的阈值(conf < 60、< 50 字符)是经验起点,不是通用值**——不同 OCR 引擎(Tesseract / PaddleOCR / 云 OCR)置信度口径不同、你的文档质量(扫描清晰度 / 版式)不同,**必须用实际 PDF 批次校准**:抽一批、人工标对错、看阈值下的误丢 / 误留率再定。别照搬数字,跟 min-score 一样要按自己的数据和模型重测。

## 失败 / 降级
- OCR 服务挂 / 超时 → 该文件**标失败、跳过、记日志**,别让一个烂 PDF 卡住整批建库;
- 大文件 / 多页 → **异步处理**(别在请求线程同步 OCR 一个 200 页 PDF),进度可查;
- 整批预处理部分失败 → seeding 降级为"仅已成功文件",别全卡住。

## 验收
- 数字 PDF → 抽出文本和原内容对得上(抽空率低);
- 扫描件 → OCR 文本可读、置信度过闸;
- 含表格 PDF → 表格转成结构化文本、行列没乱;
- 烂 OCR(低置信度)→ 被闸门挡住、没进库;
- 产出的文本块能被现有检索命中、作答正确。
