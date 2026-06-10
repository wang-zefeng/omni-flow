import React, { useState } from "react";
import * as Lucide from "lucide-react";
import { HRSupportStaff } from "../types";

interface HRTabProps {
  staffList: HRSupportStaff[];
  isAILoading: boolean;
  onRunHRAI: (staffName: string, role: string, score: number, tickets: number) => Promise<string>;
  onNavigateToWorkflow: (workflowId: string, prefillInput: Record<string, string>) => void;
}

export default function HRTab({
  staffList,
  isAILoading,
  onRunHRAI,
  onNavigateToWorkflow,
}: HRTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "online" | "break" | "offline">("ALL");
  const [selectedStaff, setSelectedStaff] = useState<HRSupportStaff | null>(staffList[0] || null);
  const [aiOutput, setAiOutput] = useState<string>("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Filter roster
  const filteredStaff = staffList.filter(s => {
    const sName = s?.name || "";
    const sRole = s?.role || "";
    const matchesSearch = sName.toLowerCase().includes(searchTerm.toLowerCase()) || sRole.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || s?.onlineStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleRunHRAI = async (staff: HRSupportStaff) => {
    setLoadingId(staff.id);
    try {
      const response = await onRunHRAI(staff.name, staff.role, staff.satisfactionRate, staff.resolvedTicketsToday);
      setAiOutput(response);
      setSelectedStaff(staff);
    } catch (e) {
      setAiOutput("AI KPI 智能考评生成失败，请检查密钥环境或重试。");
    } finally {
      setLoadingId(null);
    }
  };

  const getStatusColor = (status: "online" | "break" | "offline") => {
    switch (status) {
      case "online": return "bg-emerald-500";
      case "break": return "bg-amber-500";
      case "offline": return "bg-slate-400";
    }
  };

  const getStatusLabel = (status: "online" | "break" | "offline") => {
    switch (status) {
      case "online": return "实时值守中";
      case "break": return "小休/会签";
      case "offline": return "离线/轮空";
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Hero Panel */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Lucide.Users className="w-5 h-5 text-indigo-600" />
            客服绩效监控与人事调度治理中心
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            追踪全平台商家客服（天猫三秒达、拼多多五分钟应答率）在线客服值班、处理单量、客户评分。可一键生成绩效考评词与排班策略。
          </p>
        </div>
        <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-lg border border-slate-100 shrink-0">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <div className="text-xs text-slate-600">
            <span className="font-semibold block">实时客诉排班对账组已就绪</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">多店客服均秒回响应速度 14.5s</span>
          </div>
        </div>
      </div>

      {/* 2. Top-level KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">总执勤名册总人数</span>
            <div className="p-2 rounded-lg bg-indigo-50/50 text-indigo-600">
              <Lucide.Contact className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-gray-900">
              {staffList.length}
            </span>
            <span className="text-xs text-slate-400 ml-1.5">员 执业</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">在线值守中: {staffList.filter(s => s.onlineStatus === "online").length}人</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500" />
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">平均客服消单应答速度</span>
            <div className="p-2 rounded-lg bg-blue-50/50 text-blue-600">
              <Lucide.Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-gray-900">
              {(staffList.reduce((acc, curr) => acc + curr.avgResponseSeconds, 0) / staffList.length).toFixed(1)}
            </span>
            <span className="text-xs text-slate-400 ml-1.5">秒/单 响应</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 text-emerald-600 font-semibold">大幅优于平台天猫行业 30秒警戒线</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500" />
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">累计已解决客诉量今日</span>
            <div className="p-2 rounded-lg bg-green-50/50 text-green-600">
              <Lucide.UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-emerald-600">
              {staffList.reduce((acc, curr) => acc + curr.resolvedTicketsToday, 0)}
            </span>
            <span className="text-xs text-slate-400 ml-1.5">次 闭单已决</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 flex justify-between items-center">
            <span>AI 辅助答写渗透率</span>
            <span className="font-semibold text-indigo-600">
              {Math.round((staffList.reduce((acc, curr) => acc + curr.aiAssistedCount, 0) / staffList.reduce((acc, curr) => acc + curr.resolvedTicketsToday, 0)) * 100)}%
            </span>
          </p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-green-500" />
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">全渠道平均好评满意度</span>
            <div className="p-2 rounded-lg bg-amber-50/50 text-amber-500">
              <Lucide.HeartHandshake className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-gray-900">
              {(staffList.reduce((acc, curr) => acc + curr.satisfactionRate, 0) / staffList.length).toFixed(1)}%
            </span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">五星好评占比 (95% 达标)</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500" />
        </div>
      </div>

      {/* 3. Main Employee Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Duty List */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <div>
              <h3 className="font-bold text-gray-900 text-sm">客服及运营名录执勤监视窗</h3>
              <p className="text-xs text-gray-400">
                可搜索拼写、筛选实时值班状态。点击“智能绩效”即刻基于其响应实操数据草拟多维度激励考评。
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="text-xs py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-600"
              >
                <option value="ALL">全部执照</option>
                <option value="online">值班在线</option>
                <option value="break">小休会议</option>
                <option value="offline">暂离轮休</option>
              </select>

              <div className="relative">
                <Lucide.Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索人名或岗位..."
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
                  <th className="py-2.5 px-3">特训组员名称</th>
                  <th className="py-2.5 px-3">主责岗 / 平台组</th>
                  <th className="py-2.5 px-3">实时状态</th>
                  <th className="py-2.5 px-3">日决客诉量</th>
                  <th className="py-2.5 px-3">三秒响应度 (SLA)</th>
                  <th className="py-2.5 px-3">好评率 (CSAT)</th>
                  <th className="py-2.5 px-3 text-right">大厂智库</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStaff.map((s) => {
                  const isWorking = loadingId === s.id;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-100 border border-indigo-100 font-bold text-xs text-indigo-700 flex items-center justify-center">
                            {s.name.slice(0, 2)}
                          </div>
                          <div>
                            <span className="block font-semibold text-gray-800">{s.name}</span>
                            <span className="block text-[10px] text-gray-400">工号: CS-{s.id}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="block font-medium text-gray-700">{s.role}</span>
                        <span className="block text-[10px] text-gray-400">{s.platformGroup}</span>
                      </td>

                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${getStatusColor(s.onlineStatus)}`} />
                          <span className="text-[11px] text-gray-600 font-medium">
                            {getStatusLabel(s.onlineStatus)}
                          </span>
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-mono text-gray-900 font-semibold">{s.resolvedTicketsToday} 件</span>
                        <div className="text-[9px] text-gray-400">AI提效: {s.aiAssistedCount}单</div>
                      </td>

                      <td className="py-3 px-3 font-mono font-medium text-slate-700">
                        {s.avgResponseSeconds}s
                      </td>

                      <td className="py-3 px-3">
                        <span className={`font-bold font-mono ${
                          s.satisfactionRate >= 98 ? "text-emerald-600" : "text-amber-600"
                        }`}>
                          {s.satisfactionRate}%
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleRunHRAI(s)}
                            disabled={isWorking || isAILoading}
                            className={`px-2 py-1 font-semibold text-[10px] rounded border transition-colors cursor-pointer ${
                              isWorking
                                ? "bg-amber-100 text-amber-800 border-amber-200"
                                : "bg-white text-indigo-700 hover:bg-slate-50 border-indigo-200"
                            }`}
                          >
                            {isWorking ? "考评中..." : "绩效评定"}
                          </button>

                          <button
                            onClick={() => {
                              onNavigateToWorkflow("customer-reply", {
                                customerMsg: `我是客服主管。请为本组金牌话术员 ${s.name} 精设几套天猫延迟发货或者售后尺码争议下的全万能亲合客服回复话术参考，以此提升全店的满意度评分。`,
                                category: "常态售后退换",
                                tone: "friendly"
                              });
                            }}
                            className="bg-slate-100 text-slate-700 hover:bg-slate-200 px-1 py-1 rounded text-[10px] font-bold"
                            title="前往客服优化AI回复工作流"
                          >
                            话术特训
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

        {/* Right Side Column */}
        <div className="lg:col-span-4 bg-slate-900 rounded-xl p-5 text-white shadow-xl flex flex-col justify-between overflow-hidden">
          <div className="space-y-4 flex flex-col h-full overflow-hidden">
            <div className="border-b border-white/10 pb-2 shrink-0">
              <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block">
                ROSTER SCHEDULING ADVISOR
              </span>
              <h4 className="text-xs font-semibold text-slate-200">
                智能值巡考评与大促排班对账
              </h4>
            </div>

            {/* Simulated shift scheduler layout */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/10 shrink-0 space-y-1.5 text-xs text-slate-300">
              <span className="text-[10px] text-slate-400 font-semibold block mb-1">今日大促波峰三班倒在线分布</span>
              
              <div className="space-y-1.5 font-sans">
                <div className="flex items-center justify-between text-[11px] bg-white/5 px-2 py-1.5 rounded border border-white/5">
                  <span className="font-semibold text-indigo-300">☀️ 白班组 (09:00 - 17:00)</span>
                  <span className="text-slate-400">8人在线 / 完成420单</span>
                </div>
                <div className="flex items-center justify-between text-[11px] bg-white/5 px-2 py-1.5 rounded border border-white/5 animate-pulse">
                  <span className="font-semibold text-amber-400">🌆 黄金夜班 (17:00 - 24:00)</span>
                  <span className="text-slate-400">12人在线 / 承接高峰</span>
                </div>
                <div className="flex items-center justify-between text-[11px] bg-white/5 px-2 py-1.5 rounded border border-white/5">
                  <span className="font-semibold text-purple-400">🌙 深夜守灵班 (00:00 - 09:00)</span>
                  <span className="text-slate-400">32s平均延时 / 2人在线</span>
                </div>
              </div>
            </div>

            {/* AI Diagnostics scroll container */}
            <div className="flex-1 overflow-y-auto space-y-3 font-normal text-xs pr-1 leading-relaxed text-slate-300 select-text max-h-[290px]">
              {aiOutput ? (
                <div className="bg-white/5 border border-white/10 p-3.5 rounded-lg space-y-3 prose prose-invert prose-xs">
                  <div className="flex items-center gap-1.5 text-indigo-400 font-bold border-b border-white/5 pb-1">
                    <Lucide.Sparkles className="w-3.5 h-3.5 text-indigo-400 fill-indigo-400/20" />
                    <span>针对 {selectedStaff?.name} 的 AI KPI 深度考评意见</span>
                  </div>
                  <div className="whitespace-pre-line text-[11px] font-mono leading-relaxed text-slate-200">
                    {aiOutput}
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center space-y-2">
                  <Lucide.UserCheck className="w-8 h-8 text-slate-600 stroke-1" />
                  <p className="font-semibold text-slate-400 text-xs">等待快速工学绩点建议...</p>
                  <p className="text-[10px] text-slate-600 max-w-[190px]">
                    在左侧员工行点击 **“绩效评定”** ，AI 即可根据其客诉妥决数、满意评分以及AI提效协助指教，起草符合阿里/京东运营的高质感绩效考评建议。
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
                  alert("绩效大纲已成功复制到剪贴板！");
                }}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <Lucide.Copy className="w-3.5 h-3.5" />
                复制绩效评价草案
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
