import React, { useState, useEffect } from "react";
import * as Lucide from "lucide-react";
import { GeneralEmployee } from "../types";
import { withAdminToken } from "../utils/adminAuth";

interface GeneralHRTabProps {
  isAILoading: boolean;
  onRunGeneralHRAI: (name: string, department: string, role: string, score: number, attendance: number, salary: number, commission: number) => Promise<string>;
  onNavigateToWorkflow: (workflowId: string, prefillInput: Record<string, string>) => void;
}

export default function GeneralHRTab({
  isAILoading,
  onRunGeneralHRAI,
  onNavigateToWorkflow,
}: GeneralHRTabProps) {
  const [employees, setEmployees] = useState<GeneralEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedEmp, setSelectedEmp] = useState<GeneralEmployee | null>(null);
  
  // AI advice state
  const [aiOutput, setAiOutput] = useState<string>("");
  const [loadingAuditId, setLoadingAuditId] = useState<string | null>(null);

  // Form State for editing or adding
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formState, setFormState] = useState<Partial<GeneralEmployee>>({
    name: "",
    department: "运营部",
    role: "",
    baseSalary: 12000,
    performanceScore: 90,
    attendanceRate: 98.0,
    status: "active",
    commissionRate: 1.0,
  });

  // Selected store for commission reference
  const [selectedStoreIndex, setSelectedStoreIndex] = useState<"tmall" | "jd" | "douyin" | "pinduoduo" | "wholesale">("tmall");
  const storeSalesMap = {
    tmall: { name: "天猫旗舰店", monthlySales: 1540800 },
    jd: { name: "京东自营店", monthlySales: 1254000 },
    douyin: { name: "抖音核心小店", monthlySales: 1385000 },
    pinduoduo: { name: "拼多多补贴店", monthlySales: 825000 },
    wholesale: { name: "1688批发客户号", monthlySales: 4850000 },
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/hr/employees");
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
        if (data.length > 0 && !selectedEmp) {
          setSelectedEmp(data[0]);
        }
      }
    } catch (e) {
      console.error("Failed to fetch employees", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (emp: GeneralEmployee) => {
    setFormState(emp);
    setIsEditing(true);
    setShowForm(true);
  };

  const handleAddNewClick = () => {
    setFormState({
      name: "",
      department: "运营部",
      role: "",
      baseSalary: 12000,
      performanceScore: 90,
      attendanceRate: 98.5,
      status: "active",
      commissionRate: 1.0,
    });
    setIsEditing(false);
    setShowForm(true);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/hr/employees/save", {
        method: "POST",
        headers: withAdminToken({ "Content-Type": "application/json" }),
        body: JSON.stringify(formState),
      });
      if (response.ok) {
        const resData = await response.json();
        if (resData.success) {
          setShowForm(false);
          fetchEmployees();
          setSelectedEmp(resData.employee);
        }
      }
    } catch (err) {
      console.error("Failed to save employee", err);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm("您确定要从组织架构册中移除该名员工吗？此操作不可逆。")) return;
    try {
      const response = await fetch("/api/hr/employees/delete", {
        method: "POST",
        headers: withAdminToken({ "Content-Type": "application/json" }),
        body: JSON.stringify({ id }),
      });
      if (response.ok) {
        const resData = await response.json();
        if (resData.success) {
          if (selectedEmp?.id === id) {
            setSelectedEmp(null);
          }
          fetchEmployees();
        }
      }
    } catch (e) {
      console.error("Failed to delete employee", e);
    }
  };

  const handleRunAudit = async (emp: GeneralEmployee) => {
    setLoadingAuditId(emp.id);
    setSelectedEmp(emp);
    try {
      const result = await onRunGeneralHRAI(
        emp.name,
        emp.department,
        emp.role,
        emp.performanceScore,
        emp.attendanceRate,
        emp.baseSalary,
        emp.commissionRate
      );
      setAiOutput(result);
    } catch (error) {
      setAiOutput("智能绩效评研诊断失败，请核对网络环境。");
    } finally {
      setLoadingAuditId(null);
    }
  };

  // Calculations for HR dashboard stats
  const totalEmployees = employees.length;
  const avgPerformance = totalEmployees > 0 
    ? Math.round(employees.reduce((sum, e) => sum + e.performanceScore, 0) / totalEmployees) 
    : 0;
  const avgAttendance = totalEmployees > 0 
    ? (employees.reduce((sum, e) => sum + e.attendanceRate, 0) / totalEmployees).toFixed(1) 
    : "0";

  // Calculate estimated dynamic payroll
  const calculatedPayroll = employees.reduce((sum, e) => {
    const kpiBonus = e.performanceScore * 25;
    const attendanceBonus = e.attendanceRate >= 98 ? 800 : e.attendanceRate >= 95 ? 400 : 0;
    const storeGMV = storeSalesMap.tmall.monthlySales; // default base estimate
    const rawCommission = storeGMV * (e.commissionRate / 100);
    return sum + e.baseSalary + kpiBonus + attendanceBonus + rawCommission;
  }, 0);

  // Selected Employee Payout Calculation Breakdown
  const getPayoutBreakdown = (emp: GeneralEmployee) => {
    const base = emp.baseSalary;
    const kpiBonus = emp.performanceScore * 25; // standard dynamic formula
    const attendanceBonus = emp.attendanceRate >= 98 ? 800 : emp.attendanceRate >= 95 ? 400 : 0;
    
    // Choose selected store monthly sales for performance volume index
    const indexedStore = storeSalesMap[selectedStoreIndex];
    const commission = Math.round(indexedStore.monthlySales * (emp.commissionRate / 100));
    const grossTotal = base + kpiBonus + attendanceBonus + commission;

    return {
      base,
      kpiBonus,
      attendanceBonus,
      commission,
      grossTotal,
      indexedStoreName: indexedStore.name,
      indexedStoreSales: indexedStore.monthlySales
    };
  };

  const filteredEmployees = employees.filter(e => {
    const eName = e?.name || "";
    const eRole = e?.role || "";
    const matchesSearch = eName.toLowerCase().includes(searchTerm.toLowerCase()) || eRole.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = deptFilter === "ALL" || e?.department === deptFilter;
    const matchesStatus = statusFilter === "ALL" || e?.status === statusFilter;
    return matchesSearch && matchesDept && matchesStatus;
  });

  const getDepartmentColor = (dept: string) => {
    switch (dept) {
      case "运营部": return "bg-sky-50 text-sky-700 border-sky-200";
      case "市场部": return "bg-amber-50 text-amber-700 border-amber-200";
      case "技术研发": return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "供应链物流": return "bg-purple-50 text-purple-700 border-purple-200";
      case "财务行政": return "bg-teal-50 text-teal-700 border-teal-200";
      case "客服组": return "bg-rose-50 text-rose-700 border-rose-200";
      default: return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active": return "正式在职";
      case "probation": return "试用考察期";
      case "leave": return "休假暂离";
      default: return "未知";
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "active": return "bg-emerald-50 text-emerald-700 border-emerald-150";
      case "probation": return "bg-amber-50 text-amber-700 border-amber-150";
      case "leave": return "bg-rose-50 text-rose-700 border-rose-150";
      default: return "bg-slate-50 text-slate-700 border-slate-150";
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Lucide.UsersIcon className="w-5 h-5 text-indigo-600" />
            集团人事组织与弹性薪金统筹中心
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            统一监管运营、市场、技术、物流、财务与各店客服的正式/试用花名册。整合电商大促平台业绩流水，对核心团队核发“底薪+绩效分奖+分销投产GMV提成”多维薪资，并借由 AI 生成极具针对性的晋任发展意见。
          </p>
        </div>
        <button
          onClick={handleAddNewClick}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer shrink-0"
        >
          <Lucide.UserPlus className="w-4 h-4" />
          录入新集团组员
        </button>
      </div>

      {/* 2. Key Metrics Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">在册员工总规模</span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <Lucide.Contact className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-gray-900">{totalEmployees}</span>
            <span className="text-xs text-slate-400 ml-1.5">位 在册员工</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">
            正式在职: {employees.filter((e) => e.status === "active").length}人 | 试用期: {employees.filter((e) => e.status === "probation").length}人
          </p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500" />
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">大促弹性总实发薪资 (估算值)</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <Lucide.Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-gray-900">
              ￥{Math.round(calculatedPayroll).toLocaleString()}
            </span>
            <span className="text-xs text-slate-400 ml-1.5">元 / 月</span>
          </div>
          <p className="text-[10px] text-zinc-500 mt-1.5 flex justify-between">
            <span>包含底薪 + KPI金 + GMV抽提</span>
            <span className="font-semibold text-emerald-600">组织投产平衡</span>
          </p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500" />
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">组织平均绩效考核分</span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <Lucide.TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-indigo-600">{avgPerformance}</span>
            <span className="text-xs text-slate-400 ml-1"> / 100 分</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">整体团队能动性: 优秀水平 (A级)</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500" />
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">平均出勤保障度</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-500">
              <Lucide.CalendarDays className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-gray-900">{avgAttendance}%</span>
            <span className="text-xs text-slate-400 ml-1">出满勤率</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">对冲大促高峰的工时保障稳健</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500" />
        </div>
      </div>

      {/* 3. Main Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Hand: Roster List */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-100">
            <div>
              <h3 className="font-bold text-gray-900 text-sm">集团全员花名册与效能总览</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                实时追溯跨部门关键骨干职务、底薪、出勤及业绩权重。点击行进行薪酬对账及调薪评估。
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="text-xs py-1.5 px-2 bg-gray-50 border border-gray-250 rounded-lg text-gray-600 focus:outline-none"
              >
                <option value="ALL">全部部门</option>
                <option value="运营部">运营部</option>
                <option value="市场部">市场部</option>
                <option value="技术研发">技术研发</option>
                <option value="供应链物流">供应链物流</option>
                <option value="财务行政">财务行政</option>
                <option value="客服组">客服组</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs py-1.5 px-2 bg-gray-50 border border-gray-255 rounded-lg text-gray-600 focus:outline-none"
              >
                <option value="ALL">所有状态</option>
                <option value="active">正式在职</option>
                <option value="probation">试用考察期</option>
                <option value="leave">休假暂离</option>
              </select>

              <div className="relative">
                <Lucide.Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索员工姓名或岗位..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="text-xs pl-8 pr-3 py-1.5 w-44 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-300 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Roster Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-gray-100">
              <thead>
                <tr className="bg-slate-50 text-gray-500 font-semibold select-none">
                  <th className="py-2.5 px-3">集团骨干</th>
                  <th className="py-2.5 px-3">部署部门 / 核心本职</th>
                  <th className="py-2.5 px-3">基础底薪 / 提成比</th>
                  <th className="py-2.5 px-3">本季考勤率</th>
                  <th className="py-2.5 px-3">考核绩点</th>
                  <th className="py-2.5 px-3">在职性质</th>
                  <th className="py-2.5 px-3 text-right">调配机制</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400">
                      <Lucide.Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
                      拼力加载组织档案中...
                    </td>
                  </tr>
                ) : filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400">
                      没有找到契合特定筛选标准的骨干员工档案。
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => {
                    const isSelected = selectedEmp?.id === emp.id;
                    const isAuditLoading = loadingAuditId === emp.id;

                    return (
                      <tr 
                        key={emp.id} 
                        onClick={() => setSelectedEmp(emp)}
                        className={`hover:bg-slate-50/70 transition-colors cursor-pointer ${
                          isSelected ? "bg-indigo-50/45 border-l-2 border-indigo-600" : ""
                        }`}
                      >
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 font-bold text-xs text-indigo-700 flex items-center justify-center">
                              {emp.name.slice(0, 2)}
                            </div>
                            <div>
                              <span className="block font-bold text-gray-800">{emp.name}</span>
                              <span className="block text-[10px] text-gray-400">入职: {emp.joinedDate}</span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-3">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${getDepartmentColor(emp.department)}`}>
                            {emp.department}
                          </span>
                          <span className="block font-medium text-gray-700 mt-1">{emp.role}</span>
                        </td>

                        <td className="py-3.5 px-3 font-mono">
                          <span className="block text-gray-900 font-bold">￥{emp.baseSalary.toLocaleString()}</span>
                          <span className="block text-[10px] text-indigo-600 font-semibold">提点: {emp.commissionRate}%</span>
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-12 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${emp.attendanceRate >= 98 ? "bg-emerald-500" : emp.attendanceRate >= 95 ? "bg-blue-500" : "bg-amber-500"}`}
                                style={{ width: `${Math.min(100, emp.attendanceRate)}%` }}
                              />
                            </div>
                            <span className="font-mono text-slate-700 font-medium">{emp.attendanceRate}%</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-3">
                          <span className={`font-bold font-mono text-sm px-1.5 py-0.5 rounded ${
                            emp.performanceScore >= 90 
                              ? "text-emerald-700 bg-emerald-50" 
                              : emp.performanceScore >= 80 
                              ? "text-blue-700 bg-blue-50" 
                              : "text-amber-700 bg-amber-50"
                          }`}>
                            {emp.performanceScore} 分
                          </span>
                        </td>

                        <td className="py-3.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeColor(emp.status)}`}>
                            {getStatusLabel(emp.status)}
                          </span>
                        </td>

                        <td className="py-3.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleRunAudit(emp)}
                              disabled={isAuditLoading || isAILoading}
                              className={`px-2 py-1 font-bold text-[10px] rounded border transition-colors cursor-pointer ${
                                isAuditLoading
                                  ? "bg-amber-100 text-amber-800 border-amber-200"
                                  : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200"
                              }`}
                              title="获取 AI 对该员工的定制晋升考绩分析"
                            >
                              {isAuditLoading ? "计算中..." : "AI 考评"}
                            </button>

                            <button
                              onClick={() => handleEditClick(emp)}
                              className="px-1.5 py-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded transition-all"
                              title="修改该员工的核心人事和薪水设定"
                            >
                              <Lucide.Edit className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDeleteEmployee(emp.id)}
                              className="px-1.5 py-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                              title="解雇或除名"
                            >
                              <Lucide.Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Hand Column: Dynamic Salary Calculator & AI Appraisal */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Section A: Dynamic Salary Billing Panel */}
          {selectedEmp ? (
            <div className="bg-slate-900 text-white rounded-xl p-5 shadow-xl border border-white/5 space-y-4">
              <div className="border-b border-white/10 pb-2.5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest block">
                    COMPENSATION ANALYSIS ENGINE
                  </span>
                  <h4 className="text-xs font-semibold text-slate-200">
                    大促弹性薪金对账核算舱
                  </h4>
                </div>
                <span className="text-[10px] bg-indigo-600 text-[10px] px-2 py-0.5 rounded font-mono font-bold">
                  平台GMV挂钩
                </span>
              </div>

              <div className="space-y-3.5">
                <div className="flex items-center gap-2 bg-white/5 p-2 rounded-lg border border-white/5">
                  <div className="w-9 h-9 rounded-full bg-indigo-500/10 text-indigo-300 font-bold border border-indigo-500/20 flex items-center justify-center">
                    {selectedEmp.name.slice(0, 2)}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                      {selectedEmp.name}
                      <span className="text-[10px] font-normal text-slate-400">({selectedEmp.role})</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{selectedEmp.department} | 提成比率 {selectedEmp.commissionRate}%</div>
                  </div>
                </div>

                {/* Dropdown for platform commission reference */}
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-medium">1. 指点挂钩挂帅的平台月零售流水 (核算提成):</label>
                  <select
                    value={selectedStoreIndex}
                    onChange={(e) => setSelectedStoreIndex(e.target.value as any)}
                    className="w-full text-xs p-2 bg-white/10 border border-white/15 rounded-lg text-white focus:outline-none cursor-pointer"
                  >
                    <option value="tmall" className="bg-slate-800">1. {storeSalesMap.tmall.name} (月售 ¥1,540,800)</option>
                    <option value="jd" className="bg-slate-800">2. {storeSalesMap.jd.name} (月售 ¥1,254,000)</option>
                    <option value="douyin" className="bg-slate-800">3. {storeSalesMap.douyin.name} (月售 ¥1,385,000)</option>
                    <option value="pinduoduo" className="bg-slate-800">4. {storeSalesMap.pinduoduo.name} (月售 ¥825,000)</option>
                    <option value="wholesale" className="bg-slate-800">5. {storeSalesMap.wholesale.name} (月售 ¥4,850,000)</option>
                  </select>
                </div>

                {/* Multi-component breakdown */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-300">
                    <span>基本岗位固定月薪</span>
                    <span className="font-mono">￥{getPayoutBreakdown(selectedEmp).base.toLocaleString()} 元</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1">
                      绩效提金权重 <span className="text-[9px] text-slate-400">({selectedEmp.performanceScore}分 × 25元)</span>
                    </span>
                    <span className="font-mono text-emerald-400">+￥{getPayoutBreakdown(selectedEmp).kpiBonus.toLocaleString()} 元</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1">
                      大促高出勤津贴 <span className="text-[9px] text-slate-400">(出勤率 {selectedEmp.attendanceRate}%)</span>
                    </span>
                    <span className="font-mono text-emerald-400">+￥{getPayoutBreakdown(selectedEmp).attendanceBonus.toLocaleString()} 元</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1">
                      GMV 弹性销售佣金 <span className="text-[9px] text-slate-400">({selectedEmp.commissionRate}% 扣点比例)</span>
                    </span>
                    <span className="font-mono text-emerald-400">+￥{getPayoutBreakdown(selectedEmp).commission.toLocaleString()} 元</span>
                  </div>

                  <div className="border-t border-white/10 pt-2.5 flex items-center justify-between font-bold text-slate-100 text-sm">
                    <span className="text-indigo-400">应发薪金总包 (税前)</span>
                    <span className="font-mono text-yellow-400 text-lg">
                      ￥{getPayoutBreakdown(selectedEmp).grossTotal.toLocaleString()} 元
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 text-white rounded-xl p-5 text-center py-10 text-xs border border-white/5 text-slate-400">
              <Lucide.Coins className="w-8 h-8 text-slate-600 mx-auto stroke-1 mb-2" />
              <span>请选择名录里的任一员工，即可在此处自动核算其在特定店铺流水下的多维综合税前薪酬、佣金抽成。</span>
            </div>
          )}

          {/* Section B: AI Appraisal Log Column */}
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-4">
            <span className="text-[10px] text-indigo-600 font-extrabold uppercase tracking-widest block">
              AI PERFORMANCE DIRECTIVE
            </span>
            <div className="flex items-center gap-2 border-b border-gray-50 pb-2">
              <Lucide.Award className="w-4 h-4 text-indigo-500" />
              <h4 className="text-xs font-bold text-gray-800">
                企业人力资源智能考绩官
              </h4>
            </div>

            <div className="text-xs space-y-3 leading-relaxed text-gray-600 max-h-[300px] overflow-y-auto pr-1">
              {aiOutput ? (
                <div className="bg-slate-50 border border-indigo-50 p-4 rounded-lg text-slate-800 space-y-3 font-sans">
                  <div className="flex items-center gap-2 border-b border-indigo-100 pb-1.5 mb-1.5">
                    <Lucide.Sparkles className="w-3.5 h-3.5 text-indigo-600 fill-indigo-600/10" />
                    <span className="font-bold text-indigo-900 text-xs">针对 {selectedEmp?.name} 的 AI 潜能与改进书</span>
                  </div>
                  <div className="whitespace-pre-line text-[11px] font-mono leading-relaxed text-slate-700">
                    {aiOutput}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400 space-y-2">
                  <Lucide.Sparkles className="w-8 h-8 text-slate-350 stroke-1 mx-auto" />
                  <p className="font-semibold text-xs text-slate-400">等待快速组织诊断评估...</p>
                  <p className="text-[10px] text-zinc-400 max-w-[220px] mx-auto text-center">
                    在左侧骨干列表特定代表行上，点击 **“AI 考评”** 按钮。首席 CHO 即可为该员工整合考核与薪资数据，秒级输出高水准职业规划大明纲。
                  </p>
                </div>
              )}
            </div>

            {aiOutput && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(aiOutput);
                  alert("AI 诊断大纲已成功复制！");
                }}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <Lucide.Copy className="w-3.5 h-3.5" />
                复制此员工晋用改进大纲
              </button>
            )}
          </div>
        </div>

      </div>

      {/* 4. Overlay edit/add model dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-50 px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <Lucide.UserCheck className="w-4 h-4 text-indigo-600" />
                {isEditing ? `修改员工信息：${formState.name}` : "新进集团组员行政录入"}
              </h4>
              <button 
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600 transition-all cursor-pointer"
              >
                <Lucide.X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 block">员工姓名</label>
                  <input
                    type="text"
                    required
                    value={formState.name || ""}
                    onChange={(e) => setFormState(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full text-xs p-2.5 border border-gray-200 rounded-lg bg-gray-50/50 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    placeholder="例如：陈强"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 block">所属职责部门</label>
                  <select
                    value={formState.department || "运营部"}
                    onChange={(e) => setFormState(prev => ({ ...prev, department: e.target.value as any }))}
                    className="w-full text-xs p-2.5 border border-gray-200 rounded-lg bg-gray-50/50 focus:outline-none"
                  >
                    <option value="运营部">运营部</option>
                    <option value="市场部">市场部</option>
                    <option value="技术研发">技术研发</option>
                    <option value="供应链物流">供应链物流</option>
                    <option value="财务行政">财务行政</option>
                    <option value="客服组">客服组</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600 block">担任核心岗位 / 本职</label>
                <input
                  type="text"
                  required
                  value={formState.role || ""}
                  onChange={(e) => setFormState(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full text-xs p-2.5 border border-gray-200 rounded-lg bg-gray-50/50 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  placeholder="例如：高级信息流竞价投放师"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 block">每月岗位基础底薪 (元)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={formState.baseSalary || ""}
                    onChange={(e) => setFormState(prev => ({ ...prev, baseSalary: Number(e.target.value) }))}
                    className="w-full text-xs p-2.5 border border-gray-200 rounded-lg bg-gray-50/50 focus:outline-none font-mono"
                    placeholder="底薪金额，例如 15000"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 block">销售业绩薪酬提成比 (%)</label>
                  <input
                    type="number"
                    required
                    step={0.1}
                    min={0}
                    max={100}
                    value={formState.commissionRate ?? 1.0}
                    onChange={(e) => setFormState(prev => ({ ...prev, commissionRate: Number(e.target.value) }))}
                    className="w-full text-xs p-2.5 border border-gray-200 rounded-lg bg-gray-50/50 focus:outline-none font-mono"
                    placeholder="提点比率，例如 1.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 block">考核绩效绩分 (0-100)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={formState.performanceScore ?? 90}
                    onChange={(e) => setFormState(prev => ({ ...prev, performanceScore: Number(e.target.value) }))}
                    className="w-full text-xs p-2.5 border border-gray-200 rounded-lg bg-gray-50/50 focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 block">常规出勤备工率 (%)</label>
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    max={100}
                    value={formState.attendanceRate ?? 98.5}
                    onChange={(e) => setFormState(prev => ({ ...prev, attendanceRate: Number(e.target.value) }))}
                    className="w-full text-xs p-2.5 border border-gray-200 rounded-lg bg-gray-50/50 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 block">入籍执业日期</label>
                  <input
                    type="date"
                    required
                    value={formState.joinedDate || new Date().toISOString().split('T')[0]}
                    onChange={(e) => setFormState(prev => ({ ...prev, joinedDate: e.target.value }))}
                    className="w-full text-xs p-2.5 border border-gray-200 rounded-lg bg-gray-50/50 focus:outline-none text-gray-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 block">聘用性质地位</label>
                  <select
                    value={formState.status || "active"}
                    onChange={(e) => setFormState(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full text-xs p-2.5 border border-gray-200 rounded-lg bg-gray-50/50 focus:outline-none"
                  >
                    <option value="active">正式在职</option>
                    <option value="probation">试用检测期</option>
                    <option value="leave">暂时放假中</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-gray-250 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-50 cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer"
                >
                  保存档案
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
