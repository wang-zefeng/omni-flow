import React, { useState } from "react";
import * as Lucide from "lucide-react";
import { FinanceLedger } from "../types";

interface FinanceTabProps {
  ledgers: FinanceLedger[];
  isAILoading: boolean;
  onRunFinanceAI: (platformName: string, sales: number, ads: number, net: number) => Promise<string>;
  onNavigateToWorkflow: (workflowId: string, prefillInput: Record<string, string>) => void;
}

export default function FinanceTab({
  ledgers,
  isAILoading,
  onRunFinanceAI,
  onNavigateToWorkflow,
}: FinanceTabProps) {
  const [selectedLedger, setSelectedLedger] = useState<FinanceLedger | null>(ledgers[0] || null);
  const [adsMultipler, setAdsMultiplier] = useState<number>(1.2); // Simulator multiplier
  const [aiOutput, setAiOutput] = useState<string>("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Totals calculations
  const totalSales = ledgers.reduce((acc, curr) => acc + curr.salesVolume, 0);
  const totalRefunds = ledgers.reduce((acc, curr) => acc + curr.refundsVolume, 0);
  const totalAds = ledgers.reduce((acc, curr) => acc + curr.adsExpense, 0);
  const totalNet = ledgers.reduce((acc, curr) => acc + curr.netRevenue, 0);
  const avgMargin = ledgers.reduce((acc, curr) => acc + curr.marginPercent, 0) / (ledgers.length || 1);

  const handleRunFinanceAI = async (ledger: FinanceLedger) => {
    setLoadingId(ledger.id);
    try {
      const response = await onRunFinanceAI(ledger.platformName, ledger.salesVolume, ledger.adsExpense, ledger.netRevenue);
      setAiOutput(response);
      setSelectedLedger(ledger);
    } catch (e) {
      setAiOutput("AI 财务利润诊断执行失败，请检查网络后再试。");
    } finally {
      setLoadingId(null);
    }
  };

  // Format currency
  const formatYuan = (num: number) => {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: "CNY",
      maximumFractionDigits: 0
    }).format(num);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Hero Panel */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Lucide.Coins className="w-5 h-5 text-indigo-600" />
            全渠道财务审计与利润率精算中心
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            汇总天猫、拼多多扣点和抖音投产比（ROI）。评估大促销前佣金和广告费投入，进行安全毛利预测。
          </p>
        </div>
        <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
          <div className="text-xs text-slate-500">
            <span className="block font-semibold text-slate-800">大促推广预算系数模拟器</span>
            <span className="block text-[10px] mt-0.5 text-slate-400">调整直通车投加权，测算销售额变幅</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.1"
              value={adsMultipler}
              onChange={(e) => setAdsMultiplier(Number(e.target.value))}
              className="w-24 accent-indigo-600"
            />
            <span className="text-xs font-bold text-indigo-600 w-12">{adsMultipler}x 推广</span>
          </div>
        </div>
      </div>

      {/* 2. Top-level financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">合计实收到账 GMV</span>
            <div className="p-2 rounded-lg bg-indigo-50/50 text-indigo-600">
              <Lucide.Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-gray-900">
              {formatYuan(totalSales)}
            </span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 flex justify-between items-center">
            <span>含大宗B2B付款入账</span>
            <span className="text-green-600 font-semibold">环比 +7.4%</span>
          </p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500" />
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">营销广告/流量直通车总投入</span>
            <div className="p-2 rounded-lg bg-orange-50/50 text-orange-600">
              <Lucide.TvMinimalPlay className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-gray-900">
              {formatYuan(totalAds * adsMultipler)}
            </span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 flex justify-between items-center">
            <span>整体流量扣点率: {((totalAds / totalSales) * 100).toFixed(1)}%</span>
            <span className="text-slate-400">模拟参数加权</span>
          </p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-500" />
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">预估平台售后退款金额</span>
            <div className="p-2 rounded-lg bg-red-50/50 text-red-600">
              <Lucide.Undo2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-red-600">
              {formatYuan(totalRefunds)}
            </span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 flex justify-between items-center">
            <span>退款纠纷占比: {((totalRefunds / totalSales) * 100).toFixed(1)}%</span>
            <span className="text-amber-600 font-semibold">抖音待降低</span>
          </p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-500" />
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">全店综合综合纯利润率</span>
            <div className="p-2 rounded-lg bg-green-50/50 text-green-600">
              <Lucide.Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-gray-900">
              {avgMargin.toFixed(1)}%
            </span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 flex justify-between items-center">
            <span>净利润到账: {formatYuan(totalNet)}</span>
            <span className="text-green-600 font-semibold">健康绿区</span>
          </p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-green-500" />
        </div>
      </div>

      {/* 3. Breakdown visualizations & P&L Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Grid: Platform finance records */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <div>
              <h3 className="font-bold text-gray-900 text-sm">分渠道 P&L 财务收支凭证</h3>
              <p className="text-xs text-gray-400">
                对天猫自营、快手/抖音小店、以及B2B大宗分销系统按销售结算扣点、运费、税费后对齐毛利
              </p>
            </div>
            
            <div className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded text-xs font-mono font-bold">
              核算周期: 2026年Q2累加
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-gray-100">
              <thead>
                <tr className="bg-slate-50 text-gray-500 font-semibold select-none">
                  <th className="py-2.5 px-3">核算平台</th>
                  <th className="py-2.5 px-3">应收售额 (GMV)</th>
                  <th className="py-2.5 px-3">平台扣点佣金</th>
                  <th className="py-2.5 px-3">广告费 (直通车)</th>
                  <th className="py-2.5 px-3">物流与包装</th>
                  <th className="py-2.5 px-3">扣点后预估净收益</th>
                  <th className="py-2.5 px-3">纯利润率 (%)</th>
                  <th className="py-2.5 px-3 text-right">大厂智库</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ledgers.map((l) => {
                  const isWorking = loadingId === l.id;
                  // Dynamic multiplier impact visualization
                  const adsImpact = Math.round(l.adsExpense * adsMultipler);
                  const simNet = Math.max(0, l.netRevenue - (adsImpact - l.adsExpense));
                  const simMargin = Math.min(100, Math.round((simNet / l.salesVolume) * 100));

                  return (
                    <tr key={l.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-3 font-semibold text-gray-800">
                        {l.platformName}
                      </td>
                      <td className="py-3 px-3 font-mono font-medium text-gray-700">
                        {formatYuan(l.salesVolume)}
                      </td>
                      <td className="py-3 px-3 font-mono text-red-600">
                        -{formatYuan(l.platformFee)}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-mono text-slate-600 block">{formatYuan(adsImpact)}</span>
                        {adsMultipler !== 1 && (
                          <span className="text-[9px] text-gray-400 block font-mono">
                            原: {formatYuan(l.adsExpense)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-500">
                        -{formatYuan(l.logisticsFee)}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-800">
                        {formatYuan(simNet)}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                          simMargin >= 25 
                            ? "bg-green-50 text-green-700 border border-green-100" 
                            : simMargin >= 15 
                            ? "bg-blue-50 text-blue-700 border border-blue-100" 
                            : "bg-red-50 text-red-700 border border-red-100"
                        }`}>
                          {simMargin}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleRunFinanceAI(l)}
                            disabled={isWorking || isAILoading}
                            className={`px-2 py-1 font-semibold text-[10px] rounded border transition-colors cursor-pointer ${
                              isWorking
                                ? "bg-amber-100 text-amber-800 border-amber-200"
                                : "bg-white text-indigo-700 hover:bg-slate-50 border-indigo-200"
                            }`}
                          >
                            {isWorking ? "诊断中..." : "ROI评估"}
                          </button>

                          <button
                            onClick={() => {
                              onNavigateToWorkflow("campaign-planner", {
                                festivalName: `${l.platformName} Q3大促专属运营战案`,
                                budget: `广告投入估算: ${formatYuan(adsImpact)} / 平台抽佣支出限制在 ${formatYuan(l.platformFee)} 以内。`,
                                goals: `冲刺销 GMV: ${formatYuan(l.salesVolume * 1.5)}，保底利润率不低于 ${l.marginPercent}%`
                              });
                            }}
                            className="bg-slate-100 text-slate-700 hover:bg-slate-200 px-1 py-1 rounded text-[10px] font-bold"
                            title="前往大促企划AI流程"
                          >
                            企划大促
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Expense Structure Analysis & Gemini recommendation outputs */}
        <div className="lg:col-span-4 bg-slate-900 rounded-xl p-5 text-white shadow-xl flex flex-col justify-between overflow-hidden">
          <div className="space-y-4 flex flex-col h-full overflow-hidden">
            <div className="border-b border-white/10 pb-2 shrink-0">
              <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block">
                EXPENSE STRUCTURE PIE
              </span>
              <h4 className="text-xs font-semibold text-slate-200">
                大促收支毛利润构成与资金配置建议
              </h4>
            </div>

            {/* Simulated expense bar stack inside SVG */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/10 shrink-0 space-y-1.5">
              <span className="text-[10px] text-slate-400 font-semibold block">多店累计营销耗资堆占比图</span>
              
              <div className="w-full bg-slate-800 h-6 rounded-md overflow-hidden flex text-[10px] font-mono leading-none">
                <div className="bg-emerald-500 h-full flex items-center justify-center text-white" style={{ width: "42%" }} title="商品成本: 42%">
                  42%
                </div>
                <div className="bg-indigo-500 h-full flex items-center justify-center text-white" style={{ width: "23%" }} title="直通车投流: 23%">
                  23%
                </div>
                <div className="bg-orange-500 h-full flex items-center justify-center text-white" style={{ width: "15%" }} title="平台扣点: 15%">
                  15%
                </div>
                <div className="bg-red-500 h-full flex items-center justify-center text-white" style={{ width: "8%" }} title="退款损耗: 8%">
                  8%
                </div>
                <div className="bg-amber-400 h-full flex items-center justify-center text-slate-950" style={{ width: "12%" }} title="纯净毛利: 12%">
                  12%
                </div>
              </div>

              <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1.5">
                <span className="inline-flex items-center gap-1.5 text-[9px] text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> 成本 42%
                </span>
                <span className="inline-flex items-center gap-1.5 text-[9px] text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> 投流 23%
                </span>
                <span className="inline-flex items-center gap-1.5 text-[9px] text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span> 佣金 15%
                </span>
                <span className="inline-flex items-center gap-1.5 text-[9px] text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> 净收益 12%
                </span>
              </div>
            </div>

            {/* AI result visualization block */}
            <div className="flex-1 overflow-y-auto space-y-3 font-normal text-xs pr-1 leading-relaxed text-slate-300 select-text max-h-[290px]">
              {aiOutput ? (
                <div className="bg-white/5 border border-white/10 p-3.5 rounded-lg space-y-3 prose prose-invert prose-xs">
                  <div className="flex items-center gap-1.5 text-indigo-400 font-bold border-b border-white/5 pb-1">
                    <Lucide.Sparkles className="w-3.5 h-3.5 text-indigo-400 fill-indigo-400/20" />
                    <span>针对 {selectedLedger?.platformName} 的 ROI 运营方案</span>
                  </div>
                  <div className="whitespace-pre-line text-[11px] font-mono leading-relaxed text-slate-200">
                    {aiOutput}
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center space-y-2">
                  <Lucide.Scale className="w-8 h-8 text-slate-600 stroke-1" />
                  <p className="font-semibold text-slate-400 text-xs">等待快速利润审计指令...</p>
                  <p className="text-[10px] text-slate-600 max-w-[190px]">
                    在左侧选择对应渠道，点击 **“ROI评估”** ，由 AI 针对该平台的退款损耗与推广杠杆比生成最优的保利润战案。
                  </p>
                </div>
              )}
            </div>
          </div>

          {aiOutput && (
            <div className="pt-3 border-t border-white/10 shrink-0">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(aiOutput);
                  alert("财务策略大纲已成功复制到剪贴板！");
                }}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <Lucide.Copy className="w-3.5 h-3.5" />
                复制财务决策方案
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
