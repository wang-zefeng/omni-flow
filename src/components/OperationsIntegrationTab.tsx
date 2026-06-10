import React, { useEffect, useMemo, useState } from "react";
import * as Lucide from "lucide-react";
import { withAdminToken } from "../utils/adminAuth";

type BrandConfig = {
  id: string;
  companyName: string;
  brandName: string;
  channelType: string;
  platform: string;
  owner: string;
  status: string;
  integrationMode: string;
};

type PlatformConnection = {
  id: string;
  channelType: string;
  platform: string;
  connectionMode: string;
  status: string;
  owner: string;
  syncFrequency: string;
  lastSyncAt: string;
  nextAction: string;
};

type AIWorkflowRule = {
  id: string;
  name: string;
  platform: string;
  brandName: string;
  workflowType: string;
  enabled: boolean;
  triggerMetric: string;
  thresholdLabel: string;
  frequency: string;
  owner: string;
  humanReviewRequired: boolean;
};

type WorkflowTask = {
  id: string;
  sourceAIInsightId: string;
  title: string;
  platform: string;
  productName: string;
  owner: string;
  dueDate: string;
  status: string;
  actionType: string;
  resultNote?: string;
};

type ImportedRow = {
  id: string;
  platform?: string;
  brand?: string;
  productName?: string;
};

type OpsState = {
  brands: BrandConfig[];
  connections: PlatformConnection[];
  rules: AIWorkflowRule[];
  tasks: WorkflowTask[];
  rows: ImportedRow[];
  updatedAt: Record<string, string>;
};

const emptyState: OpsState = {
  brands: [],
  connections: [],
  rules: [],
  tasks: [],
  rows: [],
  updatedAt: {},
};

const taskStatusOptions = [
  { value: "pending_review", label: "待审核" },
  { value: "accepted", label: "已采纳" },
  { value: "in_progress", label: "执行中" },
  { value: "done", label: "已完成" },
  { value: "reviewed", label: "已复盘" },
  { value: "rejected", label: "已驳回" },
];

function countBy<T>(items: T[], readKey: (item: T) => string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = readKey(item) || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function firstEntries(map: Record<string, number>, limit = 3) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function formatTime(value?: string) {
  if (!value) return "未同步";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN");
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `${url} failed with ${response.status}`);
  }
  return payload as T;
}

