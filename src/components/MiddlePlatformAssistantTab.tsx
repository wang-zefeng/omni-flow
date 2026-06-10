import React, { useState, useEffect } from "react";
import * as Lucide from "lucide-react";
import { PlatformData, SupplyChainProduct, FinanceLedger, HRSupportStaff } from "../types";

interface MiddlePlatformAssistantTabProps {
  platformList: PlatformData[];
  supplyChainProducts: SupplyChainProduct[];
  financeLedgers: FinanceLedger[];
  hrStaffList: HRSupportStaff[];
  onNavigateToWorkflow: (workflowId: string, prefillInput: Record<string, string>) => void;
}

export default function MiddlePlatformAssistantTab({
  platformList,
  supplyChainProducts,
  financeLedgers,
  hrStaffList,
  onNavigateToWorkflow
}: MiddlePlatformAssistantTabProps) {
  const [activeDimension, setActiveDimension] = useState<"all" | "omnichannel" | "supply_chain" | "finance" | "hr">("all");
  const [customQuery, setCustomQuery] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisReport, setAnalysisReport] = useState<string>("");
  const [loaderMessage, setLoaderMessage] = useState<string>("");

  // Live state metrics derived on the fly from true parent state (Zero fake placeholders!)
  const totalTodaySales = platformList.reduce((sum, p) => sum + p.todaySales, 0);
  const totalPendingOrders = platformList.reduce((sum, p) => sum + p.pendingOrders, 0);
  const totalUnreadMessages = platformList.reduce((sum, p) => sum + p.unreadMessages, 0);

  // Critical out-of-stock counts (DOH < safeDOH or riskLevel === 'high')
  const criticalProductsCount = supplyChainProducts.filter(
    p => p.riskLevel === "high" || (p.warehouseStock / Math.max(1, p.currentVelocity)) < p.safeDOH
  ).length;

  // Average refund rate
  const totalSalesVolume = financeLedgers.reduce((sum, l) => sum + l.salesVolume, 0);
  const totalRefundsVolume = financeLedgers.reduce((sum, l) => sum + l.refundsVolume, 0);
  const avgRefundRate = totalSalesVolume > 0 ? (totalRefundsVolume / totalSalesVolume) * 100 : 0;

  // Customer support performance & AI helper penetration
  const avgSatisfaction = hrStaffList.reduce((sum, s) => sum + s.satisfactionRate, 0) / Math.max(1, hrStaffList.length);
  const sumResolvedTickets = hrStaffList.reduce((sum, s) => sum + s.resolvedTicketsToday, 0);
  const sumAiAssisted = hrStaffList.reduce((sum, s) => sum + s.aiAssistedCount, 0);
  const aiAssistancePenetration = sumResolvedTickets > 0 ? (sumAiAssisted / sumResolvedTickets) * 100 : 0;

  const quickPrompts = [
    {
      label: "📈 诊断抖音高退折与低润率成因",
      dimension: "finance" as const,
      query: "深度诊断抖音爆款核心小店的财务健康度。为什么退款金额如此惊人？直通车及内容投流开支（P&L）处于怎样一个耗损占比？有什么针对性的财务与运营归因挽单对策？"
    },
    {
      label: "⚠️ 货架缺货危急SKU与排产精算",
      dimension: "supply_chain" as const,
      query: "供应链中有几款产品库存天数（DOH）告急？这些高风险SKU断档可能导致多少GMV销售额损失？请结合工厂排产Lead Time进行安全系数精算调度。"
    },
    {
      label: "🎯 渠道流量大堵塞与AI调度判决",
      dimension: "omnichannel" as const,
      query: "全渠道中有哪些店铺在会话堵塞（未读讯息累加）和积单积库（待发货订单）问题上存在高降权危机？根据大促中台就绪条件，如何触发调度工作流自决响应？"
    },
    {
      label: "🛡️ 集团弹性底薪提点与人能绩效测算",
      dimension: "hr" as const,
      query: "审查目前综合人事名册的基础薪金与提成机制。我们客服组的满意度与AI渗透率，能为集团多大程度减少沉没亏空成本？如何设计组织佣金大促提效激励盘路？"
    }
  ];

  const triggerLoaderMessages = [
    "数据中台大脑正在提取全渠道GMV实时流水账...",
    "正在并行调取供应链分仓库存与DOH安全库存警戒线...",
    "正在穿透财务Ledger损益大盘、抓取投流ROI及平台佣金扣点...",
    "正在载入客服线上响应工时和企业人事绩效模型大宗数据...",
    "正在融合全域异构流并激发 COO AI 决策舱进行深层归因与审计..."
  ];

  const handleRunMiddlePlatformAI = async (queryText: string, searchDimension: "all" | "omnichannel" | "supply_chain" | "finance" | "hr") => {
    setIsAnalyzing(true);
    setAnalysisReport("");
    
    // Cycle messages for premium tech feeling
    let msgIndex = 0;
    setLoaderMessage(triggerLoaderMessages[msgIndex]);
    const interval = setInterval(() => {
      msgIndex = (msgIndex + 1) % triggerLoaderMessages.length;
      setLoaderMessage(triggerLoaderMessages[msgIndex]);
    }, 1200);

    try {
      const response = await fetch("/api/middle-platform/consult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: queryText,
          dimension: searchDimension
        })
      });

      if (response.ok) {
        const data = await response.json();
        setAnalysisReport(data.result || "分析报告未成功生成。");
      } else {
        setAnalysisReport("### ⚠️ 调取中台决策服务接口超时\n\n请检查服务端容器端口及GEMINI API Key环境变量设置是否正确。");
      }
    } catch (e) {
      setAnalysisReport("### ⚠️ 网络通信中断或后台引擎异常\n\n无法触达智能数据中台服务器，请稍后再试。");
    } finally {
      clearInterval(interval);
      setIsAnalyzing(false);
    }
  };

  const handleApplyQuickPrompt = (prompt: { query: string; dimension: "all" | "omnichannel" | "supply_chain" | "finance" | "hr" }) => {
    setCustomQuery(prompt.query);
    setActiveDimension(prompt.dimension);
    handleRunMiddlePlatformAI(prompt.query, prompt.dimension);
  };

  // Run the default analysis once at the start to fill the workspace beautifully
  useEffect(() => {
    handleRunMiddlePlatformAI("对集团当前整体经营盘口进行一次全面的归因诊断与决策判断建议。", "all");
  }, []);

  return (
    <div id="mid_office_ai_assistant_container" className="space-y-6">
      
      {/* 1. Header View */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-indigo-100 text-indigo-800 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold tracking-wide">
              MIDDLE PLATFORM AI
            </span>
            <span className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded-full font-sans">
              全数据融合型大脑
            </span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mt-1.5 flex items-center gap-2">
            <Lucide.ShieldCheck className="w-5.5 h-5.5 text-indigo-600" />
            智能数据中台决策大脑 & Operations COO
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            横跨电商流量、资金流(Finance P&L)、货物流(Supply Chain DOH)、组识流(HR 弹性高激励)的交叉式归因诊断与排产、降废判决中枢。
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => handleRunMiddlePlatformAI(customQuery, activeDimension)}
            disabled={isAnalyzing}
            className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-850 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Lucide.RefreshCw className={`w-4 h-4 ${isAnalyzing ? "animate-spin" : ""}`} />
            刷新中台深度审计
          </button>
        </div>
      </div>

      {/* 2. Operational Metrics Bar - Computed Dynamically (Real Data) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">中台总未读及未发积单</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Lucide.Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">
              {(totalPendingOrders + totalUnreadMessages).toLocaleString()} 个
            </span>
            <span className="text-[10px] font-mono text-amber-600 font-bold bg-amber-50 px-1 py-0.1 select-none rounded">
              待处理
            </span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">
            待发货订单: <span className="font-semibold text-gray-700">{totalPendingOrders}</span> 笔 | 溢出客诉: <span className="font-semibold text-gray-700">{totalUnreadMessages}</span> 封
          </p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600" />
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">供应链库存告急危殆 SKU</span>
            <div className="p-1.5 rounded-lg bg-red-50 text-red-600">
              <Lucide.TriangleAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-red-600">
              {criticalProductsCount} 款
            </span>
            <span className="text-[10px] font-mono text-red-600 font-bold bg-red-50 px-1 py-0.1 select-none rounded animate-pulse">
              安全水位以下
            </span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">
            DOH周转不足以覆盖大供排厂期交交货所需天数
          </p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-500" />
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">全渠道加权售后退款率</span>
            <div className="p-1.5 rounded-lg bg-orange-50 text-orange-600">
              <Lucide.TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">
              {avgRefundRate.toFixed(2)}%
            </span>
            <span className="text-[10px] font-mono text-gray-500">账面流水损耗比</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">
            天猫/拼多多/抖音各大仓售后期客运摩擦逆向消耗比
          </p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-500" />
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">金牌组人客满意度/AI工作量</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Lucide.Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">
              {avgSatisfaction.toFixed(1)}% Satisfy
            </span>
            <span className="text-[10px] font-mono text-emerald-600 font-bold">
              {aiAssistancePenetration.toFixed(0)}% AI 辅助
            </span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">
            本日累计自动辅助拦截削减客诉共 <span className="font-semibold text-gray-700">{sumAiAssisted}</span> 起
          </p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500" />
        </div>
      </div>

      {/* 3. Operational Attribution Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left Interactive Control Pane */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-gray-100 p-5 flex flex-col justify-between space-y-5 shadow-sm min-h-[550px]">
          <div className="space-y-4 flex-1">
            <div className="border-b border-gray-100 pb-3">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                <Lucide.Compass className="w-4.5 h-4.5 text-indigo-600" />
                第一步：选择诊断主旨或个性化追问
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">请选择或自由询问各种关于集团多维度跨流、供应链或财务ROI损耗问题</p>
            </div>

            {/* Analysis Dimension Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setActiveDimension("all"); setCustomQuery("对集团当前整体经营盘口进行一次全面的归因诊断与决策判断建议。"); }}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-bold text-left transition-all cursor-pointer ${
                  activeDimension === "all"
                    ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-slate-50"
                }`}
              >
                <Lucide.LayoutDashboard className="w-4 h-4 shrink-0 text-indigo-500" />
                <span>全链路全面综合诊断</span>
              </button>
              
              <button
                onClick={() => { setActiveDimension("omnichannel"); setCustomQuery("评估大促前出货渠道就绪度，尤其处理会话堆塞与拼多多积单积货对平台降权的影响。"); }}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-bold text-left transition-all cursor-pointer ${
                  activeDimension === "omnichannel"
                    ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-slate-50"
                }`}
              >
                <Lucide.ShoppingBag className="w-4 h-4 shrink-0 text-indigo-500" />
                <span>各大促渠道就绪归因</span>
              </button>

              <button
                onClick={() => { setActiveDimension("supply_chain"); setCustomQuery("审查哪些SKU库存告急？在短缺、断料状态下，其工厂交期和调度方案是什么？"); }}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-bold text-left transition-all cursor-pointer ${
                  activeDimension === "supply_chain"
                    ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-slate-50"
                }`}
              >
                <Lucide.Truck className="w-4 h-4 shrink-0 text-indigo-500" />
                <span>安全库存与调度判词</span>
              </button>

              <button
                onClick={() => { setActiveDimension("finance"); setCustomQuery("为什么特定平台退换折损极高？广告流量投流ROI漏油瓶颈点如何识别与卡边避开？"); }}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-bold text-left transition-all cursor-pointer ${
                  activeDimension === "finance"
                    ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-slate-50"
                }`}
              >
                <Lucide.Scale className="w-4 h-4 shrink-0 text-indigo-500" />
                <span>财务损益P&L投产精算</span>
              </button>
            </div>

            {/* Quick Prompt List */}
            <div className="space-y-2 pt-1 border-t border-gray-100">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                中台精选快捷诊断
              </span>
              <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-1">
                {quickPrompts.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleApplyQuickPrompt(p)}
                    className="w-full text-left px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-xs font-medium text-gray-700 transition-all border border-gray-100 flex items-center justify-between group cursor-pointer"
                  >
                    <span className="truncate pr-2">{p.label}</span>
                    <Lucide.ArrowRight className="w-3.5 h-3.5 text-indigo-500 opacity-0 group-hover:opacity-100 transition-all shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            {/* Free form input box */}
            <div className="space-y-1.5 pt-2 border-t border-gray-100">
              <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                首席中台官个性化决策追问 (自由提问)
              </label>
              <textarea
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                placeholder="在此输入您的个性化中台审计请求或追问（例如：'计算一下目前的综合库存总耗，推荐重点补货哪个店铺？'...）"
                className="w-full p-3 border border-gray-200 rounded-lg text-xs leading-relaxed max-h-[100px] h-[80px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100 shrink-0">
            <button
              onClick={() => handleRunMiddlePlatformAI(customQuery || "大宗综合审计和降赔意见", activeDimension)}
              disabled={isAnalyzing}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <Lucide.PartyPopper className={`w-4 h-4 ${isAnalyzing ? "animate-bounce" : ""}`} />
              激发起算：大促智能归因与判断
            </button>
          </div>
        </div>

        {/* Right Brain Verdict Output View */}
        <div className="lg:col-span-4 lg:col-start-6 lg:w-full bg-slate-900 rounded-xl p-5 text-white shadow-xl flex flex-col justify-between overflow-hidden min-h-[550px] lg:col-span-7">
          <div className="space-y-4 flex flex-col h-full overflow-hidden">
            
            <div className="border-b border-white/10 pb-3 shrink-0 flex items-center justify-between">
              <div>
                <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider block">
                  MIDDLE WORKSPACE EXECUTIVE DESK
                </span>
                <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Lucide.Sparkles className="w-3.5 h-3.5 text-indigo-400 fill-indigo-400/20" />
                  中台高级经营精算战略白皮书
                </h4>
              </div>
              <span className={`h-2 w-2 rounded-full ${isAnalyzing ? "bg-amber-400 animate-ping" : "bg-green-500"}`} />
            </div>

            {/* Analysis report display area */}
            <div className="flex-1 overflow-y-auto space-y-4 font-normal text-xs pr-1 leading-relaxed text-slate-350 select-text max-h-[400px]">
              {isAnalyzing ? (
                <div className="py-24 text-center flex flex-col items-center justify-center space-y-4 h-full">
                  <div className="relative">
                    <Lucide.Cpu className="w-12 h-12 text-indigo-400 animate-spin" />
                    <Lucide.Lightbulb className="w-6 h-6 text-yellow-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                  </div>
                  <p className="font-bold text-slate-200 text-sm animate-pulse tracking-wide">
                    {loaderMessage}
                  </p>
                  <p className="text-[10px] text-slate-500 max-w-[270px]">
                    诊断引擎正在融合供应链排产、各就绪渠道会话、退款折溢财务矩阵进行全链深度算账与因果交叉判断。这大约需要几秒钟。
                  </p>
                </div>
              ) : analysisReport ? (
                <div className="bg-white/5 border border-white/10 p-4 rounded-xl space-y-4 prose prose-invert prose-xs select-text">
                  <div className="whitespace-pre-line text-xs font-sans leading-relaxed text-slate-100">
                    {analysisReport}
                  </div>
                </div>
              ) : (
                <div className="py-24 text-center text-slate-500 flex flex-col items-center justify-center space-y-2 h-full">
                  <Lucide.BrainCircuit className="w-10 h-10 text-slate-600 stroke-1 block" />
                  <p className="font-semibold text-slate-400 text-xs">智能数据中台战略决策舱等待激发</p>
                  <p className="text-[10px] text-slate-600 max-w-[210px] mx-auto">
                    请在左侧选择审计维度、或是点击黄金大促快捷诊断，我们将通过 AI 大数据大脑归因各大平台的利润泄露漏洞和短缺危机！
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Bottom quick actions */}
          {!isAnalyzing && analysisReport && (
            <div className="pt-3 border-t border-white/10 shrink-0 grid grid-cols-2 gap-2 mt-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(analysisReport);
                  alert("中台高级诊断白皮书已复制！");
                }}
                className="py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Lucide.Copy className="w-3.5 h-3.5" />
                复制报告大纲
              </button>

              <button
                onClick={() => {
                  if (activeDimension === "supply_chain" || analysisReport.includes("库存") || analysisReport.includes("安全")) {
                    onNavigateToWorkflow("replenishment-planner", {
                      daysNeeded: "15",
                      reorderReason: "智能中台安全库存大促高风险断料拦截"
                    });
                  } else {
                    onNavigateToWorkflow("customer-reply", {
                      customerMsg: "你好，请问大促期间的物流时效和优惠怎么申请？",
                      tone: "friendly"
                    });
                  }
                }}
                className="py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Lucide.WandSparkles className="w-3.5 h-3.5" />
                去执行配发流程
              </button>
            </div>
          )}
        </div>

      </div>

      {/* 4. Cross Platform Attribution Explainer */}
      <div className="bg-indigo-950 text-indigo-200 rounded-xl p-5 border border-indigo-900/50">
        <div className="flex items-start gap-4">
          <div className="p-2.5 bg-indigo-900 rounded-lg text-amber-400 shrink-0">
            <Lucide.BookOpen className="w-5 h-5" />
          </div>
          <div className="space-y-1.5">
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
              💡 什么是智能电商数据中台（Data & Operations Mid-Office）？
            </h4>
            <p className="text-xs leading-relaxed text-indigo-300">
              通常，前台直面对接天猫、抖音等店播流量，后台掌握复杂的工厂排厂交期和小组人事固定算账。
              **智能数据中台** 充当两者间的“全流整合大脑”。当系统盘点出发货大积单、抖音退款占比过高或供应链余存周转（DOH）过低时，AI助理会打破传统前后台各自为战的烟囱式结构，瞬间实现交叉归因并给出供应链调拨调价、智能应答分流的联合判断，大幅缩减由于信息孤岛造成的销售额漏损。
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
