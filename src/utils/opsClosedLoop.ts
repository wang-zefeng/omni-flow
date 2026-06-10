import {
  aggregateByDimension,
  parseNumericValue,
  type ImportedDataType,
  type TableProfile
} from "./tableAnalysis";

export type ClosedLoopTaskStatus = "todo" | "doing" | "review" | "done";
export type ClosedLoopRiskLevel = "high" | "medium" | "low";

export interface OperatingSnapshot {
  importKey: string;
  fileName: string;
  sheetName: string;
  importedAt: string;
  dataType: ImportedDataType;
  rowCount: number;
  columnCount: number;
  fillRate: number;
  businessDomainLabel: string;
  metricKey: string;
  dimensionKey: string;
  metricTotal: number;
  metricAverage: number;
  metricMin: number;
  metricMax: number;
  volatilityCv: number | null;
  topDimensions: { name: string; value: number; share: number }[];
  healthScore: number;
  warnings: string[];
}

export interface DiagnosticInsight {
  id: string;
  riskLevel: ClosedLoopRiskLevel;
  issueType: "data_quality" | "metric_volatility" | "metric_concentration" | "metric_negative" | "capacity" | "opportunity";
  title: string;
  summary: string;
  evidence: string;
  recommendedAction: string;
  owner: string;
}

