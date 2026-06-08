const DEFAULT_SECTION_LIST =
  "今日速览、科技与 AI、科技投资观察、关注清单、宏观与市场、网球、随机拓展、Podcast、尾注";
const PODCAST_SHOW_LIST =
  "罗永浩的十字路口、知行小酒馆、起朱楼宴宾客、无人知晓";
const WATCHLIST =
  "NVDA、AVGO、TSM、AMD、MSFT、GOOGL、AMZN、META、VGT、SMH";

function buildPromptContext({ researchContext, podcastContext, quoteContext }) {
  return `
个性化研究重点（只作为选题优先级参考，不要把本地资料当成最新事实）：
${JSON.stringify(researchContext, null, 2)}

已抓取的 Podcast 更新结果（Podcast 分区优先以此为准）：
${JSON.stringify(podcastContext, null, 2)}

已抓取的 SMH / VGT 行情结果（科技投资观察优先以此为准）：
${JSON.stringify(quoteContext, null, 2)}
`.trim();
}

function summarizeResearchContext(researchContext) {
  const stock = researchContext?.stockAnalysis || {};
  const supply = researchContext?.aiSupplyChain || {};

  return {
    stockSummary: stock.summary,
    stockPriorityTopics: stock.priorityTopics?.slice(0, 5) || [],
    stockPriorityCompanies: stock.priorityCompanies?.slice(0, 10) || [],
    stockPreferredEtfs: stock.preferredEtfs?.slice(0, 4) || [],
    aiSummary: supply.summary,
    aiPriorityTopics: supply.priorityTopics?.slice(0, 6) || [],
    aiPriorityCompanies: supply.priorityCompanies?.slice(0, 12) || [],
    aiPreferredEtfs: supply.preferredEtfs?.slice(0, 6) || []
  };
}

function buildRetryContext({ compactResearchContext, podcastContext, quoteContext }) {
  return `
个性化研究重点：
${JSON.stringify(compactResearchContext, null, 2)}

已抓取的 Podcast 更新结果：
${JSON.stringify(podcastContext, null, 2)}

已抓取的 SMH / VGT 行情结果：
${JSON.stringify(quoteContext, null, 2)}
`.trim();
}

function buildCoreRules(date) {
  return `
你是一个中文个人早报编辑。请先实时检索，再为 ${date} 生成手机端易读的中文早报正文。

硬性要求：
- 输出纯文本，不要输出 Markdown 表格，不要输出 HTML
- 开头必须先写“今日速览”，用 4-6 条短 bullet 概括今天最重要的判断，每条尽量不超过一行半
- 正文默认分区为：${DEFAULT_SECTION_LIST}
- 全文以北美读者视角组织，优先美国市场、科技公司、AI、半导体、云计算、监管、重大赛事
- 所有“过去 24 小时”“最新”“下一场比赛时间”“播客发布时间”“开赛日期”等时效性信息，都必须来自本次实时检索到的可核验来源
- 来源优先级：公司公告、官方博客、监管文件、ETF 官方页面、ATP/WTA/Grand Slam 官方页面、Apple Podcasts 页面、Reuters、AP、Bloomberg、WSJ、FT、ESPN、The Athletic、主流科技媒体
- 每条新闻或观察都必须单独包含“来源：来源名 URL”一行；没有 URL 的内容不要写
- 默认优先英文原始来源，先读英文来源再翻译成中文摘要；中文二手转载不要当主来源
- 宁可少写，也不要凑数；如果过去 24 小时可核验的重要更新有限，就只写确认过的条目
- 区分事实与判断；可以写判断，但不要夸张，不要使用确定性过强表述
- 绝不提供个股或 ETF 买卖建议、目标价或仓位建议
- 结尾必须保留：本邮件仅供信息参考，不构成投资建议。
`.trim();
}

