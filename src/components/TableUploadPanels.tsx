import * as Lucide from "lucide-react";
import type { TableAnalysisResult } from "../utils/tableAnalysis";
import type { TableUploadRecordSummary, UploadedTableBoardData } from "../utils/tableUploadApi";

function formatFileSize(bytes: number | undefined) {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatNumber(value: number) {
  return value.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

export function UploadHistoryPanel({
  records,
  loading,
  error,
  activeRecordId,
  onRestore,
  onDelete,
}: {
  records: TableUploadRecordSummary[];
  loading: boolean;
  error: string;
  activeRecordId?: string;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Lucide.History className="w-4 h-4 text-indigo-500" />
            历史上传记录
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5">记录保存在本地 data/upload-records.json</p>
        </div>
        <span className="text-[10px] text-slate-500 font-semibold">{records.length} 条</span>
      </div>

      {error ? (
        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
          历史记录加载失败：{error}
        </div>
      ) : null}

      {loading ? (
        <div className="text-xs text-slate-400 py-4 text-center">正在加载历史记录...</div>
      ) : records.length === 0 ? (
        <div className="text-xs text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded-lg">
          暂无历史记录，上传成功后会自动保留。
        </div>
      ) : (
        <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
          {records.map((record) => (
            <div key={record.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60">
              <button type="button" onClick={() => onRestore(record.id)} className="min-w-0 text-left cursor-pointer">
                <strong className="block text-xs text-slate-800 truncate">{record.fileName}</strong>
                <span className="block text-[10px] text-slate-400 mt-1">
                  {new Date(record.uploadedAt).toLocaleString("zh-CN", { hour12: false })} · {record.rowCount} × {record.columnCount} · {formatFileSize(record.fileSize)}
                </span>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${record.status === "parsed" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                  {record.status === "parsed" ? "已解析" : "失败"}
                </span>
                {activeRecordId === record.id ? <span className="text-[10px] text-indigo-600 font-bold">当前</span> : null}
                <button
                  type="button"
                  onClick={() => onDelete(record.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer"
                  title="删除记录"
                  aria-label={`删除 ${record.fileName}`}
                >
                  <Lucide.Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function TableAnalysisSummary({
  data,
  analysis,
}: {
  data: UploadedTableBoardData;
  analysis: TableAnalysisResult;
}) {
  const metrics = analysis.metrics;
  const metricCards = [
    ["有效记录数", metrics.validRecordCount],
    ["总字段数", metrics.totalFieldCount],
    ["数值字段数", metrics.numericFieldCount],
    ["文本维度数", metrics.textDimensionCount],
    ["空值比例", `${(metrics.emptyCellRatio * 100).toFixed(1)}%`],
    ["重复记录数", metrics.duplicateRecordCount],
  ];

  return (
    <section className="space-y-4" aria-label="规则分析结果">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {metricCards.map(([label, value]) => (
          <div key={String(label)} className="bg-white p-4 rounded-lg border border-slate-100 shadow-xs">
            <span className="text-[10px] text-slate-400 font-bold">{label}</span>
            <strong className="block text-xl text-slate-800 mt-1">{value}</strong>
          </div>
        ))}
      </div>

      {metrics.amount ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ["累计金额", metrics.amount.total],
            ["平均金额", metrics.amount.average],
            ["最大值", metrics.amount.max],
            ["最小值", metrics.amount.min],
          ].map(([label, value]) => (
            <div key={String(label)} className="bg-white p-4 rounded-lg border border-emerald-100 shadow-xs">
              <span className="text-[10px] text-emerald-700 font-bold">{label} · {metrics.amount?.field}</span>
              <strong className="block text-lg text-slate-800 mt-1">¥{formatNumber(Number(value))}</strong>
            </div>
          ))}
        </div>
      ) : null}

      <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs space-y-3">
        <h3 className="text-sm font-bold text-slate-800">字段识别结果</h3>
        <div className="overflow-x-auto border border-slate-100 rounded-lg">
          <table className="w-full text-left text-xs min-w-[680px]">
            <thead className="bg-slate-50 text-slate-500">
              <tr><th className="px-3 py-2">字段名称</th><th className="px-3 py-2">类型</th><th className="px-3 py-2">识别依据</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {analysis.fields.map((field) => (
                <tr key={field.name}><td className="px-3 py-2 font-semibold text-slate-700">{field.name}</td><td className="px-3 py-2 text-indigo-600">{field.type}</td><td className="px-3 py-2 text-slate-500">{field.reason}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {analysis.topDimensions.length > 0 ? (
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-800">Top 5 维度贡献</h3>
          <div className="overflow-x-auto border border-slate-100 rounded-lg max-h-80">
            <table className="w-full text-left text-xs min-w-[620px]">
              <thead className="bg-slate-50 text-slate-500 sticky top-0"><tr><th className="px-3 py-2">维度名</th><th className="px-3 py-2">维度值</th><th className="px-3 py-2">金额/指标</th><th className="px-3 py-2">记录数</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {analysis.topDimensions.map((item, index) => (
                  <tr key={`${item.dimension}-${item.value}-${index}`}><td className="px-3 py-2 text-slate-500">{item.dimension}</td><td className="px-3 py-2 font-semibold text-slate-700">{item.value}</td><td className="px-3 py-2 font-mono">{formatNumber(item.amount)}</td><td className="px-3 py-2">{item.recordCount}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {analysis.dateTrend.length > 0 ? (
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-800">日期趋势汇总</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
            {analysis.dateTrend.map((item) => (
              <div key={item.date} className="p-3 rounded-lg bg-slate-50 border border-slate-100"><strong className="text-xs text-slate-700">{item.date}</strong><span className="block text-[10px] text-slate-500 mt-1">{formatNumber(item.amount)} · {item.recordCount} 条</span></div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs space-y-3">
        <h3 className="text-sm font-bold text-slate-800">异常诊断</h3>
        <div className="space-y-2">
          {analysis.diagnostics.map((diagnostic) => (
            <div key={diagnostic.id} className={`p-3 rounded-lg border text-xs ${diagnostic.severity === "danger" ? "bg-rose-50 border-rose-100 text-rose-800" : diagnostic.severity === "warning" ? "bg-amber-50 border-amber-100 text-amber-800" : "bg-sky-50 border-sky-100 text-sky-800"}`}>
              <div className="flex items-center justify-between gap-3"><strong>{diagnostic.type}</strong><span className="uppercase text-[9px] font-bold">{diagnostic.severity}</span></div>
              <p className="mt-1 leading-relaxed">{diagnostic.description}</p>
              {diagnostic.fields.length > 0 ? <span className="block mt-1 text-[10px] opacity-75">涉及字段：{diagnostic.fields.join("、")}</span> : null}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs space-y-3">
        <div><h3 className="text-sm font-bold text-slate-800">数据预览</h3><p className="text-[10px] text-slate-400 mt-0.5">默认展示前 {Math.min(data.rows.length, 50)} 行</p></div>
        <div className="overflow-auto max-h-[420px] border border-slate-100 rounded-lg">
          <table className="w-full text-left text-xs min-w-[760px]">
            <thead className="bg-slate-50 text-slate-500 sticky top-0"><tr>{data.headers.map((header) => <th key={header} className="px-3 py-2 whitespace-nowrap">{header}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">{data.rows.slice(0, 50).map((row, index) => <tr key={index}>{data.headers.map((header) => <td key={header} className="px-3 py-2 whitespace-nowrap text-slate-600">{String(row?.[header] ?? "-")}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export { formatFileSize };
