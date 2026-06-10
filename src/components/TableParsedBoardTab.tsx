import React, { useState, useEffect, useMemo, useRef } from "react";
import * as Lucide from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import ReactMarkdown from "react-markdown";
import {
  analyzeTableData,
  aggregateByDimension,
  buildRowTimeSeries,
  parseNumericValue,
  profileTable,
  summarizeSheets,
  type ImportedDataType,
  type TableProfile,
} from "../utils/tableAnalysis";
import {
  deleteTableRecord,
  fetchTableRecord,
  fetchTableRecords,
  recordToBoardData,
  uploadTableFile,
  type TableUploadRecordSummary,
  type UploadedTableBoardData,
} from "../utils/tableUploadApi";
import { formatFileSize, TableAnalysisSummary, UploadHistoryPanel } from "./TableUploadPanels";
import {
  buildOperatingSnapshot,
  createClosedLoopTasks,
  diagnoseOperatingSnapshot,
  getNextTaskStatus,
  type ClosedLoopRiskLevel,
  type ClosedLoopTask,
  type ClosedLoopTaskStatus,
} from "../utils/opsClosedLoop";

interface TableParsedBoardTabProps {
  uploadedFileBoardData: UploadedTableBoardData | null;
  onBoardDataChange: (data: UploadedTableBoardData | null) => void;
  onTriggerImport: () => void;
  onLoadTemplate: (type: "platforms" | "supply_chain" | "finance") => void;
  onLoadMappedDataToSandbox: () => void;
}