function buildSectionRules() {
  return `
分区规则：
- 科技与 AI：选 4-6 条过去 24 小时内最重要、最能改变判断的新闻；优先 AI、半导体、云、AI 基础设施、主要科技平台和 AI 应用层
- 科技与 AI：每条使用固定结构并独立成行：
  标题：
  一句话结论：
  摘要：
  为什么值得关注：
  来源：来源名 URL
- 摘要控制在约 80-140 个中文字；“为什么值得关注”控制在约 40-80 个中文字
- 科技投资观察：重点覆盖 VGT、SMH、半导体、云计算、AI 基础设施、主要科技公司、相关 ETF/成分股的重要消息或市场影响
- 科技投资观察：每天都必须单独覆盖 SMH 和 VGT；至少写出本次实时核验到的当前价格或最近可核验价格，并明确数据口径（盘中、延迟行情、前收、盘后等）
- 科技投资观察：每条采用三行结构：
  观察：
  影响：
  风险：
  来源：来源名 URL
- 科技投资观察里要尽量同时交代 bull case 与 bear case，说明哪些属于短期交易叙事，哪些仍待财报、订单或资本开支验证
- 关注清单：只在 ${WATCHLIST} 过去 24 小时内出现实质变化时才写；若无实质变化，省略整个分区
- 关注清单格式固定为五行：
  标的：
  事件：
  影响：
  风险或待确认点：
  来源：来源名 URL
- 宏观与市场：选 2-3 条会影响市场、科技行业或全球风险偏好的重要事件；重点关注利率、美联储、监管、贸易与地缘风险如何传导到科技和高 beta 资产
- 网球：优先 Jannik Sinner 和 Carlos Alcaraz 的下一场比赛时间、赛事轮次、对手、签表位置，以及过去 24 小时内的伤病、退赛、采访、赛程变化或刚结束比赛对后续赛程的影响
- 网球：若美国举办的重要赛事将在未来 1-2 个月内开赛，可以给出简短 heads-up；至少包含赛事名称、举办城市/场地、开赛日期、为什么值得提前关注
- 网球：若既无实质更新也无值得提醒的 upcoming 赛事，则省略整个分区
- 随机拓展：每天固定 1 条，与用户核心关注不同、但高质量且值得拓展视野的新闻；要说明为什么选它
- Podcast：检查 ${PODCAST_SHOW_LIST} 过去 24 小时是否有新集；有则列出节目名、新集标题、发布时间、收听链接，并给出中文 summary、3 个关键要点、以及一句“是否值得优先听”的判断
- Podcast：优先基于节目官方简介、shownotes、公开页面和可访问的文字材料总结；如果只能看到标题和简短简介，必须明确写“基于公开简介的初步摘要”
- Podcast：若没有更新，直接写“今日暂无新集”
`.trim();
}

export function buildDailyBriefPrompt({
  date,
  researchContext,
  weatherContext,
  podcastContext,
  quoteContext
}) {
  void weatherContext;

  return `
${buildCoreRules(date)}

${buildSectionRules()}

写作要求：
- 每个分区之间空一行，避免大段密集文字
- 不要把长 URL 混在段落里；来源链接单独成行
- “今日速览”只写最重要的判断，不重复正文细节
- 若某个分区缺少可信的最新抓取而无法成文，明确写“该分区缺少可核验的最新抓取，暂不展开”；但 Podcast 无更新时只写“今日暂无新集”

${buildPromptContext({ researchContext, podcastContext, quoteContext })}
`.trim();
}

export function buildGroundingRetryPrompt({
  date,
  researchContext,
  weatherContext,
  podcastContext,
  quoteContext
}) {
  void weatherContext;
  const compactResearchContext = summarizeResearchContext(researchContext);

  return `
${buildCoreRules(date)}

这是重试版本。首要目标不是多写，而是确保每一条都来自本次实时检索。

额外要求：
- 科技与 AI 只写 4 条最重要更新
- 宏观与市场只写 2 条最重要更新
- 随机拓展只写 1 条
- 每个条目必须显式单独写出“来源：来源名 URL”
- 若某条内容没有可靠 URL，直接删除，不要保留
- 若 Google Search 没有足够可信结果，宁可减少条数

${buildSectionRules()}

${buildRetryContext({
  compactResearchContext,
  podcastContext,
  quoteContext
})}
`.trim();
}

export function buildSourceFormatRetryPrompt({
  date,
  researchContext,
  weatherContext,
  podcastContext,
  quoteContext
}) {
  void weatherContext;
  const compactResearchContext = summarizeResearchContext(researchContext);

  return `
${buildCoreRules(date)}

这是最后一次重试。唯一重点：每条内容都必须显式写出独立来源行，且格式稳定。

强制输出格式：
- 今日速览：4-5 条 bullet
- 科技与 AI：4 条，每条严格使用
  标题：
  一句话结论：
  摘要：
  为什么值得关注：
  来源：来源名 URL
- 科技投资观察：至少 2 条，且必须包含 VGT 与 SMH；每条严格使用
  观察：
  影响：
  风险：
  来源：来源名 URL
- 关注清单：只有实质变化才写；每个标的严格使用
  标的：
  事件：
  影响：
  风险或待确认点：
  来源：来源名 URL
- 宏观与市场：2 条，每条严格包含“来源：”
- 网球：如有更新，至少 1 条且严格包含“来源：”
- 随机拓展：1 条且严格包含“来源：”
- Podcast：有更新则逐条列出节目名、新集标题、发布时间、收听链接、摘要、关键要点、是否值得优先听；无更新则只写“今日暂无新集”
- 尾注：本邮件仅供信息参考，不构成投资建议。

不要省略任何“来源：”行。没有可靠 URL 的条目不要写。

${buildRetryContext({
  compactResearchContext,
  podcastContext,
  quoteContext
})}
`.trim();
}