export interface ClosedLoopTask {
  id: string;
  insightId: string;
  title: string;
  owner: string;
  priority: ClosedLoopRiskLevel;
  status: ClosedLoopTaskStatus;
  evidence: string;
  action: string;
  createdAt: string;
  updatedAt: string;
  reviewNote?: string;
  reviewResult?: string;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function safeKey(value: string) {
  return value.replace(/[^\w\u4e00-\u9fa5-]+/g, "-").replace(/^-|-$/g, "") || "default";
}

function formatNumber(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function buildImportKey(fileName: string, sheetName: string, importedAt: string) {
  return [fileName, sheetName, importedAt].map(safeKey).join("__");
}

export function buildOperatingSnapshot(input: {
  fileName: string;
  sheetName: string;
  importedAt: string;
  dataType: ImportedDataType;
  rows: any[];
  profile: TableProfile;
  preferredMetricKey?: string;
}): OperatingSnapshot {
  const metricKey =
    input.preferredMetricKey ||
    input.profile.primaryMetric ||
    input.profile.numericFields[0] ||
    "";
  const dimensionKey =
    input.profile.primaryDimension ||
    input.profile.dimensionFields[0] ||
    input.profile.idFields[0] ||
    "";
  const metricColumn = input.profile.columns.find((column) => column.key === metricKey);
  const metricTotal = metricColumn?.sum ?? 0;
  const metricAverage = metricColumn?.avg ?? 0;
  const metricMin = metricColumn?.min ?? 0;
  const metricMax = metricColumn?.max ?? 0;

  let varianceSum = 0;
  let metricCount = 0;
  if (metricKey && metricAverage !== 0) {
    for (const row of input.rows) {
      const value = parseNumericValue(row?.[metricKey]);
      if (value === null) continue;
      varianceSum += Math.pow(value - metricAverage, 2);
      metricCount += 1;
    }
  }
  const volatilityCv =
    metricCount > 1 && metricAverage !== 0
      ? Math.sqrt(varianceSum / metricCount) / Math.abs(metricAverage)
      : null;

  const topDimensions =
    dimensionKey && metricKey
      ? aggregateByDimension(input.rows, dimensionKey, metricKey, 5).map((item) => ({
          ...item,
          share: metricTotal > 0 ? item.value / metricTotal : 0
        }))
      : [];

  const topShare = topDimensions[0]?.share ?? 0;
  const healthScore = Math.round(
    clamp(
      100 -
        Math.max(0, 95 - input.profile.fillRate) * 1.2 -
        (volatilityCv !== null && volatilityCv > 0.8 ? 12 : 0) -
        (topShare > 0.55 ? 10 : 0) -
        (metricMin < 0 ? 15 : 0) -
        (metricKey ? 0 : 18),
      0,
      100
    )
  );

  return {
    importKey: buildImportKey(input.fileName, input.sheetName, input.importedAt),
    fileName: input.fileName,
    sheetName: input.sheetName,
    importedAt: input.importedAt,
    dataType: input.dataType,
    rowCount: input.profile.rowCount,
    columnCount: input.profile.columnCount,
    fillRate: input.profile.fillRate,
    businessDomainLabel: input.profile.businessDomainLabel,
    metricKey,
    dimensionKey,
    metricTotal,
    metricAverage,
    metricMin,
    metricMax,
    volatilityCv,
    topDimensions,
    healthScore,
    warnings: input.profile.warnings
  };
}

export function diagnoseOperatingSnapshot(snapshot: OperatingSnapshot): DiagnosticInsight[] {
  const insights: DiagnosticInsight[] = [];
  const topDimension = snapshot.topDimensions[0];

  if (snapshot.fillRate < 85) {
    insights.push({
      id: `${snapshot.importKey}-data-quality`,
      riskLevel: "high",
      issueType: "data_quality",
      title: "数据完整度低于上线阈值",
      summary: `当前工作表完整度 ${snapshot.fillRate.toFixed(1)}%，会影响经营画像和后续 Agent 判断。`,
      evidence: `${snapshot.rowCount} 行 / ${snapshot.columnCount} 列，缺失率 ${(100 - snapshot.fillRate).toFixed(1)}%。`,
      recommendedAction: "让数据负责人复核导出范围、合并单元格、空值字段和字段映射模板。",
      owner: "数据负责人"
    });
  }

  if (!snapshot.metricKey) {
    insights.push({
      id: `${snapshot.importKey}-no-metric`,
      riskLevel: "medium",
      issueType: "data_quality",
      title: "未识别稳定经营指标",
      summary: "当前表格没有稳定数值字段，暂时无法形成可解释的经营指标看板。",
      evidence: `字段画像类型：${snapshot.businessDomainLabel}，数值主指标为空。`,
      recommendedAction: "补充或手动映射 GMV、订单量、退款、广告费、库存等核心字段。",
      owner: "运营负责人"
    });
  }

  if (snapshot.volatilityCv !== null && snapshot.volatilityCv > 0.6) {
    insights.push({
      id: `${snapshot.importKey}-volatility`,
      riskLevel: snapshot.volatilityCv > 1 ? "high" : "medium",
      issueType: "metric_volatility",
      title: "主指标波动偏高",
      summary: `${snapshot.metricKey} 的变异系数为 ${(snapshot.volatilityCv * 100).toFixed(0)}%，需要排查异常渠道或异常行。`,
      evidence: `均值 ${formatNumber(snapshot.metricAverage)}，最小 ${formatNumber(snapshot.metricMin)}，最大 ${formatNumber(snapshot.metricMax)}。`,
      recommendedAction: "按渠道/店铺/商品拆分 Top 与异常值，确认是否是大促、退款、断货或投流造成。",
      owner: "运营负责人"
    });
  }

  if (topDimension && topDimension.share > 0.45) {
    insights.push({
      id: `${snapshot.importKey}-concentration`,
      riskLevel: topDimension.share > 0.6 ? "high" : "medium",
      issueType: "metric_concentration",
      title: "经营指标集中度偏高",
      summary: `${topDimension.name} 占 ${snapshot.metricKey} 的 ${(topDimension.share * 100).toFixed(1)}%，存在单一渠道/单品依赖。`,
      evidence: `Top 维度贡献 ${formatNumber(topDimension.value)} / 总计 ${formatNumber(snapshot.metricTotal)}。`,
      recommendedAction: "让负责人复核该维度是否由活动、刷单、异常退款或供应不足导致，并制定分散策略。",
      owner: "渠道负责人"
    });
  }

  if (snapshot.metricMin < 0) {
    insights.push({
      id: `${snapshot.importKey}-negative`,
      riskLevel: "high",
      issueType: "metric_negative",
      title: "主指标出现负值",
      summary: `${snapshot.metricKey} 存在负值，可能是退款、冲销、退货或账务抵扣。`,
      evidence: `最小值 ${formatNumber(snapshot.metricMin)}，总计 ${formatNumber(snapshot.metricTotal)}。`,
      recommendedAction: "财务与售后负责人核对负值来源，区分真实经营损失和口径抵扣。",
      owner: "财务负责人"
    });
  }

  if (snapshot.rowCount > 50000 || snapshot.columnCount > 200) {
    insights.push({
      id: `${snapshot.importKey}-capacity`,
      riskLevel: "medium",
      issueType: "capacity",
      title: "报表规模已接近异步处理区间",
      summary: "当前数据量较大，建议进入后台异步解析和任务队列，避免浏览器长时间占用。",
      evidence: `${snapshot.rowCount} 行 / ${snapshot.columnCount} 列。`,
      recommendedAction: "将该类模板登记为标准日报模板，后续走后端解析、校验和自动入库。",
      owner: "系统管理员"
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: `${snapshot.importKey}-opportunity`,
      riskLevel: "low",
      issueType: "opportunity",
      title: "经营日报可进入常规复盘",
      summary: "当前导入数据完整度和主指标分布处于可分析状态，可以直接进入日常复盘闭环。",
      evidence: `健康分 ${snapshot.healthScore}，完整度 ${snapshot.fillRate.toFixed(1)}%，主指标 ${snapshot.metricKey || "未指定"}。`,
      recommendedAction: "由运营负责人确认 Top 维度变化，并记录本日报的复盘结论。",
      owner: "运营负责人"
    });
  }

  return insights.slice(0, 5);
}

export function createClosedLoopTasks(
  insights: DiagnosticInsight[],
  snapshot: OperatingSnapshot,
  createdAt = new Date().toISOString()
): ClosedLoopTask[] {
  return insights.map((insight, index) => ({
    id: `${insight.id}-task-${index + 1}`,
    insightId: insight.id,
    title: insight.title,
    owner: insight.owner,
    priority: insight.riskLevel,
    status: "todo",
    evidence: insight.evidence,
    action: insight.recommendedAction,
    createdAt,
    updatedAt: createdAt,
    reviewNote: "",
    reviewResult: snapshot.importKey
  }));
}

export function getNextTaskStatus(status: ClosedLoopTaskStatus): ClosedLoopTaskStatus {
  if (status === "todo") return "doing";
  if (status === "doing") return "review";
  if (status === "review") return "done";
  return "done";
}