export default function TableParsedBoardTab({
  uploadedFileBoardData,
  onBoardDataChange,
  onTriggerImport,
  onLoadTemplate,
  onLoadMappedDataToSandbox,
}: TableParsedBoardTabProps) {
  const [searchText, setSearchText] = useState("");
  const [xAxisKey, setXAxisKey] = useState("");
  const [yAxisKey, setYAxisKey] = useState("");
  const [chartType, setChartType] = useState<"bar" | "line" | "pie">("bar");
  const [chartMode, setChartMode] = useState<"single" | "grouped">("single");
  const [groupByKey, setGroupByKey] = useState("");
  
  // Sheet navigation & Dimension derivation states
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [timeDimension, setTimeDimension] = useState<"raw" | "daily" | "weekly" | "monthly">("raw");

  // Dynamic filter threshold indicator
  const [chartThreshold, setChartThreshold] = useState<number>(0);
  const [isThresholdActive, setIsThresholdActive] = useState<boolean>(false);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });

  // AI Audit and custom Analyst Question states
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<string>("");
  const [auditError, setAuditError] = useState<string>("");
  const [customQuestionInput, setCustomQuestionInput] = useState<string>("");
  const [closedLoopTasks, setClosedLoopTasks] = useState<ClosedLoopTask[]>([]);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, string>>({});
  const apiFileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadRecords, setUploadRecords] = useState<TableUploadRecordSummary[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // sheets lists helper
  const sheets = uploadedFileBoardData?.sheets || [];
  const currentSheet = sheets.length > 0 ? sheets[Math.min(activeSheetIdx, sheets.length - 1)] : null;
  const headers = currentSheet ? currentSheet.headers : (uploadedFileBoardData?.headers || []);
  const rows = currentSheet ? currentSheet.rows : (uploadedFileBoardData?.rows || []);
  const activeDailySeries = currentSheet ? currentSheet.dailySeries || [] : [];

  const tableProfile = useMemo(() => {
    try {
      if (headers.length === 0) return profileTable([], []);
      if (rows.length === 0) return profileTable(headers, []);
      if (currentSheet?.profile) return currentSheet.profile;
      return profileTable(headers, rows);
    } catch {
      return profileTable(headers, []);
    }
  }, [headers, rows, currentSheet]);
  const standardizedAnalysis = useMemo(
    () => uploadedFileBoardData?.serverAnalysis || analyzeTableData(headers, rows),
    [uploadedFileBoardData?.serverAnalysis, headers, rows]
  );

  const refreshUploadRecords = async () => {
    setIsHistoryLoading(true);
    try {
      setUploadRecords(await fetchTableRecords());
      setHistoryError("");
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "无法加载历史记录。");
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    void refreshUploadRecords();
  }, []);

  const handleApiFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/\.(xlsx|xls|csv|json)$/i.test(file.name)) {
      setUploadError("不支持的文件格式，仅支持 .xlsx、.xls、.csv、.json。");
      return;
    }

    setIsUploading(true);
    setUploadError("");
    try {
      const record = await uploadTableFile(file);
      onBoardDataChange(recordToBoardData(record));
      await refreshUploadRecords();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "上传失败，请稍后重试。");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRestoreRecord = async (id: string) => {
    setUploadError("");
    try {
      const record = await fetchTableRecord(id);
      onBoardDataChange(recordToBoardData(record));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "历史记录恢复失败。");
    }
  };

  const handleDeleteRecord = async (id: string) => {
    setHistoryError("");
    try {
      await deleteTableRecord(id);
      if (uploadedFileBoardData?.fileId === id) onBoardDataChange(null);
      await refreshUploadRecords();
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "历史记录删除失败。");
    }
  };

  const uploadInput = (
    <input
      ref={apiFileInputRef}
      type="file"
      accept=".xlsx,.xls,.csv,.json"
      onChange={handleApiFileChange}
      className="hidden"
      aria-label="上传 Excel、CSV 或 JSON 文件"
    />
  );
  const sheetSummaries = useMemo(() => {
    try {
      return summarizeSheets(sheets);
    } catch {
      return [];
    }
  }, [sheets]);
  const rowTimeSeries = useMemo(() => {
    try {
      if (!tableProfile) return [];
      return buildRowTimeSeries(rows, tableProfile, yAxisKey || tableProfile.primaryMetric);
    } catch {
      return [];
    }
  }, [rows, tableProfile, yAxisKey]);
  const activeTimeSeries = useMemo(() => {
    try {
      if (activeDailySeries.length > 0) {
        return activeDailySeries.slice(0, 2000).map((item: any) => ({
          name: item.date || item.name || "",
          value: Number(item.sales ?? item.value) || 0,
          date: item.date || item.name || "",
        }));
      }
      return rowTimeSeries || [];
    } catch {
      return [];
    }
  }, [activeDailySeries, rowTimeSeries]);

  useEffect(() => {
    const element = chartContainerRef.current;
    if (!element) return;

    const updateChartSize = () => {
      const rect = element.getBoundingClientRect();
      const width = Math.max(0, Math.floor(rect.width));
      const height = Math.max(0, Math.floor(rect.height));
      setChartSize((current) =>
        current.width === width && current.height === height ? current : { width, height }
      );
    };

    updateChartSize();
    const observer = new ResizeObserver(updateChartSize);
    observer.observe(element);
    window.addEventListener("resize", updateChartSize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateChartSize);
    };
  }, [uploadedFileBoardData, activeSheetIdx]);

  // Memoized Chart Data generation supporting Daily, Weekly, Monthly granularities matching Excel layouts
  const chartData = useMemo(() => {
    if (timeDimension === "daily") {
      const groups: Record<string, { name: string; value: number }> = {};
      activeTimeSeries.forEach(item => {
        const d = item.date || item.name;
        if (!groups[d]) {
          groups[d] = { name: d, value: 0 };
        }
        groups[d].value += item.value;
      });
      return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name, "zh-CN", { numeric: true }));
    }
    
    if (timeDimension === "weekly") {
      const weeks: Record<string, { name: string; value: number }> = {
        "W1": { name: "第一周 (1-7日)", value: 0 },
        "W2": { name: "第二周 (8-14日)", value: 0 },
        "W3": { name: "第三周 (15-21日)", value: 0 },
        "W4": { name: "第四周 (22-28日)", value: 0 },
        "W5": { name: "第五周 (29-31日)", value: 0 },
      };
      
      activeTimeSeries.forEach(item => {
        const m = String(item.date || item.name).match(/(\d+)日/);
        if (m) {
          const d = parseInt(m[1], 10);
          let wk = "W5";
          if (d <= 7) wk = "W1";
          else if (d <= 14) wk = "W2";
          else if (d <= 21) wk = "W3";
          else if (d <= 28) wk = "W4";
          weeks[wk].value += item.value;
        } else {
          weeks["W1"].value += item.value;
        }
      });
      return Object.values(weeks).filter(w => w.value > 0);
    }
    
    if (timeDimension === "monthly") {
      // Dynamic grouping on workbook level sheets!
      return sheets.map(sh => {
        const profile = sh.profile || profileTable(sh.headers || [], sh.rows || []);
        const metric = profile.primaryMetric || yAxisKey;
        const totalSales = sh.dailySeries && sh.dailySeries.length > 0
          ? sh.dailySeries.reduce((sum: number, x: any) => sum + (Number(x.sales) || 0), 0)
          : sh.rows.reduce((sum: number, r: any) => {
              return sum + (metric ? parseNumericValue(r[metric]) || 0 : 0);
            }, 0);
        return {
          name: sh.name.replace("商品实绩", "").replace("数据", ""),
          value: totalSales
        };
      }).filter(m => m.value > 0);
    }

    if (chartMode === "grouped" && groupByKey) {
      return aggregateByDimension(rows, groupByKey, yAxisKey || tableProfile.primaryMetric || "", 30);
    }

    // Default raw selection dimension
    return rows.map((r) => {
      const numVal = parseNumericValue(r[yAxisKey]);
      return {
        name: String(r[xAxisKey] || ""),
        value: numVal ?? 0,
      };
    }).slice(0, 80);
  }, [timeDimension, rows, yAxisKey, xAxisKey, activeTimeSeries, sheets, chartMode, groupByKey, tableProfile]);

  // Reset keys when a new file/sheet is loaded
  useEffect(() => {
    if (uploadedFileBoardData) {
      setAuditResult("");
      setAuditError("");
      setSearchText("");
      setCurrentPage(1);

      setXAxisKey(tableProfile.primaryDimension || headers[0] || "");
      setYAxisKey(tableProfile.primaryMetric || tableProfile.numericFields[0] || headers[1] || headers[0] || "");
      setGroupByKey(tableProfile.dimensionFields[1] || tableProfile.primaryDimension || "");
      
      // Auto-trigger daily dimension if the sheet detected rich granular timeseries values!
      if (activeDailySeries.length > 0 || tableProfile.primaryDate) {
        setTimeDimension("daily");
      } else {
        setTimeDimension("raw");
      }
    }
  }, [uploadedFileBoardData, activeSheetIdx, tableProfile]);

  // Synchronize when the overarching uploadedFileBoardData changes
  useEffect(() => {
    if (uploadedFileBoardData && uploadedFileBoardData.activeSheetIndex !== undefined) {
      setActiveSheetIdx(uploadedFileBoardData.activeSheetIndex);
    }
  }, [uploadedFileBoardData]);

  const { fileName = "", dataType = "platforms", importedAt = "" } = uploadedFileBoardData || {};
  const activeSheetName = currentSheet?.name || "默认工作表";
  const operatingSnapshot = useMemo(() => {
    return buildOperatingSnapshot({
      fileName,
      sheetName: activeSheetName,
      importedAt,
      dataType,
      rows,
      profile: tableProfile,
      preferredMetricKey: yAxisKey || tableProfile.primaryMetric,
    });
  }, [fileName, activeSheetName, importedAt, dataType, rows, tableProfile, yAxisKey]);
  const diagnosticInsights = useMemo(() => {
    return diagnoseOperatingSnapshot(operatingSnapshot);
  }, [operatingSnapshot]);
  const closedLoopStorageKey = operatingSnapshot.importKey
    ? `omiflow-closed-loop:${operatingSnapshot.importKey}`
    : "";

  useEffect(() => {
    if (!uploadedFileBoardData || !closedLoopStorageKey) return;

    try {
      const saved = window.localStorage.getItem(closedLoopStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as ClosedLoopTask[];
        if (Array.isArray(parsed)) {
          setClosedLoopTasks(parsed);
          return;
        }
      }
    } catch {
      // Ignore unreadable local drafts and regenerate from the current snapshot.
    }

    setClosedLoopTasks(createClosedLoopTasks(diagnosticInsights, operatingSnapshot));
    setReviewDrafts({});
  }, [uploadedFileBoardData, closedLoopStorageKey, diagnosticInsights, operatingSnapshot]);

  useEffect(() => {
    if (!uploadedFileBoardData || !closedLoopStorageKey || closedLoopTasks.length === 0) return;

    try {
      window.localStorage.setItem(closedLoopStorageKey, JSON.stringify(closedLoopTasks));
    } catch {
      // Local persistence is best-effort for the MVP; the visible state still works.
    }
  }, [uploadedFileBoardData, closedLoopStorageKey, closedLoopTasks]);

  const closedLoopCounts = useMemo(() => {
    return closedLoopTasks.reduce(
      (counts, task) => {
        counts[task.status] += 1;
        return counts;
      },
      { todo: 0, doing: 0, review: 0, done: 0 } as Record<ClosedLoopTaskStatus, number>
    );
  }, [closedLoopTasks]);
  const closedLoopCompletionRate =
    closedLoopTasks.length > 0 ? Math.round((closedLoopCounts.done / closedLoopTasks.length) * 100) : 0;
  const latestReviewResult =
    closedLoopTasks.find((task) => task.status === "done" && task.reviewNote)?.reviewNote ||
    "暂无复盘结论";

  const handleTaskStatusChange = (taskId: string, nextStatus?: ClosedLoopTaskStatus) => {
    setClosedLoopTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: nextStatus ?? getNextTaskStatus(task.status),
              updatedAt: new Date().toISOString(),
            }
          : task
      )
    );
  };

  const handleTaskReviewComplete = (taskId: string) => {
    const note = reviewDrafts[taskId]?.trim();
    setClosedLoopTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: "done",
              reviewNote: note || task.reviewNote || "已完成处理，后续补充正式复盘记录。",
              reviewResult: `复盘完成于 ${new Date().toLocaleString("zh-CN", { hour12: false })}`,
              updatedAt: new Date().toISOString(),
            }
          : task
      )
    );
  };

  const handleRegenerateClosedLoop = () => {
    setClosedLoopTasks(createClosedLoopTasks(diagnosticInsights, operatingSnapshot));
    setReviewDrafts({});
  };

  // Filter rows based on search text
  const filteredRows = rows.filter((row) => {
    if (!searchText) return true;
    return Object.values(row).some((val) =>
      String(val).toLowerCase().includes(searchText.toLowerCase())
    );
  });

  // Pagination calculation
  const totalPages = Math.ceil(filteredRows.length / itemsPerPage) || 1;
  const paginatedRows = filteredRows.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Dynamic statistics calculations
  const totalRowsCount = rows.length;
  const numericalHeaders = tableProfile.numericFields;

  // Calculate sum of selected Y Axis numerical key
  const sumYAxis = rows.reduce((sum, r) => sum + (parseNumericValue(r[yAxisKey]) || 0), 0);
  const avgYAxis = totalRowsCount > 0 ? (sumYAxis / totalRowsCount) : 0;
  
  // Find highest row for selected Y Axis
  let peakRow: any = null;
  let peakValue = -Infinity;
  rows.forEach((r) => {
    const val = parseNumericValue(r[yAxisKey]) || 0;
    if (val > peakValue) {
      peakValue = val;
      peakRow = r;
    }
  });

  // Find minimum value for selected Y Axis
  const minYAxis = useMemo(() => {
    if (rows.length === 0) return 0;
    let min = Infinity;
    rows.forEach((r) => {
      const val = parseNumericValue(r[yAxisKey]) || 0;
      if (val < min) min = val;
    });
    return min === Infinity ? 0 : min;
  }, [rows, yAxisKey]);

  // Calculate Median Value
  const medianYAxis = useMemo(() => {
    if (rows.length === 0) return 0;
    const sortedVals = rows
      .map((r) => parseNumericValue(r[yAxisKey]) || 0)
      .sort((a, b) => a - b);
    const mid = Math.floor(sortedVals.length / 2);
    if (sortedVals.length % 2 !== 0) {
      return sortedVals[mid];
    }
    return (sortedVals[mid - 1] + sortedVals[mid]) / 2;
  }, [rows, yAxisKey]);

  // Calculate Standard Deviation & Volatility Index
  const stdDevYAxis = useMemo(() => {
    if (totalRowsCount <= 1) return 0;
    const mean = avgYAxis;
    const sumSqDiffs = rows.reduce((sum, r) => {
      const val = parseNumericValue(r[yAxisKey]) || 0;
      return sum + Math.pow(val - mean, 2);
    }, 0);
    return Math.sqrt(sumSqDiffs / totalRowsCount);
  }, [rows, yAxisKey, avgYAxis, totalRowsCount]);

  // Coefficient of Variation (CV) as Volatility Label
  const volatilityLevel = useMemo(() => {
    if (avgYAxis === 0) return { label: "低变异 (平稳)", color: "text-emerald-700 bg-emerald-50 border-emerald-100" };
    const cv = stdDevYAxis / avgYAxis;
    if (cv < 0.2) return { label: "极度平稳 (CV < 20%)", color: "text-emerald-700 bg-emerald-55 border-emerald-100" };
    if (cv < 0.6) return { label: "中低波动 (CV 20%-60%)", color: "text-sky-700 bg-sky-50 border-sky-100" };
    return { label: "剧烈波动 (CV > 60%)", color: "text-amber-700 bg-amber-50 border-amber-100" };
  }, [stdDevYAxis, avgYAxis]);

  // Report Integrity Information
  const reportIntegrity = useMemo(() => {
    if (totalRowsCount === 0) return { score: 100, label: "完美饱满", badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-100" };
    let totalCells = totalRowsCount * headers.length;
    let missingCount = 0;
    rows.forEach(r => {
      headers.forEach(h => {
        const val = r[h];
        if (val === undefined || val === null || val === "") {
          missingCount++;
        }
      });
    });
    const fillRate = totalCells > 0 ? ((totalCells - missingCount) / totalCells) * 100 : 100;
    let label = "健康卓越 (100% 饱满)";
    let badgeColor = "bg-emerald-55 text-emerald-700 border-emerald-150";
    if (fillRate < 98) {
      label = "良好 (有少量空置项)";
      badgeColor = "bg-sky-55 text-sky-700 border-sky-150";
    }
    if (fillRate < 85) {
      label = "中度缺失 (有异常指标卡空)";
      badgeColor = "bg-amber-55 text-amber-700 border-amber-150";
    }
    return {
      fillRate,
      label,
      missingCount,
      badgeColor
    };
  }, [rows, headers, totalRowsCount]);

  // Format Y-axis output helper based on the key name
  const formatValueOutput = (val: number) => {
    const lowerKey = String(yAxisKey).toLowerCase();
    const isMoney = tableProfile.moneyFields.includes(yAxisKey) || lowerKey.includes("sales") || lowerKey.includes("volume") || lowerKey.includes("款") || lowerKey.includes("支") || lowerKey.includes("营业") || lowerKey.includes("流水") || lowerKey.includes("金") || lowerKey.includes("额");
    const isRatio = tableProfile.ratioFields.includes(yAxisKey) || lowerKey.includes("率") || lowerKey.includes("rate") || lowerKey.includes("ratio");
    if (isMoney) {
      return `¥${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    }
    if (isRatio) {
      return `${val.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
    }
    return val.toLocaleString(undefined, { maximumFractionDigits: 1 });
  };

  // Reset threshold and toggle when keys change
  useEffect(() => {
    setChartThreshold(0);
    setIsThresholdActive(false);
  }, [yAxisKey, uploadedFileBoardData, activeSheetIdx]);

  // Filtered chart data according to user selected visual threshold
  const displayedChartData = useMemo(() => {
    if (!isThresholdActive || chartThreshold === 0) return chartData;
    return chartData.filter(d => d.value >= chartThreshold);
  }, [chartData, chartThreshold, isThresholdActive]);

  // Max value in chart data for threshold boundaries
  const maxYAxisValue = useMemo(() => {
    if (chartData.length === 0) return 105;
    let maxValue = 105;
    chartData.forEach((item) => {
      if (item.value > maxValue) maxValue = item.value;
    });
    return maxValue;
  }, [chartData]);

  const taskStatusLabels: Record<ClosedLoopTaskStatus, string> = {
    todo: "待处理",
    doing: "处理中",
    review: "待复盘",
    done: "已复盘",
  };

  const priorityClasses: Record<ClosedLoopRiskLevel, string> = {
    high: "bg-rose-50 text-rose-700 border-rose-100",
    medium: "bg-amber-50 text-amber-700 border-amber-100",
    low: "bg-emerald-50 text-emerald-700 border-emerald-100",
  };

  const priorityLabels: Record<ClosedLoopRiskLevel, string> = {
    high: "高优先级",
    medium: "中优先级",
    low: "低优先级",
  };

  const healthToneClass =
    operatingSnapshot.healthScore >= 85
      ? "text-emerald-700 bg-emerald-50 border-emerald-100"
      : operatingSnapshot.healthScore >= 65
        ? "text-amber-700 bg-amber-50 border-amber-100"
        : "text-rose-700 bg-rose-50 border-rose-100";

  if (!uploadedFileBoardData) {
    return (
      <div className="space-y-6">
        {uploadInput}
        <div className="bg-white p-8 rounded-xl border border-slate-100 shadow-xs text-center max-w-2xl mx-auto my-12 space-y-6">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <Lucide.FileSpreadsheet className="w-8 h-8 stroke-1.5 animate-pulse" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-800">暂未导入本地表格文件</h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              为了提供针对您自己真实数据的深度计算看板，中台能够解析 Excel、CSV、JSON 文件，并通过规则自动识别业务表结构。
            </p>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row justify-center gap-3">
            <button
              type="button"
              onClick={() => apiFileInputRef.current?.click()}
              disabled={isUploading}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Lucide.UploadCloud className="w-4 h-4" />
              {isUploading ? "正在上传解析..." : "立即上传并解析"}
            </button>
            <button
              type="button"
              onClick={onTriggerImport}
              className="px-6 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Lucide.SlidersHorizontal className="w-4 h-4" />
              使用字段映射导入
            </button>
          </div>

          {uploadError ? (
            <div className="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 text-left">
              {uploadError}
            </div>
          ) : null}

          <div className="pt-6 border-t border-slate-100">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-3">无准备好的文件？可点击一键注入标准预制数据体验：</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                onClick={() => onLoadTemplate("platforms")}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 text-slate-600 rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
              >
                📊 模拟：全渠道当日营业数据
              </button>
              <button
                onClick={() => onLoadTemplate("supply_chain")}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 text-slate-600 rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
              >
                📦 模拟：供应链工厂备货工期表
              </button>
              <button
                onClick={() => onLoadTemplate("finance")}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 text-slate-600 rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
              >
                💰 模拟：多渠道大宗损益核收账
              </button>
            </div>
          </div>
        </div>
        <UploadHistoryPanel
          records={uploadRecords}
          loading={isHistoryLoading}
          error={historyError}
          onRestore={(id) => void handleRestoreRecord(id)}
          onDelete={(id) => void handleDeleteRecord(id)}
        />
      </div>
    );
  }

  // Run AI report on sheet
  const handleRunSheetAudit = async (customQ?: string) => {
    setIsAuditing(true);
    if (!customQ) {
      setAuditResult("");
    }
    setAuditError("");
    try {
      const topRows = [...rows]
        .sort((a, b) => (parseNumericValue(b[yAxisKey]) || 0) - (parseNumericValue(a[yAxisKey]) || 0))
        .slice(0, 10);
      const anomalyRows = rows
        .filter((row) => Math.abs((parseNumericValue(row[yAxisKey]) || 0) - avgYAxis) > stdDevYAxis * 1.5)
        .slice(0, 10);
      // Build an optimized overview of the current worksheet and timeseries content
      const summaryPayload = {
        fileName,
        dataType,
        activeSheetName: currentSheet ? currentSheet.name : "默认工作表",
        headers,
        rows: rows.slice(0, 50), // Send first 50 rows (token limits)
        dailySeriesSummarized: activeTimeSeries.slice(0, 120), // Send timeseries
        tableProfile: {
          ...tableProfile,
          columns: tableProfile.columns.map((col) => ({
            key: col.key,
            role: col.role,
            nonEmptyCount: col.nonEmptyCount,
            missingCount: col.missingCount,
            distinctCount: col.distinctCount,
            sum: Number(col.sum.toFixed(2)),
            avg: Number(col.avg.toFixed(2)),
            min: col.min,
            max: col.max,
            sampleValues: col.sampleValues,
          })),
        },
        sheetSummaries,
        selectedVisual: {
          xAxisKey,
          yAxisKey,
          groupByKey,
          chartMode,
          timeDimension,
        },
        derivedMetrics: {
          totalRowsCount,
          sumYAxis,
          avgYAxis,
          minYAxis,
          medianYAxis,
          stdDevYAxis,
          peakValue,
          fillRate: tableProfile.fillRate,
          missingCells: tableProfile.missingCells,
        },
        topRows,
        anomalyRows,
        customQuestion: customQ || undefined
      };

      const response = await fetch("/api/gemini/audit-spreadsheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(summaryPayload),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          if (customQ) {
            setAuditResult(prev => {
              const qHeader = `\n\n---\n### 💬 自定义特定问题解答：\n> **${customQ}**\n\n`;
              return prev ? prev + qHeader + data.result : qHeader + data.result;
            });
          } else {
            setAuditResult(data.result);
          }
        } else {
          setAuditError("分析遇到细微阻滞，请稍候重试。");
        }
      } else {
        setAuditError("请求诊断服务超时，请检查您的网络连接或稍后再试。");
      }
    } catch (e) {
      setAuditError("连接服务器出错，未能完成 AI 数据审计。");
    } finally {
      setIsAuditing(false);
    }
  };

  const COLORS = ["#4f46e5", "#06b6d4", "#f59e0b", "#ec4899", "#10b981", "#8b5cf6", "#ef4444"];
  const targetYKey = timeDimension === "raw" ? "value" : "value";

  return (
    <div className="space-y-6">
      {uploadInput}
      
      {/* 1. File Upload Hero Banner with Excel worksheets switch tabs */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center shadow-2xs">
              <Lucide.FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-800">{fileName}</h2>
                <span className="text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 leading-none">
                  {uploadedFileBoardData.status === "failed" ? "解析失败" : "已解析"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                数据归类: <span className="font-semibold text-slate-600 capitalize">{tableProfile.businessDomainLabel}</span>
                {" "}| 导入自: {importedAt}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                {formatFileSize(uploadedFileBoardData.fileSize)} · {uploadedFileBoardData.rowCount ?? rows.length} 行 × {uploadedFileBoardData.columnCount ?? headers.length} 列 · {uploadedFileBoardData.status === "failed" ? "失败" : "解析完成"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 select-none">
            <button
              onClick={onLoadMappedDataToSandbox}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 hover:shadow-xs cursor-pointer"
            >
              <Lucide.Shuffle className="w-3.5 h-3.5" />
              全量同步至中端沙盘
            </button>
            
            <button
              type="button"
              onClick={() => apiFileInputRef.current?.click()}
              disabled={isUploading}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <Lucide.UploadCloud className="w-3.5 h-3.5 text-slate-400" />
              {isUploading ? "上传中..." : "重新上传表格"}
            </button>
            <button
              type="button"
              onClick={onTriggerImport}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <Lucide.SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              字段映射导入
            </button>
          </div>
        </div>

        {/* WORKBOOK WORKSHEETS TABS (Just like Microsoft Excel Tabs) */}
        {sheets.length > 1 && (
          <div className="bg-slate-50/50 px-4 pt-2.5 flex items-center gap-1.5 border-t border-slate-100 overflow-x-auto select-none no-scrollbar">
            <div className="text-[10px] font-bold text-slate-400 mr-2 uppercase tracking-wider flex items-center gap-1">
              <Lucide.Layers className="w-3 h-3 text-slate-400" />
              工作表 (Sheets):
            </div>
            {sheets.map((sh, sIdx) => {
              const isActive = sIdx === activeSheetIdx;
              return (
                <button
                  key={sh.name || sIdx}
                  onClick={() => {
                    setActiveSheetIdx(sIdx);
                    setCurrentPage(1);
                  }}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-t-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    isActive
                      ? "bg-white text-indigo-600 border-t border-x border-slate-200/80 shadow-2xs"
                      : "text-slate-400 hover:text-slate-600 bg-slate-100/50 hover:bg-slate-100/80"
                  }`}
                >
                  <Lucide.Grid className={`w-3.5 h-3.5 ${isActive ? "text-indigo-500" : "text-slate-400"}`} />
                  {sh.name}
                  {sh.dailySeries && sh.dailySeries.length > 0 && (
                    <span className="text-[8px] bg-indigo-50 text-indigo-600 rounded-full px-1.5 py-0.2 ml-0.5">
                      {sh.dailySeries.length}D
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {uploadError ? (
        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
          {uploadError}
        </div>
      ) : null}

      <TableAnalysisSummary data={uploadedFileBoardData} analysis={standardizedAnalysis} />

      <UploadHistoryPanel
        records={uploadRecords}
        loading={isHistoryLoading}
        error={historyError}
        activeRecordId={uploadedFileBoardData.fileId}
        onRestore={(id) => void handleRestoreRecord(id)}
        onDelete={(id) => void handleDeleteRecord(id)}
      />

      {/* 2. Key Dynamic Aggregate Cards auto-synced with the active Excel Sheet */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total records line */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">有效行记录数</span>
            <Lucide.Database className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-slate-800">{totalRowsCount} <span className="text-xs font-normal text-slate-400">行数据</span></div>
          <p className="text-[10px] text-slate-400">当前工作表 [{currentSheet?.name || "默认"}]指标列共 {headers.length} 维</p>
        </div>

        {/* Aggregate sum */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">累计数据总值</span>
            <Lucide.Sigma className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-slate-800 truncate" title={yAxisKey}>
            {formatValueOutput(sumYAxis)}
          </div>
          <p className="text-[10px] text-slate-400">数值字段 [{yAxisKey}] 的绝对和值</p>
        </div>

        {/* Aggregate average */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">单记录均值</span>
            <Lucide.TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl font-bold text-slate-800 truncate">
            {formatValueOutput(avgYAxis)}
          </div>
          <p className="text-[10px] text-slate-400">数值字段 [{yAxisKey}] 分摊到每行的均值</p>
        </div>

        {/* Peak Record identifier */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">最高峰值项目</span>
            <Lucide.Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-sm font-black text-indigo-600 truncate">
            {peakRow ? String(peakRow[xAxisKey] || "未命名记录") : "无"}
          </div>
          <p className="text-[10px] text-slate-400 font-semibold text-slate-800 mt-1">
            峰值: {peakValue !== -Infinity ? formatValueOutput(peakValue) : 0}
          </p>
        </div>

      </div>

      {/* 2a. Auto Field Profile */}
      <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Lucide.BrainCircuit className="w-4 h-4 text-indigo-500" />
              自动字段画像与业务识别
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              已识别为 <span className="font-bold text-indigo-600">{tableProfile.businessDomainLabel}</span>，用于驱动默认图表、分组维度和 AI 审计上下文。
            </p>
          </div>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${tableProfile.fillRate >= 95 ? "bg-emerald-50 text-emerald-700 border-emerald-100" : tableProfile.fillRate >= 85 ? "bg-sky-50 text-sky-700 border-sky-100" : "bg-amber-50 text-amber-700 border-amber-100"}`}>
            完整度 {tableProfile.fillRate.toFixed(1)}%
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          {[
            { label: "金额字段", fields: tableProfile.moneyFields, color: "emerald" },
            { label: "数值字段", fields: tableProfile.numericFields, color: "indigo" },
            { label: "比例字段", fields: tableProfile.ratioFields, color: "amber" },
            { label: "日期字段", fields: tableProfile.dateFields, color: "sky" },
            { label: "文本维度", fields: tableProfile.dimensionFields, color: "slate" },
          ].map((group) => (
            <div key={group.label} className="bg-slate-50 border border-slate-100 rounded-lg p-3 min-h-[86px]">
              <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">{group.label}</div>
              <div className="flex flex-wrap gap-1">
                {group.fields.slice(0, 5).map((field) => (
                  <span key={field} className="text-[9px] bg-white border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded truncate max-w-[120px]" title={field}>
                    {field}
                  </span>
                ))}
                {group.fields.length === 0 && <span className="text-[9px] text-slate-400">未识别</span>}
              </div>
            </div>
          ))}
        </div>

        {tableProfile.warnings.length > 0 && (
          <div className="bg-amber-50 border border-amber-100 text-amber-700 text-[10px] rounded-lg p-2.5 flex items-start gap-2">
            <Lucide.AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{tableProfile.warnings.join(" ")}</span>
          </div>
        )}
      </div>

      {/* 2b. Operating closed loop MVP */}
      <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-2xs space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Lucide.Workflow className="w-4 h-4 text-indigo-500" />
              上线经营闭环 MVP
            </h3>
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-slate-500">
              {["日报导入", "字段映射", "经营画像", "异常诊断", "人工待办", "复盘结果"].map((step, index) => (
                <React.Fragment key={step}>
                  <span className="px-2 py-1 rounded-full border border-slate-200 bg-slate-50">{step}</span>
                  {index < 5 && <Lucide.ChevronRight className="w-3 h-3 text-slate-300" />}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleRunSheetAudit("请基于当前经营画像输出异常根因、行动建议、责任人和复盘指标。")}
              disabled={isAuditing}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Lucide.Sparkles className="w-3.5 h-3.5" />
              {isAuditing ? "诊断中" : "AI 深度诊断"}
            </button>
            <button
              onClick={handleRegenerateClosedLoop}
              className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Lucide.RefreshCcw className="w-3.5 h-3.5" />
              重建待办
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="text-[10px] font-bold text-slate-400 uppercase">经营健康分</div>
            <div className="mt-2 flex items-end justify-between gap-3">
              <span className="text-2xl font-black text-slate-800">{operatingSnapshot.healthScore}</span>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${healthToneClass}`}>
                完整度 {operatingSnapshot.fillRate.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="text-[10px] font-bold text-slate-400 uppercase">主经营指标</div>
            <div className="mt-2 text-sm font-black text-slate-800 truncate" title={operatingSnapshot.metricKey || "未识别"}>
              {operatingSnapshot.metricKey || "未识别"}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-1">
              {operatingSnapshot.metricTotal.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </div>
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="text-[10px] font-bold text-slate-400 uppercase">异常诊断</div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-2xl font-black text-slate-800">{diagnosticInsights.length}</span>
              <span className="text-[10px] font-semibold text-slate-500">条可处理线索</span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="text-[10px] font-bold text-slate-400 uppercase">任务闭环</div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-2xl font-black text-slate-800">{closedLoopCompletionRate}%</span>
              <span className="text-[10px] font-semibold text-slate-500">
                {closedLoopCounts.done}/{closedLoopTasks.length || 0} 已复盘
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-1 rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Lucide.Activity className="w-3.5 h-3.5 text-indigo-500" />
                经营画像
              </h4>
              <span className="text-[10px] text-slate-400">{operatingSnapshot.rowCount} 行</span>
            </div>
            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between gap-3">
                <span className="text-slate-400">业务类型</span>
                <span className="font-bold text-slate-700 text-right">{operatingSnapshot.businessDomainLabel}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-400">分析维度</span>
                <span className="font-bold text-slate-700 text-right truncate max-w-[180px]" title={operatingSnapshot.dimensionKey}>
                  {operatingSnapshot.dimensionKey || "未识别"}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-400">波动系数</span>
                <span className="font-bold text-slate-700">
                  {operatingSnapshot.volatilityCv === null ? "不足以判断" : `${(operatingSnapshot.volatilityCv * 100).toFixed(0)}%`}
                </span>
              </div>
            </div>
            <div className="border-t border-slate-200 pt-3 space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Top 维度贡献</div>
              {operatingSnapshot.topDimensions.length > 0 ? (
                operatingSnapshot.topDimensions.slice(0, 3).map((item) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex justify-between gap-3 text-[11px]">
                      <span className="text-slate-600 truncate" title={item.name}>{item.name}</span>
                      <span className="font-bold text-slate-700">{(item.share * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 bg-white rounded-full overflow-hidden border border-slate-100">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(item.share * 100, 100)}%` }} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-[11px] text-slate-400">暂无可聚合维度</div>
              )}
            </div>
            <div className="border-t border-slate-200 pt-3">
              <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">最新复盘</div>
              <p className="text-[11px] text-slate-600 leading-relaxed">{latestReviewResult}</p>
            </div>
          </div>

          <div className="xl:col-span-2 rounded-lg border border-slate-100 bg-white p-3 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Lucide.ListChecks className="w-3.5 h-3.5 text-indigo-500" />
                异常诊断与人工待办
              </h4>
              <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                <span className="px-2 py-1 rounded-full bg-slate-50 text-slate-500 border border-slate-100">待处理 {closedLoopCounts.todo}</span>
                <span className="px-2 py-1 rounded-full bg-sky-50 text-sky-600 border border-sky-100">处理中 {closedLoopCounts.doing}</span>
                <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100">待复盘 {closedLoopCounts.review}</span>
                <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">已复盘 {closedLoopCounts.done}</span>
              </div>
            </div>

            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {closedLoopTasks.map((task) => (
                <div key={task.id} className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${priorityClasses[task.priority]}`}>
                          {priorityLabels[task.priority]}
                        </span>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border border-slate-200 bg-white text-slate-500">
                          {taskStatusLabels[task.status]}
                        </span>
                        <span className="text-[9px] font-semibold text-slate-400">责任人：{task.owner}</span>
                      </div>
                      <h5 className="text-sm font-bold text-slate-800 mt-1">{task.title}</h5>
                      <p className="text-[11px] text-slate-500 leading-relaxed mt-1">{task.evidence}</p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <select
                        value={task.status}
                        onChange={(event) => handleTaskStatusChange(task.id, event.target.value as ClosedLoopTaskStatus)}
                        className="text-[10px] font-bold border border-slate-200 rounded-lg bg-white px-2 py-1.5 text-slate-600 outline-none focus:ring-2 focus:ring-indigo-100"
                      >
                        {Object.entries(taskStatusLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleTaskStatusChange(task.id)}
                        disabled={task.status === "done"}
                        className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-indigo-50 disabled:bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-600 disabled:text-slate-400 transition-all cursor-pointer"
                      >
                        推进
                      </button>
                    </div>
                  </div>

                  <div className="rounded-lg bg-white border border-slate-100 p-2.5">
                    <div className="text-[10px] font-bold text-slate-400 mb-1">建议动作</div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{task.action}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-start">
                    <textarea
                      value={reviewDrafts[task.id] ?? task.reviewNote ?? ""}
                      onChange={(event) =>
                        setReviewDrafts((current) => ({ ...current, [task.id]: event.target.value }))
                      }
                      placeholder="填写处理结果、复盘结论或下次跟进点"
                      className="min-h-[70px] resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                    <button
                      onClick={() => handleTaskReviewComplete(task.id)}
                      className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Lucide.CheckCircle2 className="w-3.5 h-3.5" />
                      完成复盘
                    </button>
                  </div>

                  {task.status === "done" && (
                    <div className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-2">
                      {task.reviewResult || "已完成复盘"}：{task.reviewNote || "暂无文字结论"}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2b. Advanced Data Quality & Statistical Characterization */}
      <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 w-full">
          {/* Median Value */}
          <div className="space-y-1 bg-white p-3 rounded-lg border border-slate-200/60 shadow-3xs">
            <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">指标中位数 (Median)</span>
            <div className="text-sm font-semibold text-slate-700">{formatValueOutput(medianYAxis)}</div>
            <p className="text-[9px] text-slate-400">中点分位数，消除极端峰值波动噪声</p>
          </div>

          {/* S.D. Fluctuation */}
          <div className="space-y-1 bg-white p-3 rounded-lg border border-slate-200/60 shadow-3xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">标准差 (Std Dev)</span>
              <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded-full border ${volatilityLevel.color}`}>
                {volatilityLevel.label}
              </span>
            </div>
            <div className="text-sm font-semibold text-slate-700">
              {stdDevYAxis.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </div>
            <p className="text-[9px] text-slate-400">平均波动偏差: 离散度与偏离幅度指标</p>
          </div>

          {/* Record Min value */}
          <div className="space-y-1 bg-white p-3 rounded-lg border border-slate-200/60 shadow-3xs">
            <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">样本极小值 (Min Value)</span>
            <div className="text-sm font-semibold text-slate-700">{formatValueOutput(minYAxis)}</div>
            <p className="text-[9px] text-slate-400">当前工作表中绝对底部/最小记录值</p>
          </div>

          {/* Fill-rate completeness */}
          <div className="space-y-1 bg-white p-3 rounded-lg border border-slate-200/60 shadow-3xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">表格完整度 / 空白值</span>
              <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded-full border ${reportIntegrity.badgeColor}`}>
                {reportIntegrity.fillRate.toFixed(1)}% Fill
              </span>
            </div>
            <div className="text-sm font-semibold text-slate-700">
              {reportIntegrity.missingCount > 0 ? `含有 ${reportIntegrity.missingCount} 处空值` : "100% 数据充实性"}
            </div>
            <p className="text-[9px] text-slate-400">{reportIntegrity.label}</p>
          </div>
        </div>
      </div>

      {/* 3. BI Visual Grid & AI Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Visual Chart Panel */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-gray-100 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Lucide.BarChart3 className="w-4 h-4 text-indigo-500" />
                表格数据流多时序对比看板 (Spreadsheet Visualizer)
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">智能适配并多时段衍生走势图表</p>
            </div>

            {/* Dynamic time segment dimension switch */}
            <div className="flex items-center gap-1.5 select-none">
              <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => setTimeDimension("raw")}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${timeDimension === "raw" ? "bg-white text-indigo-600 shadow-2xs" : "text-slate-500 hover:text-slate-800"}`}
                >
                  <Lucide.TableProperties className="w-3 h-3" />
                  独立大盘
                </button>
                {activeTimeSeries.length > 0 && (
                  <>
                    <button
                      onClick={() => setTimeDimension("daily")}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${timeDimension === "daily" ? "bg-white text-indigo-600 shadow-2xs" : "text-slate-500 hover:text-slate-800"}`}
                    >
                      <Lucide.CalendarDays className="w-3 h-3" />
                      全天/日度
                    </button>
                    <button
                      onClick={() => setTimeDimension("weekly")}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${timeDimension === "weekly" ? "bg-white text-indigo-600 shadow-2xs" : "text-slate-500 hover:text-slate-800"}`}
                    >
                      <Lucide.Layers className="w-3 h-3" />
                      全周/周聚
                    </button>
                    {sheets.length > 1 && (
                      <button
                        onClick={() => setTimeDimension("monthly")}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${timeDimension === "monthly" ? "bg-white text-indigo-600 shadow-2xs" : "text-slate-500 hover:text-slate-800"}`}
                      >
                        <Lucide.Compass className="w-3 h-3" />
                        全月大盘
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Chart forms indicator */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => setChartType("bar")}
                  className={`p-1 rounded-md transition-all cursor-pointer ${chartType === "bar" ? "bg-white shadow-2xs text-indigo-600" : "text-slate-500"}`}
                  title="柱状图"
                >
                  <Lucide.BarChart3 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setChartType("line")}
                  className={`p-1 rounded-md transition-all cursor-pointer ${chartType === "line" ? "bg-white shadow-2xs text-indigo-600" : "text-slate-500"}`}
                  title="折线图"
                >
                  <Lucide.TrendingUp className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setChartType("pie")}
                  className={`p-1 rounded-md transition-all cursor-pointer ${chartType === "pie" ? "bg-white shadow-2xs text-indigo-600" : "text-slate-500"}`}
                  title="饼图"
                >
                  <Lucide.PieChart className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Selector Columns Options ONLY when raw dimension is active */}
          {timeDimension === "raw" ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg">
              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">X轴对比轴向 (文本维度)</label>
                <select
                  value={xAxisKey}
                  onChange={(e) => setXAxisKey(e.target.value)}
                  className="text-xs bg-white border border-slate-200 rounded px-2 py-1.5 w-full focus:outline-none"
                >
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Y轴统计极项 (数值比重)</label>
                <select
                  value={yAxisKey}
                  onChange={(e) => setYAxisKey(e.target.value)}
                  className="text-xs bg-white border border-slate-200 rounded px-2 py-1.5 w-full focus:outline-none"
                >
                  {numericalHeaders.length > 0 ? (
                    numericalHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))
                  ) : (
                    headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">分组汇总维度</label>
                <div className="flex gap-1">
                  <button
                    onClick={() => setChartMode(chartMode === "grouped" ? "single" : "grouped")}
                    className={`px-2 py-1.5 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                      chartMode === "grouped"
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-slate-500 border-slate-200 hover:text-slate-800"
                    }`}
                  >
                    汇总
                  </button>
                  <select
                    value={groupByKey}
                    onChange={(e) => setGroupByKey(e.target.value)}
                    className="text-xs bg-white border border-slate-200 rounded px-2 py-1.5 w-full focus:outline-none"
                  >
                    {tableProfile.dimensionFields.length > 0 ? (
                      tableProfile.dimensionFields.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))
                    ) : (
                      headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))
                    )}
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-indigo-50/50 rounded-lg text-[11px] text-indigo-950 font-bold flex items-center justify-between gap-2 border border-indigo-150">
              <span className="flex items-center gap-1 text-indigo-700">
                <Lucide.CalendarCheck className="w-3.5 h-3.5" />
                模型已提取多细分日期时点，走势由数据列下行汇总累计得出：
              </span>
              <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-mono">
                {timeDimension === "daily" ? "全天 30D 走势" : timeDimension === "weekly" ? "全周 W1-W5 走势" : "全月/全年聚合"}
              </span>
            </div>
          )}

          {/* Dynamic Value Filter Slider */}
          <div className="p-3 bg-slate-50 border border-slate-100/70 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="thresholdToggle"
                checked={isThresholdActive}
                onChange={(e) => setIsThresholdActive(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
              />
              <label htmlFor="thresholdToggle" className="text-[10px] sm:text-xs font-bold text-slate-700 flex items-center gap-1 cursor-pointer">
                <Lucide.SlidersHorizontal className="w-3.5 h-3.5 text-indigo-500" />
                指标数值大单/高流阈值过滤
              </label>
            </div>

            {isThresholdActive ? (
              <div className="flex-1 flex items-center gap-2.5 max-w-sm justify-end w-full">
                <input
                  type="range"
                  min={0}
                  max={maxYAxisValue}
                  value={chartThreshold}
                  onChange={(e) => setChartThreshold(Number(e.target.value))}
                  className="flex-1 h-1 bg-indigo-100 rounded-lg appearance-none cursor-pointer accent-indigo-600 w-24 sm:w-auto"
                />
                <span className="text-[9px] font-mono bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded shrink-0">
                  ≥ {formatValueOutput(chartThreshold)}
                </span>
                <span className="text-[9px] text-slate-400 shrink-0">
                  (余 {displayedChartData.length}/{chartData.length} 项)
                </span>
              </div>
            ) : (
              <p className="text-[9px] text-slate-400">
                勾选进行拖拽滑动，过滤排查突出的异常极值或大额订单
              </p>
            )}
          </div>

          {/* Chart Area */}
          <div ref={chartContainerRef} className="h-64 pt-2 notranslate" translate="no" data-no-translate="true">
            {displayedChartData.length > 0 && chartSize.width > 0 && chartSize.height > 0 ? (
              <>
                {chartType === "bar" ? (
                  <BarChart width={chartSize.width} height={chartSize.height} data={displayedChartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} />
                    <YAxis tick={{ fontSize: 9, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} width={45} />
                    <Tooltip
                       contentStyle={{ background: "#0f172a", border: "none", borderRadius: "8px", color: "#f8fafc" }}
                       labelStyle={{ fontWeight: "bold", fontSize: 11 }}
                       itemStyle={{ color: "#a5b4fc", fontSize: 11 }}
                       formatter={(value: any) => [
                        formatValueOutput(Number(value)),
                        timeDimension === "raw" ? yAxisKey : yAxisKey || tableProfile.primaryMetric || "趋势指标"
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: 10, paddingTop: 6 }} />
                    <Bar dataKey={targetYKey} name={timeDimension === "raw" ? yAxisKey : yAxisKey || "趋势指标"} fill="#4f46e5" radius={[4, 4, 0, 0]}>
                      {displayedChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : chartType === "line" ? (
                  <LineChart width={chartSize.width} height={chartSize.height} data={displayedChartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} />
                    <YAxis tick={{ fontSize: 9, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} width={45} />
                    <Tooltip
                       contentStyle={{ background: "#0f172a", border: "none", borderRadius: "8px", color: "#f8fafc" }}
                       labelStyle={{ fontWeight: "bold", fontSize: 11 }}
                       itemStyle={{ color: "#a5b4fc", fontSize: 11 }}
                       formatter={(value: any) => [
                        formatValueOutput(Number(value)),
                        timeDimension === "raw" ? yAxisKey : yAxisKey || tableProfile.primaryMetric || "趋势指标"
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: 10, paddingTop: 6 }} />
                    <Line type="monotone" dataKey={targetYKey} name={timeDimension === "raw" ? yAxisKey : yAxisKey || "趋势指标"} stroke="#4f46e5" strokeWidth={2.5} activeDot={{ r: 6 }} />
                  </LineChart>
                ) : (
                  <PieChart width={chartSize.width} height={chartSize.height}>
                    <Pie
                      data={displayedChartData.slice(0, 8)}
                      cx="55%"
                      cy="45%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey={targetYKey}
                    >
                      {displayedChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#0f172a", border: "none", borderRadius: "8px", color: "#f8fafc" }}
                      itemStyle={{ color: "#a5b4fc", fontSize: 11 }}
                      formatter={(value: any) => [
                        formatValueOutput(Number(value)),
                        timeDimension === "raw" ? yAxisKey : yAxisKey || "贡献重占比"
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: 9, marginTop: -10 }} />
                  </PieChart>
                )}
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                当前过滤条件下，无达到阈值标准的项目。请拉低过滤水位。
              </div>
            )}
          </div>
        </div>

        {/* AI Spreadsheet Audit Container */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-2xs flex flex-col justify-between space-y-4">
          <div className="space-y-3.5">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Lucide.Sparkles className="w-4 h-4 text-purple-600 animate-pulse" />
                DeepSeek 报表精算决策智脑 (Interactive AI Copilot)
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                深度穿透当前工作表，支持单工作表极速红线诊断以及多维度自由对话咨询。
              </p>
            </div>

            {/* Render results as styled Markdown */}
            {auditResult ? (
              <div className="space-y-3">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">诊断交互记录 (Audit Logs):</p>
                <div className="space-y-3 max-h-[300px] overflow-y-auto select-text bg-slate-50 p-3.5 border border-slate-100 rounded-lg text-xs leading-relaxed text-slate-700">
                  <div className="prose prose-slate prose-xs">
                    <ReactMarkdown>{auditResult}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ) : !isAuditing && (
              <div className="bg-gradient-to-br from-indigo-50/50 to-purple-50/50 p-4 border border-indigo-100/50 rounded-lg text-center space-y-3">
                <Lucide.ShieldAlert className="w-8 h-8 mx-auto text-indigo-600 stroke-1" />
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-indigo-950">唤醒全篇红线诊断</p>
                  <p className="text-[10px] text-slate-500 max-w-[200px] mx-auto">
                    自动分析完整记录流，精确捕捉指标漏洞、断货红线与边际利润失重问题。
                  </p>
                </div>
                <button
                  onClick={() => handleRunSheetAudit()}
                  className="w-full py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg text-[10px] font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1"
                >
                  <Lucide.Fingerprint className="w-3.5 h-3.5" />
                  生成全盘诊断报告
                </button>
              </div>
            )}

            {/* Predefined Quick Questions Triggers */}
            {!isAuditing && (
              <div className="space-y-1.5 border-t border-slate-100 pt-3">
                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                  <Lucide.HelpCircle className="w-3 h-3 text-indigo-500" />
                  精算预设重点排查:
                </span>
                <div className="flex flex-col gap-1.5">
                  {(dataType === "platforms"
                    ? [
                        "这几个主要渠道，哪里存在毛利血崩或扣率高危风险？",
                        "如果要进行大促备货，最需要向哪几个核心渠道倾斜库存？",
                      ]
                    : dataType === "supply_chain"
                    ? [
                        "哪些SKU周转天数DOH偏短，有严重的超卖与降权罚款危机？",
                        "面对紧急促销，如何制定各备货仓起运量和最快调运路线？",
                      ]
                    : dataType === "finance"
                    ? [
                        "分析全渠道投流开销比，哪些推广费用已经极度侵蚀名义毛利？",
                        "哪个渠道客退扣费最触动红线，如何通过降耗手段扭亏为盈？",
                      ]
                    : [
                        `基于这张${tableProfile.businessDomainLabel}，先判断最核心的业务风险和机会在哪里？`,
                        "自动指出表内的偏离极值、空值、异常分组和最值得关注的Top项目。",
                        "按部门/渠道/负责人/状态等维度，给出下一步应该优先处理的行动清单。",
                      ]
                  ).map((qText, index) => (
                    <button
                      key={index}
                      onClick={() => handleRunSheetAudit(qText)}
                      className="text-left text-[10px] text-slate-600 hover:text-indigo-600 hover:bg-slate-50 border border-slate-200/80 hover:border-indigo-150 px-2.5 py-1.5 rounded transition-all cursor-pointer flex items-center justify-between gap-2"
                    >
                      <span className="truncate">{qText}</span>
                      <Lucide.ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Glowing Loading Spinner */}
            {isAuditing && (
              <div className="py-12 text-center flex flex-col items-center justify-center space-y-3">
                <Lucide.Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-700">AI 正在穿透解析数据并核算...</p>
                  <p className="text-[9px] text-slate-400">正在对比 Sheet 【{currentSheet?.name || "默认"}】 的交易级细节指标</p>
                </div>
              </div>
            )}

            {/* Error messaging */}
            {auditError && (
              <div className="bg-red-50 border border-red-100 p-2.5 rounded-lg text-[10px] text-red-600 flex gap-2">
                <Lucide.AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" />
                <span>{auditError}</span>
              </div>
            )}
          </div>

          {/* Interactive Chat Input Area */}
          {!isAuditing && (
            <div className="border-t border-slate-100 pt-3.5 space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="✍️ 向 AI 提问当前 Excel 中特定的指标或行..."
                  value={customQuestionInput}
                  onChange={(e) => setCustomQuestionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customQuestionInput.trim()) {
                      handleRunSheetAudit(customQuestionInput.trim());
                      setCustomQuestionInput("");
                    }
                  }}
                  className="flex-1 text-[11px] bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-1.5 focus:outline-none transition-all placeholder:text-slate-400"
                />
                <button
                  onClick={() => {
                    if (customQuestionInput.trim()) {
                      handleRunSheetAudit(customQuestionInput.trim());
                      setCustomQuestionInput("");
                    }
                  }}
                  disabled={!customQuestionInput.trim()}
                  className="px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold transition-all disabled:opacity-40 flex items-center justify-center cursor-pointer shrink-0"
                >
                  发送提问
                </button>
              </div>

              {auditResult && (
                <button
                  onClick={() => {
                    setAuditResult("");
                    setAuditError("");
                  }}
                  className="w-full py-1 text-center text-[9px] font-semibold text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                >
                  清空所有会话并重新审计
                </button>
              )}
            </div>
          )}
        </div>

      </div>

      {/* 4. Tab List view */}
      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-2xs space-y-4">
        
        {/* Table Title and searches */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Lucide.TableProperties className="w-4 h-4 text-indigo-500" />
              当前工作表行数据展现 (Active Sheet Records Array)
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">可以直接查看当前工作表 【{currentSheet?.name || "默认"}】 的全量明细数据</p>
          </div>

          <div className="relative">
            <Lucide.Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="搜索当前工作表关键词..."
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs pl-8 pr-4 py-1.5 w-60 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-300 bg-slate-50/50 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* The data table */}
        <div className="border border-slate-150 rounded-lg overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-150 select-none">
                <th className="py-2.5 px-3 w-12 text-center text-[10px] uppercase">序号</th>
                {headers.map((header) => (
                  <th key={header} className="py-2.5 px-3 min-w-[120px] text-[10px] uppercase tracking-wider font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedRows.length > 0 ? (
                paginatedRows.map((row, idx) => {
                  const absoluteIndex = (currentPage - 1) * itemsPerPage + idx + 1;
                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[10px]">{absoluteIndex}</td>
                      {headers.map((header) => {
                        const cellVal = row[header];
                        const parsedNum = parseNumericValue(cellVal);
                        const isNum = parsedNum !== null && cellVal !== "" && cellVal !== null;
                        return (
                          <td key={header} className={`py-2 px-3 text-slate-700 font-normal ${isNum ? "font-mono text-slate-800" : ""}`}>
                            {parsedNum !== null ? parsedNum.toLocaleString() : String(cellVal ?? "-")}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={headers.length + 1} className="py-12 bg-white text-center text-slate-400 text-xs">
                    <Lucide.Layers className="w-8 h-8 text-slate-300 mx-auto mb-1 stroke-1" />
                    当前工作表中未查询到符合您筛选条件的记录数值
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500 select-none">
            <p>
              正在显示第 <span className="font-bold text-slate-700">{(currentPage - 1) * itemsPerPage + 1}</span> 至{" "}
              <span className="font-bold text-slate-700">
                {Math.min(currentPage * itemsPerPage, filteredRows.length)}
              </span>{" "}
              条记录 (工作表共{" "}
              <span className="font-bold text-slate-700">{filteredRows.length}</span> 条)
            </p>

            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((c) => Math.max(1, c - 1))}
                className="p-1 px-2.5 rounded border border-slate-200 enabled:hover:bg-slate-50 bg-white disabled:opacity-40 transition-all cursor-pointer"
              >
                上一页
              </button>
              
              <div className="flex items-center gap-1 px-1 text-[11px] font-semibold text-slate-700">
                <span>{currentPage}</span> / <span>{totalPages}</span>
              </div>

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((c) => Math.min(totalPages, c + 1))}
                className="p-1 px-2.5 rounded border border-slate-200 enabled:hover:bg-slate-50 bg-white disabled:opacity-40 transition-all cursor-pointer"
              >
                下一页
              </button>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
