# 嵌入/作答 Provider 与技术栈选型

> 对应正文:**决策先定** + **层 11**。讲"用什么模型/平台"以及"怎么让技术栈可替换"。本篇内容与具体平台无关;末尾给一套参考实现。

## 核心原则:嵌入 + 作答同源、走 OpenAI 兼容端点

嵌入模型 + 作答模型用**同一个来源**(同一家云平台,或同一套本地服务),一个 key / 一套配置。理由:
- 一套配额 / 一份配置,部署最简;
- 换来源(换云厂商、或云 ↔ 本地)只改 `base_url` + key,不动业务代码(靠下面的 Provider 抽象)。

**云端还是本地,都走"OpenAI 兼容"端点**(都提供 `/v1/embeddings` + `/v1/chat/completions`):
- **云端 API**(小机部署如 2C2G 零本地推理压力):OpenAI 官方、DeepSeek 官方、智谱、硅基流动 等,任选一家,填它的 `base_url` + key;
- **本地模型**(内网 / 无外网 / 数据不出域):用提供 **OpenAI 兼容端点**的本地推理服务(如 **vLLM、LocalAI**,或 Ollama 的兼容层)——`base_url` 指本机地址、key 可空。⚠️ **注意 Ollama 嵌入端点的兼容性**:Ollama 原生嵌入是 `/api/embeddings`,与 OpenAI 的 `/v1/embeddings` 路径 / 返回格式都不同(兼容层视版本而定)——不兼容时套一层薄适配,或直接选 vLLM / LocalAI 这类原生 OpenAI 兼容的本地服务,省得踩坑。
> 所以"能不能用本地模型"不是另起一套,而是 Provider 抽象的另一个 impl:云端填云地址、本地填本机地址。下面参考配置两者通用。

## Provider 抽象(可插拔)

把"用什么模型嵌入/作答"委托给接口,业务编排层零感知:

```java
public interface EmbeddingProvider {
    float[] embed(String text);   // 建议返回 L2 归一化向量,使余弦=点积(向量库依赖此约定)
    int dimension();
    String name();
}

public interface ChatProvider {
    String answer(String query, List<String> passages, List<ChatTurn> history);   // 贴资料作答
    String answerGeneral(String query, List<ChatTurn> history);                   // 通用知识兜底
    String name();
}
```

- 默认提供 **stub 实现**(如 hashing 词面嵌入、templated 模板作答),让框架在**未接真实模型**时也能端到端跑通(导入→检索→命中→作答)——便于先联调管线、再接模型。
- 用 `@ConditionalOnProperty(prefix="…kb.embedding", name="impl", havingValue="…", matchIfMissing=true)` 选实现,`impl` 配置 opt-in。
- 嵌入向量须 **L2 归一化**,向量库才能用"点积 = 余弦"的最快路径。

## 成本开关(防计费失控)

第三方 API 按量计费,必须有**管理员一键关停**开关:
- **配置 / 环境变量是主开关、单独就够**(如 `kb.enabled` env)——中小项目一处搞定,别无谓加运维心智;
- **可选**:若要"管理员**运行时**关停而免重新部署",再加一张 `system_config` 表同名字段做**运行时覆盖**(配置 + DB 取并集,任一关闭即停)——这是**可选增强,不是必须双源**;不想要运行时覆盖就只留配置开关;
- **管理员可豁免**:关停后管理员仍能问答(便于排障);
- 关停时前端禁用入口、后端拒绝作答。

## 作答服务异常 ≠ 通用知识兜底(易错点)

作答 API 调用失败(网络断连 / HTTP 非 2xx / key 失效 / 额度耗尽)是**异常**,不是"本地 0 命中 → 通用知识兜底"的正常分支。必须分开处理,否则会把异常文本当答案、并错挂在「通用知识」标签下:

- 定义独立的 `KbUnavailableException`,Provider 调用失败时**抛异常**(而非返回异常文本当答案、也而非吞掉);
- 编排层 `catch` → 标 `mode=error`、答"知识库服务暂时不可用,请稍后重试"、清空来源、直接返回(跳过拒答检测/动作解析);
- `mode=general`(通用知识标签)**只在"本地 0 命中 且 非计数/规模问题"时**才置。
- Provider 内部:`callLlm` 的 `catch(Exception)` 要先放行自己抛的 `KbUnavailableException`,再兜底其它异常,避免被吞。

## 参考配置:接一家 OpenAI 兼容端点(云或本地)

不绑特定厂商——下面是"接一个真实端点"的参照,云端 / 本地同理,换厂商只换 `base_url` + 模型名:
- **选端点**:云端的 OpenAI / DeepSeek / 智谱 / 硅基流动 等任一,或本地的 Ollama;都暴露 `/v1/embeddings` + `/v1/chat/completions`。
- **模型名(随端点可选,举例)**:嵌入用中文语义强的 1024 维模型(如 `BAAI/bge-m3`);作答用通用对话模型(云端可用 `deepseek-v3`、`qwen-plus` 之类;本地 Ollama 可拉 `qwen2.5:7b` 等开源模型,按机器显存选尺寸)。
- **配置 opt-in**:`embedding.impl=remote`、`chat.impl=remote`,再配 `base_url` + `api-key`(本地 Ollama 的 key 可空);
- **api-key 放 gitignore 的本地配置 / 环境变量,绝不进代码或 commit**。
> 命名用泛化的 `remote`(OpenAI 兼容远端)而非厂商名,避免日后换厂商时配置键也得改;`base_url` 才是真正区分云端哪家 / 本地的开关。
