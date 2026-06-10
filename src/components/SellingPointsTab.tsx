import { useEffect, useRef, useState, type ReactNode } from "react";
import * as Lucide from "lucide-react";
import {
  deleteSellingPointRecord,
  fetchSellingPointRecord,
  fetchSellingPointRecords,
  generateSellingPointContent,
  uploadSellingPointFile,
  type SellingPointRecord,
  type SellingPointRecordSummary,
  type SellingPointTaskType,
} from "../utils/sellingPointsApi";

const TASK_OPTIONS: { value: SellingPointTaskType; label: string }[] = [
  { value: "tmall_main_image", label: "天猫主图" },
  { value: "detail_page_outline", label: "详情页大纲" },
  { value: "xiaohongshu_note", label: "小红书笔记" },
  { value: "douyin_15s_script", label: "抖音 15s 脚本" },
  { value: "customer_service_faq", label: "客服 FAQ" },
];

const EMPTY_TEXT = "未提供";

function hasContent(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

function formatValue(value: unknown): string {
  if (!hasContent(value)) return EMPTY_TEXT;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(formatValue).join("\n");
  return Object.entries(value as Record<string, unknown>)
    .map(([key, child]) => `${key}：${formatValue(child)}`)
    .join("\n");
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function Section({ title, icon, children, action }: { title: string; icon: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-lg">
      <div className="min-h-11 px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function ValuePanel({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-w-0 p-3 border border-slate-100 rounded-md bg-slate-50/70">
      <span className="block text-[10px] font-bold text-slate-400 mb-1">{label}</span>
      <p className={`text-xs leading-5 whitespace-pre-wrap break-words ${hasContent(value) ? "text-slate-700" : "text-slate-400"}`}>
        {formatValue(value)}
      </p>
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="py-5 text-xs text-slate-400 text-center border border-dashed border-slate-200 rounded-md">{children}</div>;
}

export default function SellingPointsTab() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [records, setRecords] = useState<SellingPointRecordSummary[]>([]);
  const [record, setRecord] = useState<SellingPointRecord | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [taskType, setTaskType] = useState<SellingPointTaskType>("tmall_main_image");
  const [userInstruction, setUserInstruction] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [copyLabel, setCopyLabel] = useState("复制结果");

  async function refreshRecords() {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      setRecords(await fetchSellingPointRecords());
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "历史记录加载失败。 ");
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    void refreshRecords();
  }, []);

  async function handleFileChange(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setPageError("");
    setGenerationResult("");
    setGenerationError("");
    try {
      const uploaded = await uploadSellingPointFile(file);
      setRecord(uploaded);
      await refreshRecords();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "商品卖点 JSON 上传失败。 ");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRestore(id: string) {
    setPageError("");
    setGenerationResult("");
    setGenerationError("");
    try {
      setRecord(await fetchSellingPointRecord(id));
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "记录恢复失败。 ");
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("确认删除这条商品卖点记录？原始上传文件会保留。")) return;
    setHistoryError("");
    try {
      await deleteSellingPointRecord(id);
      if (record?.id === id) {
        setRecord(null);
        setGenerationResult("");
      }
      await refreshRecords();
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "记录删除失败。 ");
    }
  }

  async function handleGenerate() {
    if (!record) return;
    setGenerating(true);
    setGenerationError("");
    setGenerationResult("");
    try {
      const response = await generateSellingPointContent(record.id, taskType, userInstruction);
      setGenerationResult(response.result);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "渠道内容生成失败。 ");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!generationResult) return;
    try {
      await navigator.clipboard.writeText(generationResult);
      setCopyLabel("已复制");
      window.setTimeout(() => setCopyLabel("复制结果"), 1500);
    } catch {
      setGenerationError("复制失败，请手动选择文本。 ");
    }
  }

  const asset = record?.asset;
  const efficacyEntries = asset && typeof asset.efficacyRatings === "object" && asset.efficacyRatings !== null && !Array.isArray(asset.efficacyRatings)
    ? Object.entries(asset.efficacyRatings as Record<string, unknown>)
    : asset && hasContent(asset.efficacyRatings) ? [["功效评分", asset.efficacyRatings] as [string, unknown]] : [];
  const channelEntries = asset ? [
    ["天猫主图", asset.channelAssets.tmallMainImage],
    ["小红书标题", asset.channelAssets.xiaohongshuTitle],
    ["抖音 3s", asset.channelAssets.douyin3s],
    ["抖音脚本", asset.channelAssets.douyinScript],
    ["小红书正文", asset.channelAssets.xiaohongshuContent],
  ].filter(([, value]) => hasContent(value)) : [];

  return (
    <div className="max-w-[1500px] mx-auto space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Lucide.LibraryBig className="w-5 h-5 text-cyan-700" />
            商品卖点知识库
          </h2>
          <p className="text-xs text-slate-500 mt-1">上传结构化 JSON，沉淀商品事实、渠道资产与可复用卖点。</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(event) => void handleFileChange(event.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="h-9 px-4 bg-cyan-700 hover:bg-cyan-800 text-white rounded-md text-xs font-bold flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {uploading ? <Lucide.LoaderCircle className="w-4 h-4 animate-spin" /> : <Lucide.Upload className="w-4 h-4" />}
            {uploading ? "正在解析" : "上传 JSON"}
          </button>
        </div>
      </div>

      {pageError ? (
        <div className="px-4 py-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700 flex items-start gap-2">
          <Lucide.CircleAlert className="w-4 h-4 shrink-0" />
          {pageError}
        </div>
      ) : null}

      <div className="grid xl:grid-cols-[280px_minmax(0,1fr)] gap-4 items-start">
        <aside className="bg-white border border-slate-200 rounded-lg xl:sticky xl:top-0">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Lucide.History className="w-4 h-4 text-cyan-700" />历史记录
            </h2>
            <span className="text-[10px] font-bold text-slate-400">{records.length} 条</span>
          </div>
          <div className="p-3">
            {historyError ? <div className="mb-3 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-md p-2">{historyError}</div> : null}
            {historyLoading ? (
              <div className="py-8 flex justify-center"><Lucide.LoaderCircle className="w-5 h-5 animate-spin text-slate-400" /></div>
            ) : records.length === 0 ? (
              <EmptyState>暂无上传记录</EmptyState>
            ) : (
              <div className="space-y-1 max-h-[620px] overflow-y-auto">
                {records.map((item) => (
                  <div key={item.id} className={`group p-2.5 rounded-md border ${record?.id === item.id ? "bg-cyan-50 border-cyan-200" : "border-transparent hover:bg-slate-50"}`}>
                    <div className="flex items-start gap-2">
                      <button type="button" onClick={() => void handleRestore(item.id)} className="min-w-0 flex-1 text-left cursor-pointer">
                        <strong className="block text-xs text-slate-800 truncate">{item.productName}</strong>
                        <span className="block text-[10px] text-slate-500 truncate mt-0.5">{item.brand} · {item.sellingPointCount} 个卖点</span>
                        <span className="block text-[9px] text-slate-400 mt-1">{formatTime(item.uploadedAt)}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(item.id)}
                        title="删除记录"
                        aria-label={`删除 ${item.productName}`}
                        className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer shrink-0"
                      >
                        <Lucide.Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          {!record || !asset ? (
            <div className="bg-white border border-slate-200 rounded-lg min-h-[420px] flex flex-col items-center justify-center text-center px-6">
              <div className="w-12 h-12 rounded-full bg-cyan-50 flex items-center justify-center mb-4">
                <Lucide.FileJson2 className="w-6 h-6 text-cyan-700" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">尚未载入商品卖点资产</h3>
              <p className="text-xs text-slate-500 mt-2 max-w-md">上传商品卖点 JSON，或从左侧历史记录恢复一份资产。</p>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-4 h-9 px-4 border border-cyan-700 text-cyan-800 hover:bg-cyan-50 rounded-md text-xs font-bold flex items-center gap-2 cursor-pointer">
                <Lucide.Upload className="w-4 h-4" />上传 JSON
              </button>
            </div>
          ) : (
            <>
              {asset.warnings.length > 0 ? (
                <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800 space-y-1">
                  {asset.warnings.map((warning) => <p key={warning}>{warning}</p>)}
                </div>
              ) : null}

              <section className="bg-white border border-slate-200 rounded-lg p-5">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-cyan-700">{record.brand}</span>
                    <h2 className="text-xl font-bold text-slate-900 mt-1 break-words">{record.productName}</h2>
                    <p className="text-[10px] text-slate-400 mt-2">{record.fileName} · {formatTime(record.uploadedAt)}</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 md:min-w-[520px]">
                    {[
                      ["卖点", record.sellingPointCount],
                      ["FAQ", record.faqCount],
                      ["渠道资产", record.channelAssetCount],
                      ["禁用词", record.forbiddenWordCount],
                      ["上传状态", "已解析"],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="p-3 bg-slate-50 border border-slate-100 rounded-md text-center">
                        <strong className="block text-base text-slate-800">{value}</strong>
                        <span className="text-[9px] font-bold text-slate-400">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <Section title="Agent内容生成" icon={<Lucide.WandSparkles className="w-4 h-4 text-cyan-700" />}>
                <div className="grid lg:grid-cols-[210px_minmax(0,1fr)_auto] gap-3 items-end">
                  <label className="block">
                    <span className="block text-[10px] font-bold text-slate-500 mb-1.5">生成任务</span>
                    <select value={taskType} onChange={(event) => setTaskType(event.target.value as SellingPointTaskType)} className="w-full h-9 px-3 border border-slate-200 rounded-md bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-100">
                      {TASK_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="block text-[10px] font-bold text-slate-500 mb-1.5">补充要求（可选）</span>
                    <input value={userInstruction} onChange={(event) => setUserInstruction(event.target.value)} maxLength={2000} placeholder="例如：语气克制，突出适用场景" className="w-full h-9 px-3 border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-cyan-100" />
                  </label>
                  <button type="button" onClick={() => void handleGenerate()} disabled={generating} className="h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
                    {generating ? <Lucide.LoaderCircle className="w-4 h-4 animate-spin" /> : <Lucide.Play className="w-4 h-4" />}
                    {generating ? "生成中" : "生成"}
                  </button>
                </div>
                {generationError ? <div className="mt-3 p-3 bg-rose-50 border border-rose-100 rounded-md text-xs text-rose-700">{generationError}</div> : null}
                {generationResult ? (
                  <div className="mt-4 border border-slate-200 rounded-md overflow-hidden">
                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500">生成结果</span>
                      <button type="button" onClick={() => void handleCopy()} className="h-7 px-2 text-[10px] font-bold text-cyan-700 hover:bg-cyan-50 rounded-md flex items-center gap-1.5 cursor-pointer">
                        <Lucide.Copy className="w-3.5 h-3.5" />{copyLabel}
                      </button>
                    </div>
                    <pre className="p-4 text-xs leading-6 text-slate-700 whitespace-pre-wrap break-words font-sans max-h-[420px] overflow-y-auto">{generationResult}</pre>
                  </div>
                ) : null}
              </Section>

              <Section title="商品基础信息" icon={<Lucide.PackageSearch className="w-4 h-4 text-cyan-700" />}>
                <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3">
                  <ValuePanel label="品牌" value={asset.basicInfo.brand} />
                  <ValuePanel label="产品名" value={asset.basicInfo.productName} />
                  <ValuePanel label="规格" value={asset.basicInfo.spec} />
                  <ValuePanel label="核心成分" value={asset.basicInfo.coreIngredients} />
                  <ValuePanel label="适用人群 / 肤质" value={asset.basicInfo.targetAudience} />
                </div>
              </Section>

              <Section title="功效评分" icon={<Lucide.Gauge className="w-4 h-4 text-cyan-700" />}>
                {efficacyEntries.length > 0 ? (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {efficacyEntries.map(([label, value]) => <ValuePanel key={label} label={label} value={value} />)}
                  </div>
                ) : <EmptyState>JSON 中未提供 efficacy_ratings</EmptyState>}
              </Section>

              <Section title="核心卖点" icon={<Lucide.Sparkles className="w-4 h-4 text-cyan-700" />} action={<span className="text-[10px] font-bold text-slate-400">{asset.sellingPoints.length} 项</span>}>
                {asset.sellingPoints.length > 0 ? (
                  <div className="grid lg:grid-cols-2 gap-3">
                    {asset.sellingPoints.map((point) => (
                      <article key={point.id} className="border border-slate-200 rounded-lg p-4">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-sm font-bold text-slate-800">{point.name}</h3>
                          {hasContent(point.diffScore) ? <span className="text-xs font-bold text-cyan-700 shrink-0">差异分 {formatValue(point.diffScore)}</span> : null}
                        </div>
                        <div className="mt-3 grid gap-2">
                          <ValuePanel label="差异原因" value={point.diffReason} />
                          <ValuePanel label="竞品亮点" value={point.competitorHighlight} />
                          <ValuePanel label="目标人群 / 渠道" value={[point.targetAudience, point.channels].filter(hasContent)} />
                        </div>
                      </article>
                    ))}
                  </div>
                ) : <EmptyState>未找到 selling_points，其他资产仍可继续查看和生成。</EmptyState>}
              </Section>

              <Section title="渠道话术" icon={<Lucide.MessagesSquare className="w-4 h-4 text-cyan-700" />}>
                <div className="grid lg:grid-cols-2 gap-3">
                  <ValuePanel label="天猫标题" value={asset.titles.tmall} />
                  <ValuePanel label="京东标题" value={asset.titles.jd} />
                  <ValuePanel label="拼多多标题" value={asset.titles.pdd} />
                  {channelEntries.map(([label, value]) => <ValuePanel key={String(label)} label={String(label)} value={value} />)}
                </div>
              </Section>

              <Section title="详情页结构（FAB）" icon={<Lucide.LayoutList className="w-4 h-4 text-cyan-700" />}>
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                  <ValuePanel label="痛点" value={asset.detailPage.painPoint} />
                  <ValuePanel label="Feature" value={asset.detailPage.fabFeature} />
                  <ValuePanel label="Advantage" value={asset.detailPage.fabAdvantage} />
                  <ValuePanel label="Benefit" value={asset.detailPage.fabBenefit} />
                  <ValuePanel label="信任证据" value={asset.detailPage.trustEvidence} />
                  <ValuePanel label="对比" value={asset.detailPage.contrast} />
                  <ValuePanel label="售后" value={asset.detailPage.afterSale} />
                </div>
              </Section>

              <Section title="达人脚本" icon={<Lucide.Video className="w-4 h-4 text-cyan-700" />}>
                <div className="grid lg:grid-cols-3 gap-3">
                  <ValuePanel label="Top 5 卖点" value={asset.darenCard.top5Sp} />
                  <ValuePanel label="15s 脚本" value={asset.darenCard.script15s} />
                  <ValuePanel label="拍摄建议" value={asset.darenCard.shootingSuggestion} />
                </div>
              </Section>

              <Section title="售前 FAQ" icon={<Lucide.CircleHelp className="w-4 h-4 text-cyan-700" />}>
                {asset.faqPreSale.length > 0 ? (
                  <div className="space-y-2">{asset.faqPreSale.map((item, index) => <ValuePanel key={index} label={`FAQ ${index + 1}`} value={item} />)}</div>
                ) : <EmptyState>JSON 中未提供 faq_pre_sale</EmptyState>}
              </Section>

              <div className="grid lg:grid-cols-2 gap-4">
                <Section title="禁用词" icon={<Lucide.ShieldBan className="w-4 h-4 text-rose-600" />}>
                  {asset.darenCard.forbiddenWords.length > 0 ? (
                    <p className="text-xs text-rose-700 leading-6 break-words">{asset.darenCard.forbiddenWords.join("、")}</p>
                  ) : <EmptyState>未配置 forbidden_words</EmptyState>}
                </Section>
                <Section title="数据缺口" icon={<Lucide.FileWarning className="w-4 h-4 text-amber-600" />}>
                  {asset.dataGaps.length > 0 ? (
                    <div className="space-y-2">{asset.dataGaps.map((item, index) => <ValuePanel key={index} label={`缺口 ${index + 1}`} value={item} />)}</div>
                  ) : <EmptyState>未记录 data_gaps</EmptyState>}
                </Section>
              </div>

            </>
          )}
        </div>
      </div>
    </div>
  );
}
