export type ImportedDataType = "platforms" | "supply_chain" | "finance" | "custom";

export type ColumnRole = "money" | "number" | "ratio" | "date" | "dimension" | "id" | "empty";

export interface ColumnProfile {
  key: string;
  role: ColumnRole;
  nonEmptyCount: number;
  numericCount: number;
  dateCount: number;
  distinctCount: number;
  distinctCountIsCapped?: boolean;
  missingCount: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  sampleValues: string[];
}

export interface TableProfile {
  rowCount: number;
  columnCount: number;
  fillRate: number;
  missingCells: number;
  businessDomain: ImportedDataType;
  businessDomainLabel: string;
  columns: ColumnProfile[];
  moneyFields: string[];
  numericFields: string[];
  ratioFields: string[];
  dateFields: string[];
  dimensionFields: string[];
  idFields: string[];
  primaryDimension?: string;
  primaryMetric?: string;
  primaryDate?: string;
  profiledCellCount?: number;
  usesCappedDistinctCounts?: boolean;
  warnings: string[];
}

export interface TimeSeriesPoint {
  name: string;
  value: number;
  date?: string;
  source?: string;
}

const MONEY_WORDS = ["金额", "销售", "流水", "营收", "收入", "GMV", "货值", "成本", "费用", "退款", "利润", "毛利", "净利", "支出", "预算", "客单", "回款", "price", "amount", "sales", "revenue", "gmv", "cost", "fee", "refund", "profit", "income", "expense", "budget"];
const RATIO_WORDS = ["率", "占比", "比例", "转化", "ROI", "毛利率", "退款率", "达成率", "完成率", "rate", "ratio", "percent", "conversion", "ctr", "cvr", "roi", "%"];
const DATE_WORDS = ["日期", "时间", "月份", "年月", "日", "周", "季度", "date", "time", "month", "day", "week", "quarter"];
const NUMBER_WORDS = ["销量", "订单数", "订单", "库存", "访客数", "访客", "点击数", "点击", "件数", "数量", "volume", "orders", "stock", "inventory", "visitors", "clicks", "quantity"];
const ID_WORDS = ["id", "编号", "编码", "货号", "sku", "spu", "订单号", "单号", "工号", "employee id", "code"];
const DIMENSION_WORDS = ["名称", "姓名", "部门", "渠道", "平台", "店铺", "商品", "产品", "品名", "品牌", "类目", "供应商", "仓库", "城市", "区域", "活动", "项目", "负责人", "状态", "name", "category", "channel", "platform", "brand", "department", "supplier", "warehouse", "region", "owner", "status"];

const DOMAIN_KEYWORDS: Record<ImportedDataType, string[]> = {
  platforms: ["店铺", "渠道", "平台", "订单", "访客", "转化", "GMV", "uv", "pv", "客诉", "客服", "流量", "成交"],
  supply_chain: ["库存", "在库", "在途", "仓库", "补货", "供应商", "排产", "交期", "lead", "sku", "DOH", "入库", "出库"],
  finance: ["财务", "损益", "利润", "毛利", "退款", "费用", "广告", "投流", "佣金", "扣点", "成本", "回款", "P&L"],
  custom: ["人事", "员工", "薪资", "绩效", "考勤", "市场", "投放", "素材", "项目", "合同", "采购", "客户", "线索", "CRM"],
};

const MAX_EXACT_DISTINCT_VALUES = 10000;
const LARGE_PROFILE_CELL_COUNT = 250000;

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function includesAny(text: string, words: string[]) {
  const lower = text.toLowerCase();
  return words.some((word) => lower.includes(word.toLowerCase()));
}

export function parseNumericValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  let text = String(value).trim();
  if (!text) return null;

  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }

  text = text
    .replace(/[￥¥$,%\s]/g, "")
    .replace(/,/g, "")
    .replace(/[＋+]/g, "")
    .replace(/[，]/g, "");

  if (text.endsWith("万")) {
    const n = Number(text.slice(0, -1));
    return Number.isFinite(n) ? (negative ? -n * 10000 : n * 10000) : null;
  }

  const n = Number(text);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

