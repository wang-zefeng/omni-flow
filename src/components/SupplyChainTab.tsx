import React, { useState } from "react";
import * as Lucide from "lucide-react";
import { SupplyChainProduct } from "../types";

interface SupplyChainTabProps {
  products: SupplyChainProduct[];
  isAILoading: boolean;
  onRunInventoryAI: (sku: string, currentStock: number, dailyVelocity: number) => Promise<string>;
  onNavigateToWorkflow: (workflowId: string, prefillInput: Record<string, string>) => void;
}

export default function SupplyChainTab({
  products,
  isAILoading,
  onRunInventoryAI,
  onNavigateToWorkflow,
}: SupplyChainTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [riskFilter, setRiskFilter] = useState<"ALL" | "high" | "medium" | "low">("ALL");
  const [selectedProduct, setSelectedProduct] = useState<SupplyChainProduct | null>(products[0] || null);
  const [thresholdDays, setThresholdDays] = useState<number>(15); // Alert if DOH is below this
  const [aiOutput, setAiOutput] = useState<string>("");
  const [loadingSku, setLoadingSku] = useState<string | null>(null);

  // Dynamic products list
  const filteredProducts = products.filter(p => {
    const pName = p?.name || "";
    const pSku = p?.sku || "";
    const matchesSearch = pName.toLowerCase().includes(searchTerm.toLowerCase()) || pSku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRisk = riskFilter === "ALL" || p?.riskLevel === riskFilter;
    return matchesSearch && matchesRisk;
  });

  const handleQuickAIAnalyze = async (product: SupplyChainProduct) => {
    setLoadingSku(product.sku);
    try {
      const response = await onRunInventoryAI(product.name, product.warehouseStock, product.currentVelocity);
      setAiOutput(response);
      setSelectedProduct(product);
    } catch (e) {
      setAiOutput("AI分析触发失败，请稍后重试。");
    } finally {
      setLoadingSku(null);
    }
  };

  const getRiskClass = (level: "low" | "medium" | "high") => {
    switch (level) {
      case "high": return "bg-red-50 text-red-700 border-red-100";
      case "medium": return "bg-amber-50 text-amber-700 border-amber-100";
      case "low": return "bg-green-50 text-green-700 border-green-100";
    }
  };

  const getRiskLabel = (level: "low" | "medium" | "high") => {
    switch (level) {
      case "high": return "断货极高风险";
      case "medium": return "库存紧张警戒";
      case "low": return "安全周转水平";
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Hero Banner */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Lucide.PackageOpen className="w-5 h-5 text-indigo-600" />
            智慧供应链与跨仓备料协同中心
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            监控各分仓在库深度。设置安全周转天数（DOH），由 AI 自动测算并下发对供应商的排产清单。
          </p>
        </div>
        <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
          <div className="text-xs text-slate-500">
            <span className="block font-semibold text-slate-800">DOH 安全天数警戒阀值</span>
            <span className="block text-[10px] mt-0.5 text-slate-400">低于此值的 SKU 将标红预警</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="5"
              max="30"
              value={thresholdDays}
              onChange={(e) => setThresholdDays(Number(e.target.value))}
              className="w-24 accent-indigo-600"
            />
            <span className="text-xs font-bold text-indigo-600 w-8">{thresholdDays} 天</span>
          </div>
        </div>
      </div>

      {/* 2. Top-level KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">全渠道累计在库件数</span>
            <div className="p-2 rounded-lg bg-indigo-50/50 text-indigo-600">
              <Lucide.Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-gray-900">
              {products.reduce((acc, curr) => acc + curr.warehouseStock, 0).toLocaleString()}
            </span>
            <span className="text-xs text-slate-400 ml-1.5">件 在库</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">不含大宗在途及工厂原料</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500" />
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">跨仓大宗在途件数</span>
            <div className="p-2 rounded-lg bg-blue-50/50 text-blue-600">
              <Lucide.Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-gray-900">
              {products.reduce((acc, curr) => acc + curr.transitStock, 0).toLocaleString()}
            </span>
            <span className="text-xs text-slate-400 ml-1.5">件 海陆空运中</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">预计在3-5个工作日内陆续清关入库</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500" />
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">DOH警戒预警 SKU</span>
            <div className="p-2 rounded-lg bg-amber-50/50 text-amber-600">
              <Lucide.AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {/* calculated dynamic stocks below selection limit */}
            <span className="text-2xl font-bold text-red-600">
              {products.filter(p => (p.warehouseStock / p.currentVelocity) < thresholdDays).length}
            </span>
            <span className="text-xs text-slate-400 ml-1.5">款 触发周转告警</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">低于所设的 {thresholdDays}天 周转警戒安全水位</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500" />
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">平均排产清关到货时效</span>
            <div className="p-2 rounded-lg bg-green-50/50 text-green-600">
              <Lucide.Timer className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-gray-900">18.5</span>
            <span className="text-xs text-slate-400 ml-1.5">天 平均货期</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">主要供应商浙江/江苏基地大宗货期</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-green-500" />
        </div>
      </div>

      {/* 3. Main Operational Board */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Grid: SKU List to supervise */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <div>
              <h3 className="font-bold text-gray-900 text-sm">SKU 备货追踪视口</h3>
              <p className="text-xs text-gray-400">
                可搜索货名、过滤风险类别。点击“AI 决策诊断”按钮生成专门的备料订单。
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value as any)}
                className="text-xs py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-600"
              >
                <option value="ALL">全部风险</option>
                <option value="high">断货极高风险</option>
                <option value="medium">库存紧张警戒</option>
                <option value="low">安全状态</option>
              </select>

              <div className="relative">
                <Lucide.Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="检索SKU或名称..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="text-xs pl-8 pr-3 py-1.5 w-40 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-300"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-gray-100">
              <thead>
                <tr className="bg-slate-50 text-gray-500 font-semibold select-none">
                  <th className="py-2.5 px-3">SKU 编码 / 商品名称</th>
                  <th className="py-2.5 px-3">当前在库</th>
                  <th className="py-2.5 px-3">在途大宗</th>
                  <th className="py-2.5 px-3">日均去料速</th>
                  <th className="py-2.5 px-3">安全周转天数 (DOH)</th>
                  <th className="py-2.5 px-3">供应链建议 / 状态</th>
                  <th className="py-2.5 px-3 text-right">中控功能</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map((p) => {
                  const doh = Math.round(p.warehouseStock / p.currentVelocity);
                  const isBelowThreshold = doh < thresholdDays;
                  const isAIWorking = loadingSku === p.sku;

                  return (
                    <tr 
                      key={p.id} 
                      className={`hover:bg-slate-50/50 transition-colors ${
                        isBelowThreshold ? "bg-red-50/20" : ""
                      }`}
                    >
                      <td className="py-3 px-3">
                        <span className="block font-semibold text-gray-800 font-mono text-[11px]">
                          {p.sku}
                        </span>
                        <span className="block text-slate-500 font-medium text-[11px] truncate max-w-[170px]" title={p.name}>
                          {p.name}
                        </span>
                      </td>

                      <td className="py-3 px-3 font-semibold text-gray-800">
                        {p.warehouseStock.toLocaleString()}
                        <div className="w-16 bg-gray-100 h-1.5 rounded-full overflow-hidden mt-1">
                          <div 
                            className={`h-full ${isBelowThreshold ? "bg-red-500" : "bg-indigo-500"}`} 
                            style={{ width: `${Math.min(100, (p.warehouseStock / 3000) * 100)}%` }}
                          />
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono text-slate-500">
                        +{p.transitStock.toLocaleString()}
                      </td>

                      <td className="py-3 px-3">
                        <span className="text-gray-700 font-mono font-medium">{p.currentVelocity}</span>
                        <span className="text-[10px] text-gray-400 ml-0.5">件/天</span>
                      </td>

                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 font-bold ${
                          isBelowThreshold ? "text-red-600 animate-pulse" : "text-gray-700"
                        }`}>
                          {doh} 天
                          {isBelowThreshold && (
                            <Lucide.AlertTriangle className="w-3 h-3 text-red-500" />
                          )}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getRiskClass(p.riskLevel)}`}>
                          {getRiskLabel(p.riskLevel)}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleQuickAIAnalyze(p)}
                            disabled={isAIWorking || isAILoading}
                            className={`px-2 py-1 select-none font-semibold text-[10px] rounded border transition-colors cursor-pointer ${
                              isAIWorking
                                ? "bg-amber-100 text-amber-800 border-amber-200"
                                : "bg-white text-indigo-700 hover:bg-slate-50 border-indigo-200"
                            }`}
                          >
                            {isAIWorking ? "测算中..." : "AI决策"}
                          </button>

                          <button
                            onClick={() => {
                              onNavigateToWorkflow("inventory-replenish", {
                                currentStock: `${p.warehouseStock}件 (在途大宗: ${p.transitStock}件)`,
                                dailyVelocity: `日常销速 ${p.currentVelocity}件/天，周六日爆发约200件/天`,
                                leadTime: `原厂备产运货周期 ${p.factoryLeadTime}天`,
                                supplierState: `主供: ${p.supplierName}。大促将至，注意可能由于物流揽派拥堵导致提前申报。`
                              });
                            }}
                            className="bg-slate-100 text-slate-700 hover:bg-slate-200 px-1.5 py-1 rounded text-[10px] font-bold transition-colors"
                            title="前往AI工作流面板精配"
                          >
                            精配流程
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400">
                      没有检索到符合过滤条件的 SKU。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Grid: Live SVG Flow Map and AI Replenishment Report Outlets */}
        <div className="lg:col-span-4 bg-slate-900 rounded-xl p-5 text-white shadow-xl flex flex-col justify-between overflow-hidden">
          <div className="space-y-4 flex flex-col h-full overflow-hidden">
            <div className="border-b border-white/10 pb-2 shrink-0">
              <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block">
                SUPPLY CHAIN DIGITAL TWIN
              </span>
              <h4 className="text-xs font-semibold text-slate-200">
                供应链数字孪生与 AI 直达舱
              </h4>
            </div>

            {/* Warehouse Visual SVG Map */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/10 shrink-0">
              <span className="text-[10px] text-slate-400 font-semibold block mb-2">跨分仓联动物流网络流向示意度</span>
              <div className="flex items-center justify-between mx-1">
                <div className="text-center">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20 border border-orange-400/40 flex items-center justify-center mx-auto text-orange-400">
                    <Lucide.Factory className="w-4 h-4" />
                  </div>
                  <span className="text-[9px] text-slate-400 mt-1 block">协作工厂</span>
                </div>
                
                <div className="flex-1 px-1 text-center relative">
                  <Lucide.ArrowRight className="w-4 h-4 text-indigo-500/50 mx-auto animate-pulse" />
                  <span className="text-[8px] text-slate-500 font-mono block absolute -top-3 left-1/2 -translate-x-1/2">运输中(18D)</span>
                </div>

                <div className="text-center">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center mx-auto text-indigo-400 animate-pulse">
                    <Lucide.Store className="w-4 h-4" />
                  </div>
                  <span className="text-[9px] text-indigo-300 font-bold mt-1 block">中央智仓</span>
                </div>

                <div className="flex-1 px-1 text-center relative">
                  <Lucide.ArrowRight className="w-4 h-4 text-emerald-500/50 mx-auto animate-pulse" />
                  <span className="text-[8px] text-slate-500 font-mono block absolute -top-3 left-1/2 -translate-x-1/2">自动API流</span>
                </div>

                <div className="text-center">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center mx-auto text-emerald-400">
                    <Lucide.ShoppingBag className="w-4 h-4" />
                  </div>
                  <span className="text-[9px] text-slate-400 mt-1 block">全网店铺</span>
                </div>
              </div>
            </div>

            {/* AI Diagnostics scroll container */}
            <div className="flex-1 overflow-y-auto space-y-3 font-normal text-xs pr-1 leading-relaxed text-slate-300 select-text max-h-[300px]">
              {aiOutput ? (
                <div className="bg-white/5 border border-white/10 p-3.5 rounded-lg space-y-3 prose prose-invert prose-xs">
                  <div className="flex items-center gap-1.5 text-indigo-400 font-bold border-b border-white/5 pb-1">
                    <Lucide.Sparkles className="w-3.5 h-3.5 text-indigo-400 fill-indigo-400/20" />
                    <span>针对 {selectedProduct?.sku} 的 AI 快速订单决策</span>
                  </div>
                  <div className="whitespace-pre-line text-[11px] font-mono leading-relaxed text-slate-200">
                    {aiOutput}
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center space-y-2">
                  <Lucide.BrainCircuit className="w-8 h-8 text-slate-600 stroke-1" />
                  <p className="font-semibold text-slate-400 text-xs">等待快速分析指令...</p>
                  <p className="text-[10px] text-slate-600 max-w-[180px]">
                    在左侧列表中任选一款 DOH 紧张或重点商品，点击 **“AI 决策”** 即可直接由模型生成采购配货建议。
                  </p>
                </div>
              )}
            </div>
          </div>

          {aiOutput && (
            <div className="pt-3 border-t border-white/10 flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(aiOutput);
                  alert("采购分析建议已复制到剪贴板！");
                }}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <Lucide.Copy className="w-3.5 h-3.5" />
                复制采购建议大纲
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
