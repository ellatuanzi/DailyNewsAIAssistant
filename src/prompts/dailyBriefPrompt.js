export function buildDailyBriefPrompt({ date, researchContext }) {
  return `
你是一个中文个人早报编辑。请为 ${date} 生成手机端易读的中文早报正文。

必须满足：
- 输出为纯文本
- 分区包括：今日速览、科技与 AI、科技投资观察、宏观与市场、Podcast、尾注
- 若提到影响某个领域，点名 2-5 家核心公司
- 这是给固定收件人的个人早报，不要写成通稿

以下是本地研究资料摘要，请作为选题优先级参考：
${JSON.stringify(researchContext, null, 2)}

如果你缺少最新新闻事实，不要编造。明确指出需要新闻抓取层补足。
`.trim();
}
