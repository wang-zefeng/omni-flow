import React, { useState, useEffect } from "react";
import { PlatformData, SummaryMetrics, WorkflowLog } from "../types";
import MetricCard from "./MetricCard";
import * as Lucide from "lucide-react";

interface BrandDashboardTabProps {
  platformList: PlatformData[];
  summaryMetrics: SummaryMetrics;
  onSyncPlatform: (id: string) => Promise<void>;
  workflowLogs: WorkflowLog[];
  isSyncingId: string | null;
  onNavigateToWorkflow: (workflowId: string, platformId: string) => void;
  dataSourceMode: "api" | "sandbox";
  onToggleDataSourceMode: (mode: "api" | "sandbox") => void;
  onTriggerImport: () => void;
}

export default function BrandDashboardTab({
  platformList,
  summaryMetrics,
  onSyncPlatform,
  workflowLogs,
  isSyncingId,
  onNavigateToWorkflow,
  dataSourceMode,
  onToggleDataSourceMode,
  onTriggerImport,
}: BrandDashboardTabProps) {
  const [selectedChannel, setSelectedChannel] = useState<"ALL" | "B2C" | "B2B">("ALL");
  const [searchText, setSearchText] = useState("");

  const filteredPlatforms = platformList.filter(p => {
    const matchChannel = selectedChannel === "ALL" || p.channel === selectedChannel;
    const pName = p?.name || "";
    const pId = p?.id || "";
    const matchSearch = pName.toLowerCase().includes(searchText.toLowerCase()) || 
                        pId.toLowerCase().includes(searchText.toLowerCase());
    return matchChannel && matchSearch;
  });

  // Calculate sum of active metrics based on current layout
  const todayTotalTurnover = filteredPlatforms.reduce((acc, curr) => acc + curr.todaySales, 0);
  const totalPendingShipments = filteredPlatforms.reduce((acc, curr) => acc + curr.pendingOrders, 0);
  const totalUnreadAwaiting = filteredPlatforms.reduce((acc, curr) => acc + curr.unreadMessages, 0);

  // Format currency for Chinese Yuan
  const formatYuan = (num: number) => {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: "CNY",
      maximumFractionDigits: 0,
    }).format(num);
  };

  const getPlatformIcon = (logo: string) => {
    switch (logo) {
      case "Tmall":
        return <span className="bg-red-600 text-white font-bold text-xs px-2 py-1 rounded">天猫</span>;
      case "TmallGlobal":
        return <span className="bg-purple-700 text-white font-bold text-xs px-2 py-1 rounded">天猫海外</span>;
      case "JD":
        return <span className="bg-red-500 text-white font-bold text-xs px-2 py-1 rounded">京东</span>;
      case "Piduoduo":
        return <span className="bg-orange-500 text-white font-bold text-xs px-2 py-1 rounded">拼多多</span>;
      case "Douyin":
        return <span className="bg-black text-white font-bold text-xs px-2 py-1 rounded">抖音</span>;
      case "Alibaba":
        return <span className="bg-orange-600 text-white font-bold text-xs px-2 py-1 rounded">1688</span>;
      default:
        return <span className="bg-gray-600 text-white font-bold text-xs px-2 py-1 rounded">B2B</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Channel Selector and Sandbox Switcher */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${dataSourceMode === "api" ? "bg-emerald-500" : "bg-amber-500"}`}></span>
              全渠道多维度集成商业中控看板
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                dataSourceMode === "api" 
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}>
                {dataSourceMode === "api" ? "● 生产级实时 API" : "● 离线演示沙盘"}
              </span>
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              聚合 B2B 分销通道与 B2C 零售平台。实时查看成交指数、客服负载并随时激发 AI 中备货与回复。
            </p>
          </div>

          {/* Sandbox selector & Mapping buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Mode Switcher Buttons */}
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 shadow-2xs">
              <button
                onClick={() => onToggleDataSourceMode("api")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  dataSourceMode === "api"
                    ? "bg-white text-emerald-800 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                <Lucide.Radio className="w-3.5 h-3.5" />
                原生 API
              </button>
              <button
                onClick={() => onToggleDataSourceMode("sandbox")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  dataSourceMode === "sandbox"
                    ? "bg-white text-amber-800 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                <Lucide.ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                本地沙盘数据
              </button>
            </div>

            {/* Sync Upload Trigger */}
            <button
              onClick={onTriggerImport}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 border border-indigo-100 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
            >
              <Lucide.UploadCloud className="w-4 h-4" />
              离线数据同步 Mapping
            </button>
          </div>
        </div>

        {/* Channel and filter bar row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-gray-50">
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100/70 p-1">
            <button
              onClick={() => setSelectedChannel("ALL")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                selectedChannel === "ALL"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              全部渠道
            </button>
            <button
              onClick={() => setSelectedChannel("B2C")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                selectedChannel === "B2C"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              B2C 零售平台
            </button>
            <button
              onClick={() => setSelectedChannel("B2B")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                selectedChannel === "B2B"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              B2B 批发分销
            </button>
          </div>

          <div className="relative">
            <Lucide.Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索运营店铺..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="text-xs pl-9 pr-4 py-2 w-48 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 bg-slate-50"
            />
          </div>
        </div>
      </div>

      {/* 2. Overview Statistics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="筛选平台月度 GMV 汇总"
          value={formatYuan(
            filteredPlatforms.reduce((acc, curr) => acc + curr.monthlySales, 0)
          )}
          change="8.2%"
          isPositive={true}
          icon="TrendingUp"
          description="覆盖您所筛选出的各品牌旗舰店"
          trendText="大促增长"
          accentColor="blue"
        />
        <MetricCard
          title="筛选平台今日成交总销量"
          value={formatYuan(todayTotalTurnover)}
          change="12.4%"
          isPositive={true}
          icon="Activity"
          description="多端集成 API 实时汇总"
          trendText="实时监控"
          accentColor="emerald"
        />
        <MetricCard
          title="滞留待发货运单 (待分配/待包)"
          value={`${totalPendingShipments} 件`}
          change={`${(totalPendingShipments * 0.05).toFixed(0)}批`}
          isPositive={false}
          icon="Layers"
          description="已超过24H履约红线报警率"
          trendText="物流压力"
          accentColor="orange"
        />
        <MetricCard
          title="未回复买家会话 (AI代接管)"
          value={`${totalUnreadAwaiting} 条`}
          change="2.4倍"
          isPositive={false}
          icon="MessageSquare"
          description="待客服核审或触发AI智能回复"
          trendText="客服负荷"
          accentColor="purple"
        />
      </div>

      {/* 3. Platforms Grid and Real-time Task Feed split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Dynamic Channels Operations desk */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <div>
              <h3 className="font-semibold text-gray-900 text-base">集成通路矩阵</h3>
              <p className="text-xs text-gray-500 mt-0.5">单击“数据同步”从天猫、拼多多、抖音等原生API抓取最新的销量和沟通日志：</p>
            </div>
            <span className="text-xs font-mono text-gray-400 bg-gray-50 px-2 py-1 rounded border border-gray-100">
              活跃接口: {filteredPlatforms.length} / {platformList.length}
            </span>
          </div>

          <div className="space-y-3">
            {filteredPlatforms.map((platform) => {
              const isSyncing = isSyncingId === platform.id;
              return (
                <div
                  key={platform.id}
                  className="group relative flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50/50 hover:bg-gray-50 rounded-xl border border-gray-100 transition-all duration-200"
                >
                  {/* Identification and logo */}
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-white border border-gray-100 flex items-center justify-center shadow-sm">
                      {getPlatformIcon(platform.logo)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 text-sm">{platform.name}</span>
                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          platform.channel === "B2C" 
                            ? "bg-blue-50 text-blue-700 border border-blue-100" 
                            : "bg-purple-50 text-purple-700 border border-purple-100"
                        }`}>
                          {platform.channel}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        <span>月销 {formatYuan(platform.monthlySales)}</span>
                        <span>•</span>
                        <span>SKU数 {platform.activeProducts}款</span>
                      </div>
                    </div>
                  </div>

                  {/* Core Metrics comparison */}
                  <div className="my-4 sm:my-0 grid grid-cols-3 gap-4 sm:gap-6 text-center sm:text-right">
                    <div>
                      <span className="block text-[10px] text-gray-400 font-medium">今日销量</span>
                      <span className="font-semibold text-gray-800 text-sm">{formatYuan(platform.todaySales)}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-400 font-medium">待发货/会话</span>
                      <span className="font-semibold text-gray-800 text-sm">
                        <span className="text-orange-600">{platform.pendingOrders}</span>
                        <span className="text-gray-300 mx-1">/</span>
                        <span className="text-purple-600">{platform.unreadMessages}</span>
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-400 font-medium">转化率</span>
                      <span className="font-semibold text-green-700 text-sm">{platform.conversionRate}%</span>
                    </div>
                  </div>

                  {/* Operational actionable button tools */}
                  <div className="flex items-center gap-2 sm:pl-4 border-t sm:border-t-0 border-gray-100 pt-3 sm:pt-0 justify-end">
                    {/* Synchronize */}
                    <button
                      onClick={() => onSyncPlatform(platform.id)}
                      disabled={isSyncing}
                      className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border font-medium cursor-pointer transition-colors ${
                        isSyncing
                          ? "bg-gray-100 text-gray-400 border-gray-200"
                          : "bg-white text-gray-700 hover:bg-gray-50 border-gray-200 active:bg-gray-150"
                      }`}
                    >
                      <Lucide.RefreshCw className={`w-3 h-3 ${isSyncing ? "animate-spin text-gray-400" : "text-gray-500"}`} />
                      {isSyncing ? "抓取中..." : "同步数据"}
                    </button>

                    {/* AI Workflow Redirect */}
                    <button
                      onClick={() => onNavigateToWorkflow("customer-reply", platform.id)}
                      className="bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer text-xs px-2.5 py-1.5 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-0.5"
                    >
                      <Lucide.Zap className="w-3 h-3 fill-white" />
                      AI赋能
                    </button>
                  </div>

                  {/* Status Indicator Bar */}
                  <div
                    className="absolute top-0 bottom-0 left-0 w-1 rounded-l-xl"
                    style={{
                      backgroundColor:
                        platform.status === "error"
                          ? "#ef4444"
                          : platform.status === "warning"
                          ? "#f97316"
                          : "#10b981",
                    }}
                  />
                </div>
              );
            })}

            {filteredPlatforms.length === 0 && (
              <div className="py-12 text-center text-gray-400 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                <Lucide.Layers className="w-10 h-10 mx-auto text-gray-300 stroke-1 mb-2" />
                <p className="text-sm font-medium">未查询到符合条件的运营平台或系统</p>
                <button 
                  onClick={() => { setSearchText(""); setSelectedChannel("ALL"); }}
                  className="text-xs text-blue-600 hover:underline mt-1 font-medium"
                >
                  清除所有筛选条件
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Log feed and real-time automation alerts */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-900 text-base flex items-center gap-1.5">
                  <Lucide.Activity className="w-4 h-4 text-emerald-500" />
                  AI 自动化工作日志流
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  监听全平台自动生成草稿、库存预警、大宗分销分析的最近状态。
                </p>
              </div>
            </div>

            <div className="divide-y divide-gray-100 max-h-[360px] overflow-y-auto pr-1 space-y-3.5 pt-1">
              {workflowLogs.map((log) => (
                <div key={log.id} className="pt-3 first:pt-0 flex gap-3 flex-row items-start">
                  <div className="mt-1 shrink-0">
                    {log.status === "success" ? (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                    ) : log.status === "warning" ? (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                      </span>
                    ) : (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                      </span>
                    )}
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-800 flex items-center gap-1.5">
                        {log.type}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {log.status === "success" ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-150">
                            Completed
                          </span>
                        ) : log.status === "warning" ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-150 animate-pulse">
                            Processing
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-150">
                            Error
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400 font-mono">
                          {new Date(log.timestamp).toLocaleTimeString("zh-CN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-605 text-gray-600 leading-relaxed font-normal">
                      {log.summary}
                    </p>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">
                        {log.platform.toUpperCase()}
                      </span>
                      <span className="text-gray-400">/</span>
                      <span className="text-gray-400 font-mono">
                        {log.workflow}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {workflowLogs.length === 0 && (
                <div className="py-12 text-center text-gray-400">
                  <Lucide.Activity className="w-8 h-8 mx-auto text-gray-300 stroke-1 mb-2" />
                  <p className="text-xs">暂无正在运行的 AI 自动化工作日志</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick AI Workflow Launcher Tips */}
          <div className="mt-6 pt-4 border-t border-gray-100 bg-gray-50/50 p-4 rounded-xl space-y-2">
            <h4 className="text-xs font-semibold text-gray-700 flex items-center gap-1">
              <Lucide.Sparkles className="w-3 h-3 text-purple-600 fill-purple-200" />
              如何启动AI自动化？
            </h4>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              系统当前支持通过左侧点击专属各平台 **“AI 赋能”** 进入自动化排兵组装工作面。在工作面您可以配置任何复杂的纠纷调解、备战大促SEO、抖音金句等生产模块。
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