export function isDateLike(value: unknown): boolean {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return true;
  const text = normalizeText(value);
  if (!text) return false;
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(text)) return true;
  if (/^\d{1,2}[-/.]\d{1,2}$/.test(text)) return true;
  if (/^\d{1,2}月\d{1,2}日$/.test(text)) return true;
  if (/^\d{1,2}日$/.test(text)) return true;
  if (/^\d{4}年\d{1,2}月/.test(text)) return true;
  return false;
}

export function normalizeCellValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value !== "string") return value;

  const text = value.trim();
  if (!text) return "";
  const numeric = parseNumericValue(text);
  if (numeric !== null && /[\d]/.test(text) && !/[a-zA-Z\u4e00-\u9fa5]/.test(text.replace(/[年月日万]/g, ""))) {
    return numeric;
  }
  return text;
}

export function makeUniqueHeaders(rawHeaders: unknown[]) {
  const counts: Record<string, number> = {};
  return rawHeaders.map((header, index) => {
    const base = normalizeText(header) || `字段_${index + 1}`;
    counts[base] = (counts[base] || 0) + 1;
    return counts[base] === 1 ? base : `${base}_${counts[base]}`;
  });
}

export function flattenRecord(input: Record<string, any>, prefix = ""): Record<string, any> {
  const result: Record<string, any> = {};
  Object.entries(input || {}).forEach(([key, value]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      Object.assign(result, flattenRecord(value, nextKey));
    } else {
      result[nextKey] = normalizeCellValue(value);
    }
  });
  return result;
}

function inferColumnRole(
  key: string,
  stats: {
    rowCount: number;
    nonEmptyCount: number;
    numericCount: number;
    dateCount: number;
    distinctCount: number;
  }
): ColumnRole {
  if (stats.nonEmptyCount === 0) return "empty";

  const numericRate = stats.numericCount / Math.max(1, stats.nonEmptyCount);
  const dateRate = stats.dateCount / Math.max(1, stats.nonEmptyCount);

  if (includesAny(key, ID_WORDS)) return "id";
  if (includesAny(key, DATE_WORDS) || dateRate >= 0.6) return "date";
  if (includesAny(key, RATIO_WORDS)) return "ratio";
  if (includesAny(key, MONEY_WORDS)) return "money";
  if (includesAny(key, NUMBER_WORDS)) return "number";
  if (numericRate >= 0.75) return "number";
  if (includesAny(key, DIMENSION_WORDS)) return "dimension";
  if (stats.distinctCount <= Math.max(20, stats.rowCount * 0.7)) return "dimension";
  return "dimension";
}