export default function OperationsIntegrationTab() {
  const [state, setState] = useState<OpsState>(emptyState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingTaskId, setIsSavingTaskId] = useState<string | null>(null);
  const [message, setMessage] = useState("正在加载集成运营配置...");
  const [proxyResult, setProxyResult] = useState<string>("");

  const summaries = useMemo(() => {
    const connectionStatuses = countBy(state.connections, (item) => item.status);
    const taskStatuses = countBy(state.tasks, (item) => item.status);
    return {
      enabledRules: state.rules.filter((rule) => rule.enabled).length,
      humanReviewRules: state.rules.filter((rule) => rule.humanReviewRequired).length,
      connectionStatuses,
      taskStatuses,
    };
  }, [state]);

  const loadData = async () => {
    setIsLoading(true);
    setMessage("正在加载集成运营配置...");
    try {
      const [brands, connections, rules, rows, tasks] = await Promise.all([
        fetchJson<{ brands: BrandConfig[]; updatedAt?: string }>("/api/master-data/brands"),
        fetchJson<{ connections: PlatformConnection[]; updatedAt?: string }>("/api/config/platform-connections"),
        fetchJson<{ rules: AIWorkflowRule[]; updatedAt?: string }>("/api/config/ai-workflow-rules"),
        fetchJson<{ rows: ImportedRow[]; updatedAt?: string }>("/api/ops/imported-rows"),
        fetchJson<{ tasks: WorkflowTask[]; updatedAt?: string }>("/api/ops/workflow-tasks"),
      ]);
      setState({
        brands: brands.brands || [],
        connections: connections.connections || [],
        rules: rules.rules || [],
        rows: rows.rows || [],
        tasks: tasks.tasks || [],
        updatedAt: {
          brands: brands.updatedAt || "",
          connections: connections.updatedAt || "",
          rules: rules.updatedAt || "",
          rows: rows.updatedAt || "",
          tasks: tasks.updatedAt || "",
        },
      });
      setMessage("集成配置已加载");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载失败");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const saveTasks = async (nextTasks: WorkflowTask[], taskId: string) => {
    setIsSavingTaskId(taskId);
    try {
      const response = await fetch("/api/ops/workflow-tasks", {
        method: "PUT",
        credentials: "include",
        headers: withAdminToken({ "Content-Type": "application/json" }),
        body: JSON.stringify({ tasks: nextTasks }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `保存失败: ${response.status}`);
      }
      setState((prev) => ({
        ...prev,
        tasks: payload.tasks || nextTasks,
        updatedAt: { ...prev.updatedAt, tasks: payload.updatedAt || new Date().toISOString() },
      }));
      setMessage("任务状态已保存到 JSON 任务池");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "任务保存失败");
    } finally {
      setIsSavingTaskId(null);
    }
  };

  const handleTaskStatusChange = (taskId: string, status: string) => {
    const nextTasks = state.tasks.map((task) => (task.id === taskId ? { ...task, status } : task));
    void saveTasks(nextTasks, taskId);
  };

  const handleRunProxy = async () => {
    const rule =
      state.rules.find((item) => item.enabled) ||
      state.rules[0] || {
        id: "manual-rule",
        name: "Manual Ops Rule",
        platform: "global",
        brandName: "global",
        workflowType: "sales_drop",
        triggerMetric: "manual",
        thresholdLabel: "manual",
      };
    setProxyResult("");
    setMessage("正在试跑 AI 规则代理...");
    try {
      const response = await fetch("/api/ai/brand-ops/run", {
        method: "POST",
        credentials: "include",
        headers: withAdminToken({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          rule,
          prompt: {
            system: "Only use structured metrics. Return AIInsightJSON.",
            user: "Review the selected operating rule and create a human-review recommendation.",
          },
          structuredMetrics: {
            rowCount: state.rows.length,
            brandCount: state.brands.length,
            taskCount: state.tasks.length,
          },
          humanReviewRequired: true,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `代理试跑失败: ${response.status}`);
      }
      setProxyResult(payload.rawOutput?.summary || JSON.stringify(payload.rawOutput || payload));
      setMessage("AI 规则代理试跑完成");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI 代理试跑失败");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-black">Integrated Ops</div>
          <h2 className="text-xl font-black text-slate-900 mt-1">配置 / 任务中心</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-2">
            {message}
          </span>
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={isLoading}
            className="h-9 px-3 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-2 hover:bg-slate-100 disabled:opacity-50"
          >
            <Lucide.RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            刷新
          </button>
          <button
            type="button"
            onClick={handleRunProxy}
            className="h-9 px-3 rounded-lg bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 hover:bg-indigo-800"
          >
            <Lucide.PlayCircle className="w-4 h-4" />
            试跑规则
          </button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3">
        <MetricTile icon={Lucide.Building2} label="品牌主数据" value={state.brands.length} detail={formatTime(state.updatedAt.brands)} />
        <MetricTile icon={Lucide.SlidersHorizontal} label="平台连接" value={state.connections.length} detail={firstEntries(summaries.connectionStatuses).map(([k, v]) => `${k} ${v}`).join(" / ") || "暂无"} />
        <MetricTile icon={Lucide.Bot} label="AI 规则" value={`${summaries.enabledRules}/${state.rules.length}`} detail={`人工审核 ${summaries.humanReviewRules}`} />
        <MetricTile icon={Lucide.ClipboardList} label="任务池" value={state.tasks.length} detail={firstEntries(summaries.taskStatuses).map(([k, v]) => `${k} ${v}`).join(" / ") || "暂无"} />
        <MetricTile icon={Lucide.Database} label="导入数据" value={state.rows.length} detail={formatTime(state.updatedAt.rows)} />
      </div>

      {proxyResult && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 text-sm text-indigo-950 font-semibold">
          {proxyResult}
        </div>
      )}

      <div className="grid grid-cols-[1fr_1.2fr] gap-4">
        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900">平台 / 品牌连接</h3>
            <span className="text-[10px] font-bold text-slate-500">JSON Store</span>
          </div>
          <div className="divide-y divide-slate-100">
            {state.connections.slice(0, 8).map((item) => (
              <div key={item.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-black text-slate-800 truncate">{item.platform}</div>
                  <div className="text-[11px] text-slate-500 mt-1 truncate">{item.owner} · {item.connectionMode}</div>
                </div>
                <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded bg-slate-100 text-slate-700">
                  {item.status}
                </span>
              </div>
            ))}
            {state.connections.length === 0 && <EmptyLine text="暂无平台连接配置" />}
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900">人工审核任务池</h3>
            <span className="text-[10px] font-bold text-slate-500">{formatTime(state.updatedAt.tasks)}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {state.tasks.slice(0, 8).map((task) => (
              <div key={task.id} className="px-4 py-3 grid grid-cols-[1fr_130px] gap-3 items-center">
                <div className="min-w-0">
                  <div className="text-xs font-black text-slate-800 truncate">{task.title}</div>
                  <div className="text-[11px] text-slate-500 mt-1 truncate">
                    {task.platform} · {task.productName} · {task.owner}
                  </div>
                </div>
                <select
                  value={task.status}
                  disabled={isSavingTaskId === task.id}
                  onChange={(event) => handleTaskStatusChange(task.id, event.target.value)}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-700 outline-none focus:border-indigo-500"
                >
                  {taskStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            {state.tasks.length === 0 && <EmptyLine text="暂无审核任务" />}
          </div>
        </section>
      </div>

      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900">AI 自动化规则</h3>
          <span className="text-[10px] font-bold text-slate-500">{formatTime(state.updatedAt.rules)}</span>
        </div>
        <div className="grid grid-cols-2 divide-x divide-slate-100">
          {state.rules.slice(0, 6).map((rule) => (
            <div key={rule.id} className="p-4 flex items-start justify-between gap-3 border-b border-slate-100">
              <div className="min-w-0">
                <div className="text-xs font-black text-slate-800 truncate">{rule.name}</div>
                <div className="text-[11px] text-slate-500 mt-1 truncate">
                  {rule.platform} · {rule.brandName} · {rule.workflowType}
                </div>
              </div>
              <span className={`shrink-0 text-[10px] font-black px-2 py-1 rounded ${rule.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {rule.enabled ? "启用" : "停用"}
              </span>
            </div>
          ))}
          {state.rules.length === 0 && <EmptyLine text="暂无 AI 规则" />}
        </div>
      </section>
    </div>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  detail: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 min-w-0">
      <div className="flex items-center justify-between">
        <Icon className="w-4 h-4 text-indigo-600" />
        <span className="text-[10px] font-bold text-slate-400 uppercase">{label}</span>
      </div>
      <div className="mt-3 text-2xl font-black text-slate-900 truncate">{value}</div>
      <div className="mt-1 text-[11px] text-slate-500 truncate">{detail}</div>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <div className="px-4 py-6 text-center text-xs font-bold text-slate-400">{text}</div>;
}