export function profileTable(headers: string[], rows: any[]): TableProfile {
  const rowCount = rows.length;
  let usesCappedDistinctCounts = false;

  const columns: ColumnProfile[] = headers.map((key) => {
    let nonEmptyCount = 0;
    let numericCount = 0;
    let dateCount = 0;
    let sum = 0;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    let distinctCountIsCapped = false;
    const sampleValues: string[] = [];
    const distinctValues = new Set<string>();

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const rawValue = rows[rowIndex]?.[key];
      const textValue = normalizeText(rawValue);
      if (textValue === "") continue;

      nonEmptyCount += 1;
      if (sampleValues.length < 4) sampleValues.push(textValue);

      if (!distinctCountIsCapped) {
        distinctValues.add(textValue);
        if (distinctValues.size > MAX_EXACT_DISTINCT_VALUES) {
          distinctCountIsCapped = true;
          distinctValues.clear();
        }
      }

      const numericValue = parseNumericValue(rawValue);
      if (numericValue !== null) {
        numericCount += 1;
        sum += numericValue;
        if (numericValue < min) min = numericValue;
        if (numericValue > max) max = numericValue;
      }

      if (isDateLike(rawValue)) dateCount += 1;
    }

    if (distinctCountIsCapped) usesCappedDistinctCounts = true;

    const distinctCount = distinctCountIsCapped
      ? MAX_EXACT_DISTINCT_VALUES + 1
      : distinctValues.size;
    const role = inferColumnRole(key, {
      rowCount,
      nonEmptyCount,
      numericCount,
      dateCount,
      distinctCount,
    });

    return {
      key,
      role,
      nonEmptyCount,
      numericCount,
      dateCount,
      distinctCount,
      distinctCountIsCapped,
      missingCount: rowCount - nonEmptyCount,
      sum,
      avg: numericCount > 0 ? sum / numericCount : 0,
      min: numericCount > 0 ? min : 0,
      max: numericCount > 0 ? max : 0,
      sampleValues,
    };
  });

  const totalCells = rowCount * headers.length;
  const missingCells = columns.reduce((acc, col) => acc + col.missingCount, 0);
  const fillRate = totalCells > 0 ? ((totalCells - missingCells) / totalCells) * 100 : 100;

  const moneyFields = columns.filter((c) => c.role === "money").map((c) => c.key);
  const numericFields = columns.filter((c) => c.role === "number" || c.role === "money" || c.role === "ratio").map((c) => c.key);
  const ratioFields = columns.filter((c) => c.role === "ratio").map((c) => c.key);
  const dateFields = columns.filter((c) => c.role === "date").map((c) => c.key);
  const dimensionFields = columns.filter((c) => c.role === "dimension").map((c) => c.key);
  const idFields = columns.filter((c) => c.role === "id").map((c) => c.key);

  const primaryMetric = moneyFields[0] || numericFields[0];
  const primaryDimension = dimensionFields[0] || idFields[0] || headers[0];
  const primaryDate = dateFields[0];

  const businessDomain = inferBusinessDomain(headers, rows);
  const warnings: string[] = [];
  if (totalCells > LARGE_PROFILE_CELL_COUNT) warnings.push("Large table profile used streaming analysis to avoid browser stack overflow.");
  if (usesCappedDistinctCounts) warnings.push(`High-cardinality distinct counts are capped at ${MAX_EXACT_DISTINCT_VALUES}+ values.`);
  if (fillRate < 85) warnings.push("表格存在较多空值，建议核对导出范围或合并单元格。");
  if (numericFields.length === 0) warnings.push("暂未识别到稳定数值指标，可手动选择Y轴字段。");
  if (dimensionFields.length === 0 && idFields.length === 0) warnings.push("暂未识别到清晰文本维度，图表分组可能不够稳定。");

  return {
    rowCount,
    columnCount: headers.length,
    fillRate,
    missingCells,
    businessDomain,
    businessDomainLabel: getBusinessDomainLabel(businessDomain, headers),
    columns,
    moneyFields,
    numericFields,
    ratioFields,
    dateFields,
    dimensionFields,
    idFields,
    primaryDimension,
    primaryMetric,
    primaryDate,
    profiledCellCount: totalCells,
    usesCappedDistinctCounts,
    warnings,
  };
}

export function inferBusinessDomain(headers: string[], rows: any[] = []): ImportedDataType {
  const text = [
    ...headers,
    ...rows.slice(0, 5).flatMap((row) => Object.values(row || {}).map((v) => normalizeText(v))),
  ].join(" ");

  const scores = Object.entries(DOMAIN_KEYWORDS).map(([domain, words]) => ({
    domain: domain as ImportedDataType,
    score: words.reduce((acc, word) => acc + (text.toLowerCase().includes(word.toLowerCase()) ? 1 : 0), 0),
  }));

  scores.sort((a, b) => b.score - a.score);
  return scores[0]?.score > 0 ? scores[0].domain : "custom";
}

export function getBusinessDomainLabel(domain: ImportedDataType, headers: string[] = []) {
  if (domain === "platforms") return "运营/渠道成交表";
  if (domain === "supply_chain") return "供应链/库存履约表";
  if (domain === "finance") return "财务/P&L损益表";
  const joined = headers.join(" ");
  if (includesAny(joined, ["人事", "员工", "薪资", "绩效", "考勤"])) return "人事/绩效组织表";
  if (includesAny(joined, ["市场", "投放", "素材", "点击", "曝光", "CTR"])) return "市场/投放增长表";
  if (includesAny(joined, ["客户", "线索", "CRM", "跟进", "商机"])) return "客户/销售CRM表";
  return "通用业务数据表";
}

export function aggregateByDimension(rows: any[], dimensionKey: string, metricKey: string, limit = 20) {
  const groups: Record<string, number> = {};
  rows.forEach((row) => {
    const dimension = normalizeText(row?.[dimensionKey]) || "未命名";
    const value = parseNumericValue(row?.[metricKey]) || 0;
    groups[dimension] = (groups[dimension] || 0) + value;
  });
  return Object.entries(groups)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

export function buildRowTimeSeries(rows: any[], profile: TableProfile, metricKey?: string): TimeSeriesPoint[] {
  const dateKey = profile.primaryDate;
  const valueKey = metricKey || profile.primaryMetric;
  if (!dateKey || !valueKey) return [];

  const groups: Record<string, number> = {};
  rows.forEach((row) => {
    const date = normalizeText(row?.[dateKey]);
    if (!date) return;
    const value = parseNumericValue(row?.[valueKey]) || 0;
    groups[date] = (groups[date] || 0) + value;
  });

  return Object.entries(groups)
    .map(([name, value]) => ({ name, value, date: name }))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN", { numeric: true }));
}

export function summarizeSheets(sheets: { name: string; headers: string[]; rows: any[]; dailySeries?: any[]; profile?: TableProfile }[]) {
  return sheets.map((sheet) => {
    const profile = sheet.profile || profileTable(sheet.headers || [], sheet.rows || []);
    return {
      name: sheet.name,
      rowCount: profile.rowCount,
      columnCount: profile.columnCount,
      fillRate: Number(profile.fillRate.toFixed(1)),
      businessDomainLabel: profile.businessDomainLabel,
      primaryDimension: profile.primaryDimension,
      primaryMetric: profile.primaryMetric,
      numericFields: profile.numericFields.slice(0, 8),
      dateFields: profile.dateFields.slice(0, 4),
      timeSeriesPoints: sheet.dailySeries?.length || 0,
    };
  });
}

export type DiagnosticSeverity = "info" | "warning" | "danger";

export interface FieldRecognition {
  name: string;
  type: ColumnRole;
  reason: string;
}

export interface AmountMetrics {
  field: string;
  total: number;
  average: number;
  max: number;
  min: number;
}

export interface TableAnalysisMetrics {
  validRecordCount: number;
  totalFieldCount: number;
  numericFieldCount: number;
  textDimensionCount: number;
  emptyCellRatio: number;
  duplicateRecordCount: number;
  amount?: AmountMetrics;
}

export interface TopDimensionContribution {
  dimension: string;
  value: string;
  amount: number;
  recordCount: number;
}

export interface DateTrendPoint {
  date: string;
  amount: number;
  recordCount: number;
}

export interface TableDiagnostic {
  id: string;
  type: string;
  severity: DiagnosticSeverity;
  description: string;
  fields: string[];
}

export interface TableAnalysisResult {
  fields: FieldRecognition[];
  metrics: TableAnalysisMetrics;
  topDimensions: TopDimensionContribution[];
  dateTrend: DateTrendPoint[];
  diagnostics: TableDiagnostic[];
}

function getRecognitionReason(column: ColumnProfile): string {
  if (column.role === "date") {
    return includesAny(column.key, DATE_WORDS)
      ? "字段名命中日期/时间规则"
      : `内容日期占比 ${Math.round((column.dateCount / Math.max(column.nonEmptyCount, 1)) * 100)}%`;
  }
  if (column.role === "ratio") return "字段名命中比例/转化率规则";
  if (column.role === "money") return "字段名命中金额/销售/成本规则";
  if (column.role === "number") {
    return includesAny(column.key, NUMBER_WORDS)
      ? "字段名命中销量/订单/库存等数值规则"
      : `内容数值占比 ${Math.round((column.numericCount / Math.max(column.nonEmptyCount, 1)) * 100)}%`;
  }
  if (column.role === "id") return "字段名命中 ID/SKU/编码规则";
  if (column.role === "empty") return "整列为空";
  return includesAny(column.key, DIMENSION_WORDS)
    ? "字段名命中文本维度规则"
    : "内容以文本或离散值为主";
}

function countDuplicateRows(headers: string[], rows: any[]): number {
  const seen = new Set<string>();
  let duplicates = 0;
  rows.forEach((row) => {
    const signature = JSON.stringify(headers.map((header) => normalizeCellValue(row?.[header])));
    if (seen.has(signature)) duplicates += 1;
    else seen.add(signature);
  });
  return duplicates;
}

function buildTopDimensions(
  rows: any[],
  profile: TableProfile,
  metricKey: string | undefined
): TopDimensionContribution[] {
  if (profile.dimensionFields.length === 0) return [];

  const contributions: TopDimensionContribution[] = [];
  profile.dimensionFields.slice(0, 5).forEach((dimension) => {
    const groups = new Map<string, { amount: number; recordCount: number }>();
    rows.forEach((row) => {
      const value = normalizeText(row?.[dimension]) || "未填写";
      const current = groups.get(value) || { amount: 0, recordCount: 0 };
      current.amount += metricKey ? parseNumericValue(row?.[metricKey]) || 0 : 0;
      current.recordCount += 1;
      groups.set(value, current);
    });

    Array.from(groups.entries())
      .map(([value, summary]) => ({ dimension, value, ...summary }))
      .sort((left, right) =>
        metricKey
          ? right.amount - left.amount || right.recordCount - left.recordCount
          : right.recordCount - left.recordCount
      )
      .slice(0, 5)
      .forEach((item) => contributions.push(item));
  });

  return contributions.slice(0, 25);
}

function buildDateTrend(rows: any[], profile: TableProfile, metricKey: string | undefined): DateTrendPoint[] {
  if (!profile.primaryDate) return [];
  const groups = new Map<string, { amount: number; recordCount: number }>();
  rows.forEach((row) => {
    const date = normalizeText(row?.[profile.primaryDate as string]);
    if (!date) return;
    const current = groups.get(date) || { amount: 0, recordCount: 0 };
    current.amount += metricKey ? parseNumericValue(row?.[metricKey]) || 0 : 0;
    current.recordCount += 1;
    groups.set(date, current);
  });
  return Array.from(groups.entries())
    .map(([date, summary]) => ({ date, ...summary }))
    .sort((left, right) => left.date.localeCompare(right.date, "zh-CN", { numeric: true }));
}

function buildDiagnostics(
  headers: string[],
  rows: any[],
  profile: TableProfile,
  duplicateRecordCount: number,
  amountField: string | undefined
): TableDiagnostic[] {
  const diagnostics: TableDiagnostic[] = [
    {
      id: "structure-summary",
      type: "structure",
      severity: "info",
      description: `已按规则识别 ${headers.length} 个字段和 ${rows.length} 条有效记录。`,
      fields: [],
    },
  ];

  const totalCells = Math.max(rows.length * headers.length, 1);
  const emptyRatio = profile.missingCells / totalCells;
  if (emptyRatio >= 0.4) {
    diagnostics.push({
      id: "missing-cells-danger",
      type: "missing_values",
      severity: "danger",
      description: `空值比例达到 ${(emptyRatio * 100).toFixed(1)}%，分析结果可能失真。`,
      fields: profile.columns.filter((column) => column.missingCount > rows.length * 0.4).map((column) => column.key),
    });
  } else if (emptyRatio >= 0.1) {
    diagnostics.push({
      id: "missing-cells-warning",
      type: "missing_values",
      severity: "warning",
      description: `空值比例为 ${(emptyRatio * 100).toFixed(1)}%，建议检查缺失字段。`,
      fields: profile.columns.filter((column) => column.missingCount > 0).map((column) => column.key),
    });
  }

  if (duplicateRecordCount > 0) {
    const duplicateRatio = duplicateRecordCount / Math.max(rows.length, 1);
    diagnostics.push({
      id: "duplicate-rows",
      type: "duplicate_rows",
      severity: duplicateRatio >= 0.2 ? "danger" : "warning",
      description: `检测到 ${duplicateRecordCount} 条重复记录，占比 ${(duplicateRatio * 100).toFixed(1)}%。`,
      fields: headers,
    });
  }

  profile.columns
    .filter((column) => ["number", "money", "ratio"].includes(column.role) && column.nonEmptyCount > 0)
    .forEach((column) => {
      const zeroCount = rows.reduce(
        (count, row) => count + (parseNumericValue(row?.[column.key]) === 0 ? 1 : 0),
        0
      );
      if (zeroCount / column.nonEmptyCount >= 0.3) {
        diagnostics.push({
          id: `zero-values-${column.key}`,
          type: "zero_values",
          severity: "warning",
          description: `${column.key} 中有 ${zeroCount} 条零值，建议确认是否代表缺失或真实业务值。`,
          fields: [column.key],
        });
      }
    });

  if (amountField) {
    const values = rows
      .map((row) => parseNumericValue(row?.[amountField]))
      .filter((value): value is number => value !== null)
      .sort((left, right) => left - right);
    if (values.length >= 4) {
      const q1 = values[Math.floor((values.length - 1) * 0.25)];
      const q3 = values[Math.floor((values.length - 1) * 0.75)];
      const iqr = q3 - q1;
      const lowThreshold = q1 - iqr * 1.5;
      const highThreshold = q3 + iqr * 1.5;
      const highCount = values.filter((value) => value > highThreshold).length;
      const lowCount = values.filter((value) => value < lowThreshold).length;
      if (highCount > 0) {
        diagnostics.push({
          id: "amount-high-outlier",
          type: "amount_outlier",
          severity: "danger",
          description: `${amountField} 检测到 ${highCount} 条异常高值，建议核对大额记录。`,
          fields: [amountField],
        });
      }
      if (lowCount > 0) {
        diagnostics.push({
          id: "amount-low-outlier",
          type: "amount_outlier",
          severity: "warning",
          description: `${amountField} 检测到 ${lowCount} 条异常低值，建议核对负数或极低金额。`,
          fields: [amountField],
        });
      }
    }
  }

  return diagnostics;
}

export function analyzeTableData(headers: string[], rows: any[]): TableAnalysisResult {
  const profile = profileTable(headers, rows);
  const validRows = rows.filter((row) => headers.some((header) => normalizeText(row?.[header]) !== ""));
  const duplicateRecordCount = countDuplicateRows(headers, validRows);
  const amountField = profile.moneyFields[0];
  const metricField = amountField || profile.primaryMetric;
  const amountColumn = amountField
    ? profile.columns.find((column) => column.key === amountField)
    : undefined;

  return {
    fields: profile.columns.map((column) => ({
      name: column.key,
      type: column.role,
      reason: getRecognitionReason(column),
    })),
    metrics: {
      validRecordCount: validRows.length,
      totalFieldCount: headers.length,
      numericFieldCount: profile.numericFields.length,
      textDimensionCount: profile.dimensionFields.length,
      emptyCellRatio: Math.max(0, 1 - profile.fillRate / 100),
      duplicateRecordCount,
      amount: amountColumn
        ? {
            field: amountColumn.key,
            total: amountColumn.sum,
            average: amountColumn.avg,
            max: amountColumn.max,
            min: amountColumn.min,
          }
        : undefined,
    },
    topDimensions: buildTopDimensions(validRows, profile, metricField),
    dateTrend: buildDateTrend(validRows, profile, metricField),
    diagnostics: buildDiagnostics(headers, validRows, profile, duplicateRecordCount, amountField),
  };
}
