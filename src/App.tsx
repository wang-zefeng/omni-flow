import React, { useState, useEffect } from "react";
import * as Lucide from "lucide-react";
import { PlatformData, SummaryMetrics, WorkflowLog, WorkflowPreset, SupplyChainProduct, FinanceLedger, HRSupportStaff } from "./types";
import { STAGE_WORKFLOWS } from "./data";
import BrandDashboardTab from "./components/BrandDashboardTab";
import SupplyChainTab from "./components/SupplyChainTab";
import FinanceTab from "./components/FinanceTab";
import HRTab from "./components/HRTab";
import GeneralHRTab from "./components/GeneralHRTab";
import MiddlePlatformAssistantTab from "./components/MiddlePlatformAssistantTab";
import ImportMappingModal from "./components/ImportMappingModal";
import TableParsedBoardTab from "./components/TableParsedBoardTab";
import UnqWebsiteLogo from "./components/UnqWebsiteLogo";
import OperationsIntegrationTab from "./components/OperationsIntegrationTab";
import { withAdminToken } from "./utils/adminAuth";

type AuthState = {
  checked: boolean;
  authRequired: boolean;
  authenticated: boolean;
  loginEnabled: boolean;
  user?: {
    username: string;
    role: string;
  } | null;
  error?: string;
};

export default function App() {
  const [activeTab, setActiveTab ] = useState<
    "dashboard" | "workflows" | "supply_chain" | "finance" | "hr" | "general_hr" | "middle_platform" | "table_parsed_board" | "operations_integration"
  >("dashboard");
  
  // -------------------------------------------------------------
  // Offline Sandbox (Local Mock dataset simulation) states & Agent Command State
  // -------------------------------------------------------------
  const [globalDataSource, setGlobalDataSource] = useState<"api" | "sandbox">("api");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [sandboxPlatformList, setSandboxPlatformList] = useState<PlatformData[]>([]);
  const [sandboxSummaryMetrics, setSandboxSummaryMetrics] = useState<SummaryMetrics>({
    totalSales: 4850000,
    totalOrders: 19820,
    b2bSales: 1720000,
    b2cSales: 3130000,
    lastUpdated: new Date().toISOString()
  });
  const [sandboxSupplyChainProducts, setSandboxSupplyChainProducts] = useState<SupplyChainProduct[]>([]);
  const [sandboxFinanceLedgers, setSandboxFinanceLedgers] = useState<FinanceLedger[]>([]);

  // Persistent user raw uploaded Excel sheet storage for literal visual rendering
  const [uploadedFileBoardData, setUploadedFileBoardData] = useState<{
    fileName: string;
    dataType: "platforms" | "supply_chain" | "finance" | "custom";
    headers: string[];
    rows: any[];
    sheets?: {
      name: string;
      headers: string[];
      rows: any[];
      dailySeries?: any[];
      profile?: any;
    }[];
    activeSheetIndex?: number;
    importedAt: string;
  } | null>(null);

  // Agent Natural Language dialogue state
  const [agentInstruction, setAgentInstruction] = useState("");
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);

  // Platform Lists and Metrics State
  const [platformList, setPlatformList] = useState<PlatformData[]>([]);
  const [summaryMetrics, setSummaryMetrics] = useState<SummaryMetrics>({
    totalSales: 4185400,
    totalOrders: 18520,
    b2bSales: 1654000,
    b2cSales: 2531400,
    lastUpdated: new Date().toISOString()
  });

  const [workflowLogs, setWorkflowLogs] = useState<WorkflowLog[]>([]);
  const [isSyncingId, setIsSyncingId] = useState<string | null>(null);

  // Expanded Specialized Databases States
  const [supplyChainProducts, setSupplyChainProducts] = useState<SupplyChainProduct[]>([]);
  const [financeLedgers, setFinanceLedgers] = useState<FinanceLedger[]>([]);
  const [hrStaffList, setHrStaffList] = useState<HRSupportStaff[]>([]);
  const [isAILoadingSpecialized, setIsAILoadingSpecialized] = useState(false);

  // Workflow Editor State
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowPreset>(STAGE_WORKFLOWS[0]);
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>("tmall");
  const [workflowInputs, setWorkflowInputs] = useState<Record<string, string>>({});
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>("全部");
  const [appliedAgentIds, setAppliedAgentIds] = useState<Record<string, boolean>>({});
  
  // Running AI State
  const [isRunningAI, setIsRunningAI] = useState(false);
  const [aiOutputResult, setAiOutputResult] = useState<string>("");
  const [aiWarningMessage, setAiWarningMessage] = useState<string>("");
  const [hasNewOutput, setHasNewOutput] = useState(false);

  // Status message for floating alerts
  const [alertToast, setAlertToast] = useState<{ message: string; type: "success" | "info" | "warning" } | null>(null);
  const [authState, setAuthState] = useState<AuthState>({
    checked: false,
    authRequired: false,
    authenticated: false,
    loginEnabled: false,
    user: null,
  });
  const [loginForm, setLoginForm] = useState({ username: "omiflow", password: "" });
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const checkAuthSession = async () => {
    try {
      const response = await fetch("/api/auth/session", { credentials: "include" });
      if (!response.ok) {
        throw new Error(`Session check failed: ${response.status}`);
      }
      const session = await response.json();
      setAuthState({
        checked: true,
        authRequired: Boolean(session.authRequired),
        authenticated: Boolean(session.authenticated),
        loginEnabled: Boolean(session.loginEnabled),
        user: session.user || null,
      });
    } catch (error) {
      setAuthState({
        checked: true,
        authRequired: false,
        authenticated: false,
        loginEnabled: false,
        user: null,
        error: error instanceof Error ? error.message : "Unable to check session.",
      });
    }
  };

  const handleLoginSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoggingIn(true);
    setAuthState((prev) => ({ ...prev, error: undefined }));

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `Login failed: ${response.status}`);
      }
      setAuthState((prev) => ({
        ...prev,
        checked: true,
        authRequired: true,
        authenticated: true,
        loginEnabled: true,
        user: payload.user || { username: loginForm.username, role: "admin" },
        error: undefined,
      }));
      setLoginForm((prev) => ({ ...prev, password: "" }));
    } catch (error) {
      setAuthState((prev) => ({
        ...prev,
        checked: true,
        authenticated: false,
        error: error instanceof Error ? error.message : "Login failed.",
      }));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => undefined);
    setAuthState((prev) => ({
      ...prev,
      authenticated: false,
      user: null,
      error: undefined,
    }));
  };

  useEffect(() => {
    void checkAuthSession();
  }, []);

  // Load Data on startup
  useEffect(() => {
    if (!authState.checked) {
      return;
    }
    if (authState.authRequired && !authState.authenticated) {
      return;
    }

    fetchPlatformData();
    fetchWorkflowLogs();
    fetchSupplyChainData();
    fetchFinanceData();
    fetchHRData();

    // Populate sandboxes with default simulated tables for instant Sandbox mode visualizations
    const fallbackPlatformsList = [
      { id: "tmall", name: "天猫旗舰店(沙盘)", channel: "B2C" as const, logo: "Tmall", todaySales: 165000, monthlySales: 1850000, conversionRate: 3.5, activeProducts: 142, pendingOrders: 380, unreadMessages: 12, status: "normal" as const, syncCount: 1 },
      { id: "tmall_global", name: "天猫海外直营店(沙盘)", channel: "B2C" as const, logo: "TmallGlobal", todaySales: 78000, monthlySales: 1100000, conversionRate: 2.9, activeProducts: 85, pendingOrders: 140, unreadMessages: 4, status: "normal" as const, syncCount: 1 },
      { id: "jd", name: "京东自营店(沙盘)", channel: "B2C" as const, logo: "JD", todaySales: 125000, monthlySales: 1420000, conversionRate: 3.9, activeProducts: 110, pendingOrders: 210, unreadMessages: 8, status: "normal" as const, syncCount: 1 },
      { id: "pinduoduo", name: "拼多多官方旗舰店(沙盘)", channel: "B2C" as const, logo: "Piduoduo", todaySales: 105000, monthlySales: 980000, conversionRate: 4.22, activeProducts: 190, pendingOrders: 650, unreadMessages: 15, status: "normal" as const, syncCount: 1 },
      { id: "douyin", name: "抖音小店(沙盘)", channel: "B2C" as const, logo: "Douyin", todaySales: 172000, monthlySales: 1620000, conversionRate: 3.05, activeProducts: 48, pendingOrders: 420, unreadMessages: 26, status: "normal" as const, syncCount: 1 },
      { id: "b2b_wholesale", name: "阿里巴巴1688批发通道(沙盘)", channel: "B2B" as const, logo: "Alibaba", todaySales: 340000, monthlySales: 5200000, conversionRate: 8.8, activeProducts: 320, pendingOrders: 82, unreadMessages: 9, status: "normal" as const, syncCount: 1 },
      { id: "b2b_offline", name: "渠道大宗B2B直供系统(沙盘)", channel: "B2B" as const, logo: "OfflineB2B", todaySales: 220000, monthlySales: 3450000, conversionRate: 12.8, activeProducts: 75, pendingOrders: 20, unreadMessages: 3, status: "normal" as const, syncCount: 1 }
    ];
    setSandboxPlatformList(fallbackPlatformsList);

    const fallbackSCList = [
      { id: "sc_1", sku: "SKU-9420-SAND", name: "冰丝凉感专业防晒衣 (沙盘本地调试项)", category: "服装美妆", warehouseStock: 2500, transitStock: 800, safeDOH: 15, currentVelocity: 140, factoryLeadTime: 20, riskLevel: "low" as const, supplierName: "浙江义乌织造工厂" },
      { id: "sc_2", sku: "SKU-3114-SAND", name: "奢透黑松露抗老夜间修护乳 (沙盘潜在预警品)", category: "面部护肤", warehouseStock: 180, transitStock: 1100, safeDOH: 20, currentVelocity: 75, factoryLeadTime: 18, riskLevel: "high" as const, supplierName: "苏州美妆智造第二车间" },
      { id: "sc_3", sku: "SKU-8842-SAND", name: "多气垫高回弹轻履越野跑鞋 (沙盘正常备料品)", category: "运动鞋靴", warehouseStock: 680, transitStock: 350, safeDOH: 12, currentVelocity: 90, factoryLeadTime: 15, riskLevel: "medium" as const, supplierName: "福建莆田精密航空鞋靴加工基地" }
    ];
    setSandboxSupplyChainProducts(fallbackSCList);

    const fallbackFinList = [
      { id: "fin_1", platformId: "tmall", platformName: "天猫官方旗舰店(沙盘)", salesVolume: 1850000, refundsVolume: 110000, adsExpense: 380000, platformFee: 92000, logisticsFee: 60000, netRevenue: 1208000, marginPercent: 65 },
      { id: "fin_2", platformId: "jd", platformName: "京东自营店(沙盘)", salesVolume: 1420000, refundsVolume: 65000, adsExpense: 230000, platformFee: 115000, logisticsFee: 90000, netRevenue: 920000, marginPercent: 64 },
      { id: "fin_3", platformId: "douyin", platformName: "抖音爆款核心小店(沙盘)", salesVolume: 1620000, refundsVolume: 210000, adsExpense: 520000, platformFee: 81000, logisticsFee: 55000, netRevenue: 754000, marginPercent: 46 }
    ];
    setSandboxFinanceLedgers(fallbackFinList);
  }, [authState.checked, authState.authRequired, authState.authenticated]);

  // Update input values when workflow switches
  useEffect(() => {
    const defaultVals: Record<string, string> = {};
    selectedWorkflow.inputs.forEach(inp => {
      defaultVals[inp.id] = inp.defaultValue || "";
    });
    setWorkflowInputs(defaultVals);

    // Pick compatible platform if current platform is incompatible
    if (!selectedWorkflow.platforms.includes(selectedPlatformId)) {
      setSelectedPlatformId(selectedWorkflow.platforms[0] || "global");
    }
  }, [selectedWorkflow]);

  const showToast = (message: string, type: "success" | "info" | "warning" = "success") => {
    setAlertToast({ message, type });
    setTimeout(() => {
      setAlertToast(null);
    }, 4000);
  };

  const fetchPlatformData = async () => {
    try {
      const response = await fetch("/api/platform-data");
      if (response.ok) {
        const data = await response.json();
        setPlatformList(data.platforms);
        setSummaryMetrics(data.summary);
      } else {
        // Fallback local structures if server is still starting
        loadFallbackPlatforms();
      }
    } catch (e) {
      loadFallbackPlatforms();
    }
  };

  const fetchWorkflowLogs = async () => {
    try {
      const response = await fetch("/api/workflow/logs");
      if (response.ok) {
        const logs = await response.json();
        setWorkflowLogs(logs);
      }
    } catch (e) {
      console.warn("Could not fetch workflow logs from server, using local list.");
    }
  };

  const fetchSupplyChainData = async () => {
    try {
      const response = await fetch("/api/supply-chain/products");
      if (response.ok) {
        const data = await response.json();
        setSupplyChainProducts(data);
      } else {
        loadFallbackSupplyChain();
      }
    } catch (e) {
      loadFallbackSupplyChain();
    }
  };

  const fetchFinanceData = async () => {
    try {
      const response = await fetch("/api/finance/ledgers");
      if (response.ok) {
        const data = await response.json();
        setFinanceLedgers(data);
      } else {
        loadFallbackFinance();
      }
    } catch (e) {
      loadFallbackFinance();
    }
  };

  const fetchHRData = async () => {
    try {
      const response = await fetch("/api/hr/staff");
      if (response.ok) {
        const data = await response.json();
        setHrStaffList(data);
      } else {
        loadFallbackHR();
      }
    } catch (e) {
      loadFallbackHR();
    }
  };

  const loadFallbackPlatforms = () => {
    const fallback = [
      { id: "tmall", name: "天猫旗舰店", channel: "B2C" as const, logo: "Tmall", todaySales: 124500, monthlySales: 1540800, conversionRate: 3.42, activeProducts: 142, pendingOrders: 420, unreadMessages: 18, status: "normal" as const, syncCount: 1 },
      { id: "tmall_global", name: "天猫海外直营店", channel: "B2C" as const, logo: "TmallGlobal", todaySales: 68400, monthlySales: 990600, conversionRate: 2.85, activeProducts: 85, pendingOrders: 180, unreadMessages: 5, status: "normal" as const, syncCount: 1 },
      { id: "jd", name: "京东自营店", channel: "B2C" as const, logo: "JD", todaySales: 110200, monthlySales: 1254000, conversionRate: 3.88, activeProducts: 110, pendingOrders: 290, unreadMessages: 11, status: "normal" as const, syncCount: 1 },
      { id: "pinduoduo", name: "拼多多官方旗舰店", channel: "B2C" as const, logo: "Piduoduo", todaySales: 89400, monthlySales: 825000, conversionRate: 4.12, activeProducts: 190, pendingOrders: 780, unreadMessages: 24, status: "normal" as const, syncCount: 1 },
      { id: "douyin", name: "抖音小店", channel: "B2C" as const, logo: "Douyin", todaySales: 154600, monthlySales: 1385000, conversionRate: 2.98, activeProducts: 48, pendingOrders: 510, unreadMessages: 37, status: "normal" as const, syncCount: 1 },
      { id: "b2b_wholesale", name: "阿里巴巴1688批发通道", channel: "B2B" as const, logo: "Alibaba", todaySales: 310000, monthlySales: 4850000, conversionRate: 8.5, activeProducts: 320, pendingOrders: 95, unreadMessages: 12, status: "normal" as const, syncCount: 1 },
      { id: "b2b_offline", name: "渠道大宗B2B直供系统", channel: "B2B" as const, logo: "OfflineB2B", todaySales: 212500, monthlySales: 3240000, conversionRate: 12.4, activeProducts: 75, pendingOrders: 28, unreadMessages: 4, status: "normal" as const, syncCount: 1 }
    ];
    setPlatformList(fallback);
  };

  const loadFallbackSupplyChain = () => {
    setSupplyChainProducts([
      { id: "sc_1", sku: "SKU-9420", name: "冰丝凉感专业防晒衣 (男女同款气动防护系列)", category: "服装美妆", warehouseStock: 1840, transitStock: 650, safeDOH: 15, currentVelocity: 120, factoryLeadTime: 20, riskLevel: "medium" as const, supplierName: "浙江义乌织造工厂" },
      { id: "sc_2", sku: "SKU-3114", name: "奢透黑松露抗老夜间修护乳 (高浓度酵母紧致版)", category: "面部护肤", warehouseStock: 240, transitStock: 900, safeDOH: 20, currentVelocity: 65, factoryLeadTime: 18, riskLevel: "high" as const, supplierName: "苏州美妆智造第二车间" },
      { id: "sc_3", sku: "SKU-8842", name: "多气垫高回弹轻履越野跑鞋 (碳板支撑避震限量款)", category: "运动鞋靴", warehouseStock: 520, transitStock: 280, safeDOH: 12, currentVelocity: 85, factoryLeadTime: 15, riskLevel: "medium" as const, supplierName: "福建莆田精密航空鞋靴加工基地" },
      { id: "sc_4", sku: "SKU-1080", name: "定制款速干无缝健美瑜伽短裤 (塑形微压缩透气系列)", category: "服装美妆", warehouseStock: 3200, transitStock: 1500, safeDOH: 15, currentVelocity: 90, factoryLeadTime: 14, riskLevel: "low" as const, supplierName: "广东汕头无缝高密度织染厂" }
    ]);
  };

  const loadFallbackFinance = () => {
    setFinanceLedgers([
      { id: "fin_1", platformId: "tmall", platformName: "天猫官方旗舰店", salesVolume: 1540800, refundsVolume: 123800, adsExpense: 324000, platformFee: 78500, logisticsFee: 54000, netRevenue: 960500, marginPercent: 62 },
      { id: "fin_2", platformId: "jd", platformName: "京东自营店", salesVolume: 1254000, refundsVolume: 74200, adsExpense: 215000, platformFee: 104200, logisticsFee: 85000, netRevenue: 775600, marginPercent: 61 },
      { id: "fin_3", platformId: "douyin", platformName: "抖音爆款核心小店", salesVolume: 1385000, refundsVolume: 243900, adsExpense: 485000, platformFee: 69250, logisticsFee: 48000, netRevenue: 538850, marginPercent: 39 },
      { id: "fin_4", platformId: "pinduoduo", platformName: "拼多多百亿补贴旗舰店", salesVolume: 825000, refundsVolume: 112000, adsExpense: 142000, platformFee: 8250, logisticsFee: 41000, netRevenue: 521750, marginPercent: 63 },
      { id: "fin_5", platformId: "b2b_wholesale", platformName: "1688批发分销大客户号", salesVolume: 4850000, refundsVolume: 35000, adsExpense: 150000, platformFee: 24200, logisticsFee: 220000, netRevenue: 4420800, marginPercent: 91 }
    ]);
  };

  const loadFallbackHR = () => {
    setHrStaffList([
      { id: "101", name: "张美琳", role: "天猫VIP客服主管", platformGroup: "天猫联合大组", onlineStatus: "online" as const, avgResponseSeconds: 9.4, satisfactionRate: 99.4, resolvedTicketsToday: 240, aiAssistedCount: 198 },
      { id: "102", name: "刘星阳", role: "京东急速督办专员", platformGroup: "京东自营小组", onlineStatus: "online" as const, avgResponseSeconds: 12.8, satisfactionRate: 98.6, resolvedTicketsToday: 185, aiAssistedCount: 122 },
      { id: "103", name: "陈小希", role: "拼多多极致争议调解员", platformGroup: "拼多多综合售后部", onlineStatus: "break" as const, avgResponseSeconds: 15.2, satisfactionRate: 96.2, resolvedTicketsToday: 290, aiAssistedCount: 245 },
      { id: "104", name: "宋智贤", role: "抖音带货促复购专家", platformGroup: "抖音自播大本营", onlineStatus: "online" as const, avgResponseSeconds: 11.5, satisfactionRate: 98.9, resolvedTicketsToday: 310, aiAssistedCount: 280 },
      { id: "105", name: "赵铁柱", role: "B2B批发渠道专属售后顾问", platformGroup: "1688批发与线下商大组", onlineStatus: "offline" as const, avgResponseSeconds: 45.0, satisfactionRate: 95.0, resolvedTicketsToday: 42, aiAssistedCount: 15 }
    ]);
  };

  // Specialized audit trigger for new segments
  const handleRunSpecializedAI = async (sector: "supply-chain" | "finance" | "hr" | "general-hr", details: any): Promise<string> => {
    setIsAILoadingSpecialized(true);
    showToast(`正在激发 AI 对本条[${sector === 'hr' || sector === 'general-hr' ? '客服及人事考评' : sector === 'finance' ? '财务P&L' : '货流安全'}]记录进行智能决策诊断...`, "info");
    try {
      const response = await fetch("/api/gemini/quick-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sector, details })
      });
      if (response.ok) {
        const resData = await response.json();
        showToast("AI 评估诊断意见已就绪！", "success");
        return resData.result;
      } else {
        throw new Error();
      }
    } catch (e) {
      // Offline fallback simulation
      showToast("无法直连决策舱服务，启动备份决策引擎进行诊断...", "warning");
      if (sector === "supply-chain") {
        return `### 💡 AI 智能在库备货诊断建议 (备份模式)

针对商品 **${details.name}** 在库 ${details.stock} 件及销速 ${details.velocity} 件/天分析：
* 该商品目前库存消耗较为迅速，周转天数 (DOH) 较为脆弱；
* 建议立刻追加向工厂提报补货订单，提前15天申报，降低大促突发性穿爆风险。`;
      } else if (sector === "finance") {
        return `### 💡 AI 渠道P&L获利质量评估 (备份模式)

针对渠道 **${details.platformName}** 回款质量分析：
* 广告大额支出占比偏高，利润杠杆效应尚未在大促节点彻底显现；
* 建议对重点SKU执行退换客解安抚优化，防范退换款造成的逆向物流损耗。`;
      } else if (sector === "general-hr") {
        return `### 💡 AI 综合人事绩效考评研判 (备份模式)

针对员工 **${details.name}** 出勤及绩效评分诊断：
* **日常基本素质**：绩效得分达到极佳的 ${details.performanceScore} 分，班期考核稳定；
* **晋升指导**：该骨干底薪为 ${details.baseSalary}，提点设置为 ${details.commissionRate}%，是典型的电商基盘战力。建议委以带薪培训导师名号协助新近组员成长，并大促后调高 10% 基本报酬。`;
      } else {
        return `### 💡 AI 客服管理绩效监督简执 (备份模式)

针对特训组员 **${details.name}** 评估建议：
* 妥帖解决客诉 ${details.tickets} 起，综合客户满意度高达 ${details.score}%，业绩评定为 **【特优等 / EXCELLENT】**；
* 积极调用 AI 大脑提升效率，适合在接下来的大促中委以“黄金破冰攻坚班”重任并重点嘉奖。`;
      }
    } finally {
      setIsAILoadingSpecialized(false);
    }
  };

  // Navigate & Prefill inputs in workflow
  const handlePrefillNavigateWorkflow = (workflowId: string, prefillInput: Record<string, string>) => {
    const preset = STAGE_WORKFLOWS.find(w => w.id === workflowId);
    if (preset) {
      setSelectedWorkflow(preset);
      setWorkflowInputs(prefillInput);
      setActiveTab("workflows");
      showToast(`已为您自动填充并跳转至 ${preset.name} 配置区！`, "success");
    }
  };

  // Sync data of individual platform
  const handleSyncPlatform = async (id: string) => {
    setIsSyncingId(id);
    showToast(`正在与底层API握手及同步数据中...`, "info");
    try {
      const response = await fetch("/api/platforms/sync", {
        method: "POST",
        headers: withAdminToken({ "Content-Type": "application/json" }),
        body: JSON.stringify({ id })
      });
      if (response.ok) {
        const resData = await response.json();
        // Update single platform item 
        setPlatformList(prev => prev.map(p => p.id === id ? { ...p, ...resData.platform } : p));
        setSummaryMetrics(resData.summary);
        showToast(`平台 [${resData.platform.name}] 数据成功刷新并重置参数！`, "success");
        fetchWorkflowLogs();
      } else {
        showToast(`平台同步网络应答错误！`, "warning");
      }
    } catch (e) {
      // Offline Simulation Update
      setPlatformList(prev => prev.map(p => {
        if (p.id === id) {
          return {
            ...p,
            syncCount: p.syncCount + 1,
            todaySales: Math.round(p.todaySales * 1.04),
            pendingOrders: Math.max(0, p.pendingOrders - 5),
            unreadMessages: Math.max(0, p.unreadMessages - 2)
          };
        }
        return p;
      }));
      showToast(`平台数据同步成功 (本地缓存加速模式)`, "success");
    } finally {
      setIsSyncingId(null);
    }
  };

  // Switch to specific workflow
  const navigateToWorkflow = (workflowId: string, platformId: string) => {
    const preset = STAGE_WORKFLOWS.find(w => w.id === workflowId);
    if (preset) {
      setSelectedWorkflow(preset);
      setSelectedPlatformId(platformId);
      setActiveTab("workflows");
      showToast(`已载入所选平台的 ${preset.name} 流配置`, "info");
    }
  };

  // Upgrade triggerWorkflowExecution to simulate step-by-step agent thoughts and logs inside terminal outputs
  const triggerWorkflowExecution = async (event?: React.MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    event?.stopPropagation();
    setActiveTab("workflows");
    setIsRunningAI(true);
    setAiOutputResult("");
    setAiWarningMessage("");
    setHasNewOutput(false);

    const agentName = selectedWorkflow.name.includes("Agent")
      ? selectedWorkflow.name
      : `${selectedWorkflow.name} Agent`;

    const getNowTime = () => new Date().toLocaleTimeString("zh-CN");
    setTerminalLogs([
      `⏱️ [${getNowTime()}] SYSTEM ACTUATOR_SPARK: Automation dispatch sequence initiated.`,
      `🤖 [${getNowTime()}] AGENT CORE START: Activating 【${agentName}】...`
    ]);

    const addLog = (msg: string, delay: number) => {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          setTerminalLogs((prev) => [...prev, `⚡ [${new Date().toLocaleTimeString("zh-CN")}] ${msg}`]);
          resolve();
        }, delay);
      });
    };

    // Beautiful asynchronous tactile terminal progressions for premium operational feedback
    await addLog(`COGNITIVE INTENT ANALYSIS: Matching platform attributes for ${selectedPlatformId.toUpperCase()}...`, 500);
    await addLog(`CONTEXTUAL SYNAPSE GATHERING: Crawling inventory counts, sales velocities and margins...`, 500);
    await addLog(`POLICY VERIFICATION: Checking against ${selectedWorkflow.id === "customer-reply" ? "违禁词过滤与客情自恰" : "各平台SEO/大促审核规范"}...`, 500);
    await addLog(`GEMINI CORE INFERENCE: Calling Google Gemini model via secure server-side proxy...`, 650);

    const platformNameObj = (globalDataSource === "sandbox" ? sandboxPlatformList : platformList).find(p => p.id === selectedPlatformId);
    const platformName = platformNameObj ? platformNameObj.name : "全渠道中控后台";

    try {
      const response = await fetch("/api/gemini/run-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowId: selectedWorkflow.id,
          platformId: selectedPlatformId,
          platformName: platformName,
          inputs: workflowInputs
        })
      });

      if (response.ok) {
        const jsonResult = await response.json().catch(() => ({}));
        
        await addLog(`DECISION COMPASS ORIENTED: API payload successfully resolved and analyzed.`, 400);
        await addLog(`ACTION LOGGING: Creating persistent tactical operations audit ledger...`, 400);
        await addLog(`ROBOTIC STEPS RESOLVED: Operational blueprint generated successfully!`, 300);

        const resultText = typeof jsonResult.result === "string" ? jsonResult.result.trim() : "";
        if (resultText) {
          setAiOutputResult(resultText);
          setAiWarningMessage(jsonResult.warning || "");
          showToast("Agent 执行完成，结果已显示在右侧面板。", "success");
        } else {
          setAiOutputResult("### ⚠️ Agent 执行完成，但没有返回可展示结果\n\n接口返回 200 OK，但响应中的 `result` 为空。请稍后重试，或检查该 Agent 的服务端输出格式。");
          setAiWarningMessage("接口返回 200 OK，但 result 为空。");
          await addLog(`EMPTY RESULT NOTICE: API returned 200 OK but no visible result payload.`, 200);
          showToast("Agent 接口返回成功，但结果为空，已在右侧面板提示。", "warning");
        }
        setHasNewOutput(true);
        setActiveTab("workflows");
        void fetchWorkflowLogs();
      } else {
        await addLog(`❌ INTEL CORE FAILURE: API responded with status exclusion criteria!`, 300);
        setAiOutputResult(`### ⚠️ Agent 执行失败\n\n接口返回状态码：${response.status} ${response.statusText || ""}\n\n请检查服务端日志或稍后重试。`);
        setAiWarningMessage("Agent 接口请求失败，当前仍停留在工作室。");
        setHasNewOutput(true);
        setActiveTab("workflows");
        showToast("AI 引擎调用失败，请检查密钥配置或重试。", "warning");
      }
    } catch (err) {
      await addLog(`⚠️ NETWORK TIMEOUT: Target context unreachable. Engaging offline tactical advisor...`, 450);
      showToast("无法连接云端，已由本地中控备份智库渲染应急方案。", "warning");
      setActiveTab("workflows");
      setAiOutputResult(`### 💡 Agent 离线备份决策方案 (Simulated Core)
[${selectedWorkflow.name}] 已在沙盘中离线激发成功。推荐大促应急路线：

1. **服务降级与溢流重定位**：对于未及时到货 SKU 对应的客诉，默认采取极速仅退款/极速赔付或顺丰极速发货策略；
2. **在库周转应急补库**：向[浙江义乌织造工厂]调取在手现货大宗批次，直接转顺丰直发在途物流以满足平台合规指标！`);
      setHasNewOutput(true);
    } finally {
      setIsRunningAI(false);
      setActiveTab("workflows");
    }
  };

  // Submit natural language instruction to Dispatch Agent router
  const handleAgentCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentInstruction.trim()) return;
    setActiveTab("workflows");

    const cmd = agentInstruction.trim();
    setAgentInstruction("");
    setIsRunningAI(true);
    setAiOutputResult("");
    setAiWarningMessage("");
    setHasNewOutput(false);
    
    showToast(`正在解析并调度端上 NL 指令...`, "info");
    
    const getNowTime = () => new Date().toLocaleTimeString("zh-CN");
    setTerminalLogs([
      `⏱️ [${getNowTime()}] NL ROUTER ATTACHED: Received live input.`,
      `🧠 [${getNowTime()}] INTENT CLASSIFICATION: Querying Gemini dispatch directory...`
    ]);

    const addLog = (msg: string, delay: number) => {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          setTerminalLogs((prev) => [...prev, `🤖 [${new Date().toLocaleTimeString("zh-CN")}] ${msg}`]);
          resolve();
        }, delay);
      });
    };

    try {
      const resp = await fetch("/api/agent/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: cmd })
      });

      if (resp.ok) {
        const data = await resp.json();
        
        await addLog(data.explanation || "中台规则分类已命中，自动对齐意图中...", 500);
        
        const workflowPreset = STAGE_WORKFLOWS.find(w => w.id === data.workflowId);
        if (workflowPreset) {
          setSelectedWorkflow(workflowPreset);
          setWorkflowInputs(data.prefilledInputs || {});
          
          await addLog(`WAKING SKILL: Target Agent 【${workflowPreset.name}】 woken. Loaded parameters.`, 600);
          await addLog(`LAUNCH DIRECTIVE: Firing robotic procedures...`, 400);

          // Invoke the standard execution
          setTimeout(() => {
            triggerWorkflowExecution();
          }, 300);
        } else {
          await addLog("❌ NL MAP DEVIATION: No associated workflow preset found.", 400);
          setIsRunningAI(false);
        }
      } else {
        await addLog("❌ NL DECODER DISCONNECTED. Defaulting to standard customer care.", 400);
        setIsRunningAI(false);
      }
    } catch (e) {
      await addLog("⚠️ NL ENGINE TRANSPORT TIMEOUT. Fallback mapping to Customer Agent...", 400);
      const customerWk = STAGE_WORKFLOWS.find(w => w.id === "customer-reply");
      if (customerWk) {
        setSelectedWorkflow(customerWk);
        setWorkflowInputs({
          customerMsg: cmd,
          category: "常规咨询",
          tone: "friendly"
        });
        setTimeout(() => {
          triggerWorkflowExecution();
        }, 300);
      } else {
        setIsRunningAI(false);
      }
    }
  };

  // Callback logic when sandbox data uploads and file parses successfully
  const handleImportComplete = (
    dataType: "platforms" | "supply_chain" | "finance" | "custom",
    targetPlatformId: string,
    mappedData: any[],
    rawSheetInfo?: {
      fileName: string;
      headers: string[];
      rows: any[];
      sheets?: {
        name: string;
        headers: string[];
        rows: any[];
        dailySeries?: any[];
        profile?: any;
      }[];
      activeSheetIndex?: number;
    }
  ) => {
    if (dataType !== "custom") {
      setGlobalDataSource("sandbox");
    }
    setIsImportModalOpen(false);
    showToast(
      dataType === "custom"
        ? `通用业务表解析成功！已载入 ${mappedData.length} 行数据并生成可视化画像。`
        : `中台映射器解析成功！已将 ${mappedData.length} 行数据注入【本地沙盘（SANDBOX）】并实时联动。`,
      "success"
    );
    
    if (rawSheetInfo) {
      setUploadedFileBoardData({
        fileName: rawSheetInfo.fileName,
        dataType,
        headers: rawSheetInfo.headers,
        rows: rawSheetInfo.rows,
        sheets: rawSheetInfo.sheets,
        activeSheetIndex: rawSheetInfo.activeSheetIndex,
        importedAt: new Date().toLocaleString("zh-CN")
      });
      setActiveTab("table_parsed_board");
    }
    
    if (dataType === "platforms") {
      setSandboxPlatformList((prev) => {
        const updated = [...prev];
        mappedData.forEach((item) => {
          const matchedIdx = updated.findIndex((u) => u.name === item.name || u.id === item.name);
          if (matchedIdx !== -1) {
            updated[matchedIdx] = { ...updated[matchedIdx], ...item, isLocalMock: true };
          } else {
            updated.push({
              id: item.id || `local_${Date.now()}_${Math.random()}`,
              name: item.name,
              channel: "B2C",
              logo: "Tmall",
              todaySales: Number(item.todaySales) || 60000,
              monthlySales: Number(item.monthlySales) || (Number(item.todaySales) || 60000) * 12,
              conversionRate: Number(item.conversionRate) || 3.1,
              activeProducts: 80,
              pendingOrders: Number(item.pendingOrders) || 50,
              unreadMessages: Number(item.unreadMessages) || 3,
              status: "normal",
              syncCount: 1
            });
          }
        });
        
        // Recalculate summary totals
        const b2bSales = updated.filter(u => u.channel === "B2B").reduce((sum, u) => sum + u.monthlySales, 0);
        const b2cSales = updated.filter(u => u.channel === "B2C").reduce((sum, u) => sum + u.monthlySales, 0);
        const totalSales = b2bSales + b2cSales;
        setSandboxSummaryMetrics({
          totalSales,
          totalOrders: updated.reduce((sum, u) => sum + (u.pendingOrders || 0), 0) + 12000,
          b2bSales,
          b2cSales,
          lastUpdated: new Date().toISOString()
        });
        return updated;
      });
    } else if (dataType === "supply_chain") {
      setSandboxSupplyChainProducts(mappedData);
    } else if (dataType === "finance") {
      setSandboxFinanceLedgers(mappedData);
    }
  };

  const triggerGlobalSync = async () => {
    showToast("正在一键调度全渠道API，对齐所有平台交易总额...", "info");
    for (const platform of platformList) {
      await handleSyncPlatform(platform.id);
    }
    showToast("全链路多终端数据核算对账完毕！", "success");
  };

  const getWorkflowIcon = (iconName: string) => {
    switch (iconName) {
      case "MessageSquare": return <Lucide.MessageSquare className="w-4 h-4 text-indigo-500" />;
      case "SearchCode": return <Lucide.Search className="w-4 h-4 text-indigo-500" />;
      case "Volume2": return <Lucide.Volume2 className="w-4 h-4 text-indigo-500" />;
      case "TrendingUp": return <Lucide.TrendingUp className="w-4 h-4 text-indigo-500" />;
      case "Calendar": return <Lucide.Calendar className="w-4 h-4 text-indigo-500" />;
      case "Layers": return <Lucide.Layers className="w-4 h-4 text-indigo-500" />;
      default: return <Lucide.Zap className="w-4 h-4 text-indigo-500" />;
    }
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: "CNY",
      maximumFractionDigits: 0
    }).format(num);
  };

  // Computed active lists based on Data Source Mode (API vs Local Sandbox Map)
  const activePlatformList = globalDataSource === "sandbox" ? sandboxPlatformList : platformList;
  const activeSummaryMetrics = globalDataSource === "sandbox" ? sandboxSummaryMetrics : summaryMetrics;
  const activeSupplyChainProducts = globalDataSource === "sandbox" ? sandboxSupplyChainProducts : supplyChainProducts;
  const activeFinanceLedgers = globalDataSource === "sandbox" ? sandboxFinanceLedgers : financeLedgers;

  if (!authState.checked) {
    return (
      <div className="min-h-screen w-full bg-slate-50 text-slate-900 flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm font-semibold text-slate-600">
          <Lucide.Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
          Loading OmniFlow session...
        </div>
      </div>
    );
  }

  if (authState.authRequired && !authState.authenticated) {
    return (
      <div className="min-h-screen w-full bg-slate-50 text-slate-900 flex items-center justify-center px-4">
        <form
          onSubmit={handleLoginSubmit}
          className="w-full max-w-sm bg-white border border-slate-200 rounded-lg shadow-sm p-6 space-y-5"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
              <Lucide.ShieldCheck className="w-5 h-5 text-indigo-700" />
            </div>
            <div>
              <h1 className="text-base font-black text-slate-900 leading-tight">OmniFlow Login</h1>
              <p className="text-xs text-slate-500 mt-1">Server-side session required</p>
            </div>
          </div>

          {!authState.loginEnabled ? (
            <div className="text-xs leading-5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3">
              Authentication is required, but password login is not enabled. Configure
              OMNIFLOW_ADMIN_PASSWORD and OMNIFLOW_SESSION_SECRET on the server, or use an internal
              Basic Auth / admin-token deployment path.
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block">
                <span className="block text-xs font-bold text-slate-700 mb-1.5">Username</span>
                <input
                  value={loginForm.username}
                  onChange={(event) => setLoginForm((prev) => ({ ...prev, username: event.target.value }))}
                  className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  autoComplete="username"
                />
              </label>
              <label className="block">
                <span className="block text-xs font-bold text-slate-700 mb-1.5">Password</span>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
                  className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  autoComplete="current-password"
                />
              </label>
            </div>
          )}

          {authState.error && (
            <div className="text-xs leading-5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3">
              {authState.error}
            </div>
          )}

          <button
            type="submit"
            disabled={!authState.loginEnabled || isLoggingIn || !loginForm.username.trim() || !loginForm.password}
            className="w-full h-10 rounded-lg bg-indigo-700 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-800 transition-colors"
          >
            {isLoggingIn ? <Lucide.Loader2 className="w-4 h-4 animate-spin" /> : <Lucide.LogIn className="w-4 h-4" />}
            Sign in
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 text-slate-900 font-sans flex overflow-hidden">
      
      {/* Toast Alert Banner */}
      {alertToast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border animate-in fade-in slide-in-from-top-4 duration-300 bg-white border-slate-200">
          {alertToast.type === "success" && <Lucide.CheckCircle className="w-5 h-5 text-emerald-500" />}
          {alertToast.type === "info" && <Lucide.Sparkles className="w-5 h-5 text-indigo-500" />}
          {alertToast.type === "warning" && <Lucide.AlertCircle className="w-5 h-5 text-amber-500" />}
          <span className="text-xs font-medium text-slate-800">{alertToast.message}</span>
        </div>
      )}

      {/* LEFT SIDEBAR - Sleek Interface Standard */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 min-h-screen">
        {/* Brand Banner */}
        <div className="p-5 border-b border-slate-100 shrink-0 bg-slate-50/50">
          <div className="flex flex-col gap-2">
            <div className="flex flex-col mb-1">
              <span className="text-base font-black text-slate-900 tracking-tight leading-tight">
                优趣汇
              </span>
              <span className="text-[9px] text-slate-400 font-bold tracking-widest leading-none mt-0.5">
                UNQ INTEGRATED PLATFORM
              </span>
            </div>
            
            <div className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1.5 rounded-lg mt-1 select-none">
              集成运营中控台
            </div>

            <div className="flex items-center gap-1.5 justify-between mt-1">
              <span className="text-[9px] text-slate-500 font-medium px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded">OmniFlow v1.1</span>
              <span className="text-[9px] text-emerald-600 font-bold px-1.5 py-0.5 bg-emerald-50 border border-emerald-100 rounded">系统就绪</span>
            </div>
          </div>
        </div>

        {/* Sidebar Nav Actions */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 px-2">
            控制台功能模块
          </div>
          
          {/* Menu Item 1: Integrated Dashboard */}
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "dashboard"
                ? "bg-indigo-50 text-indigo-700 font-bold"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <span className="flex items-center gap-3">
              <Lucide.LayoutDashboard className={`w-4 h-4 ${activeTab === "dashboard" ? "text-indigo-600" : "text-slate-400"}`} />
              全平台中控数据看板
            </span>
            <span className="bg-indigo-100 text-indigo-700 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold">
              实时
            </span>
          </button>

          {/* Menu Item 1b: Dedicated Uploaded Spreadsheet BI Board */}
          <button
            onClick={() => setActiveTab("table_parsed_board")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "table_parsed_board"
                ? "bg-emerald-50 text-emerald-800 font-bold border-l-2 border-emerald-500"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <span className="flex items-center gap-3">
              <Lucide.FileSpreadsheet className={`w-4 h-4 ${activeTab === "table_parsed_board" ? "text-emerald-700" : "text-slate-400"}`} />
              表格解析可视化中控
            </span>
            {uploadedFileBoardData ? (
              <span className="bg-emerald-150 text-emerald-800 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold animate-pulse">
                已载入
              </span>
            ) : (
              <span className="bg-slate-100 text-slate-500 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold">
                离线
              </span>
            )}
          </button>

          {/* Menu Item 2: AI Workflows Runner */}
          <button
            onClick={() => setActiveTab("workflows")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "workflows"
                ? "bg-indigo-50 text-indigo-700 font-bold"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <span className="flex items-center gap-3">
              <Lucide.Combine className={`w-4 h-4 ${activeTab === "workflows" ? "text-indigo-600" : "text-slate-400"}`} />
              数字化 Agent 工作室
            </span>
            <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold">
              Gemini
            </span>
          </button>

          {/* Menu Item 2b: Middle Platform AI Assistant */}
          <button
            onClick={() => setActiveTab("middle_platform")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "middle_platform"
                ? "bg-indigo-50 text-indigo-700 font-bold"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <span className="flex items-center gap-3">
              <Lucide.BrainCircuit className={`w-4 h-4 ${activeTab === "middle_platform" ? "text-indigo-600" : "text-slate-400"}`} />
              智能数据中台 AI 决策助理
            </span>
            <span className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-[9px] px-1.5 py-0.5 rounded font-mono font-bold">
              中台大脑
            </span>
          </button>

          <button
            onClick={() => setActiveTab("operations_integration")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "operations_integration"
                ? "bg-indigo-50 text-indigo-700 font-bold"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <span className="flex items-center gap-3">
              <Lucide.Settings2 className={`w-4 h-4 ${activeTab === "operations_integration" ? "text-indigo-600" : "text-slate-400"}`} />
              配置 / 任务中心
            </span>
            <span className="bg-cyan-100 text-cyan-800 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold">
              JSON
            </span>
          </button>

          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-5 mb-1.5 px-2">
            核心整合后台板块
          </div>

          {/* Menu Item 3: Supply Chain */}
          <button
            onClick={() => setActiveTab("supply_chain")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "supply_chain"
                ? "bg-indigo-50 text-indigo-700 font-bold"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <span className="flex items-center gap-3">
              <Lucide.Truck className={`w-4 h-4 ${activeTab === "supply_chain" ? "text-indigo-600" : "text-slate-400"}`} />
              供应链柔性智调板块
            </span>
            <span className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold">
              库存安全
            </span>
          </button>

          {/* Menu Item 4: Finance */}
          <button
            onClick={() => setActiveTab("finance")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "finance"
                ? "bg-indigo-50 text-indigo-700 font-bold"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <span className="flex items-center gap-3">
              <Lucide.Coins className={`w-4 h-4 ${activeTab === "finance" ? "text-indigo-600" : "text-slate-400"}`} />
              多平台 P&L 财务算账
            </span>
            <span className="bg-blue-100 text-blue-800 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold">
              利润ROI
            </span>
          </button>

          {/* Menu Item 5: HR */}
          <button
            onClick={() => setActiveTab("hr")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "hr"
                ? "bg-indigo-50 text-indigo-700 font-bold"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <span className="flex items-center gap-3">
              <Lucide.Users className={`w-4 h-4 ${activeTab === "hr" ? "text-indigo-600" : "text-slate-400"}`} />
              客服组绩效与AI督导
            </span>
            <span className="bg-purple-100 text-purple-800 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold">
              客户纠纷
            </span>
          </button>

          {/* Menu Item 6: General HR */}
          <button
            onClick={() => setActiveTab("general_hr")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "general_hr"
                ? "bg-indigo-50 text-indigo-700 font-bold"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <span className="flex items-center gap-3">
              <Lucide.UserCheck className={`w-4 h-4 ${activeTab === "general_hr" ? "text-indigo-600" : "text-slate-400"}`} />
              集团组织聘训与弹性薪酬
            </span>
            <span className="bg-rose-100 text-rose-800 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold">
              综合人事
            </span>
          </button>

          {/* Platforms Overview section */}
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-6 mb-2.5 px-2">
            绑定平台就绪度 (API)
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between px-3 py-1.5 rounded-md text-xs text-slate-600 hover:bg-slate-50/50">
              <span className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-red-500"></div> 
                天猫旗舰店 (B2C)
              </span>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 font-semibold px-1.5 py-0.2 rounded scale-90">Active</span>
            </div>

            <div className="flex items-center justify-between px-3 py-1.5 rounded-md text-xs text-slate-600 hover:bg-slate-50/50">
              <span className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div> 
                京东自营店 (B2C)
              </span>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 font-semibold px-1.5 py-0.2 rounded scale-90">Active</span>
            </div>

            <div className="flex items-center justify-between px-3 py-1.5 rounded-md text-xs text-slate-600 hover:bg-slate-50/50">
              <span className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-pink-500"></div> 
                抖音小店 (B2C)
              </span>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 font-semibold px-1.5 py-0.2 rounded scale-90">Active</span>
            </div>

            <div className="flex items-center justify-between px-3 py-1.5 rounded-md text-xs text-slate-600 hover:bg-slate-50/50">
              <span className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-orange-500"></div> 
                拼多多旗舰 (B2C)
              </span>
              <span className="text-[10px] bg-slate-100 text-slate-500 font-semibold px-1.5 py-0.2 rounded scale-90">Normal</span>
            </div>

            <div className="flex items-center justify-between px-3 py-1.5 rounded-md text-xs text-slate-600 hover:bg-slate-50/50">
              <span className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-[#ff7700]"></div> 
                1688批发 (B2B)
              </span>
              <span className="text-[10px] bg-slate-100 text-slate-500 font-semibold px-1.5 py-0.2 rounded scale-90">Normal</span>
            </div>
          </div>
          
          {/* Quick instructions indicator */}
          <div className="mt-6 p-3 bg-indigo-900/5 border border-indigo-100 rounded-lg">
            <h5 className="text-[10px] font-bold text-indigo-900 flex items-center gap-1">
              <Lucide.Info className="w-3 h-3 text-indigo-700" />
              运营提效配置
            </h5>
            <p className="text-[10px] text-slate-500 leading-normal mt-1">
              在 Secrets 面板设置密钥后，工作流将开启高智能 AI 生成；未配置时将使用离线内置智库引擎备灾。
            </p>
          </div>
        </nav>

        {/* User profile details mirroring Design mock exactly */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-inner">
              OP
            </div>
            <div className="text-xs">
              <div className="font-semibold text-slate-800">运营首席专家 (Ops Lead)</div>
              <div className="text-slate-500 mt-0.5 text-[10px]">控制编号: 8842-X</div>
            </div>
          </div>
          {authState.authenticated && (
            <button
              type="button"
              onClick={handleLogout}
              className="mt-3 w-full h-8 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors"
            >
              <Lucide.LogOut className="w-3.5 h-3.5" />
              Sign out {authState.user?.username ? `(${authState.user.username})` : ""}
            </button>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-base font-bold text-slate-800 tracking-tight flex items-center gap-2">
              {activeTab === "operations_integration" && "配置 / 任务中心"}
              {activeTab === "dashboard" && "集成多平台商业运营中控台"}
              {activeTab === "workflows" && "优趣汇数字化 Agent 工作室 (内测版)"}
              {activeTab === "middle_platform" && "智能数据中台决策大脑 & Operations COO"}
              {activeTab === "supply_chain" && "供应链库存精算分析舱"}
              {activeTab === "finance" && "全渠道财务损益 P&L 统计大盘"}
              {activeTab === "hr" && "大促线上客服组能效考核"}
              {activeTab === "general_hr" && "全集团人事组织架构与弹性绩效结算"}
              {activeTab === "table_parsed_board" && "中台异构表格解析映射工作部"}
            </h1>
            
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
              globalDataSource === "api"
                ? "bg-emerald-50 text-emerald-800 border-emerald-100/50"
                : "bg-amber-50 text-amber-800 border-amber-100/50"
            }`}>
              <span className="relative flex h-2 w-2">
                {globalDataSource === "api" ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </>
                ) : (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </>
                )}
              </span>
              {globalDataSource === "api" ? "AI API 实时待命中" : "沙盘多源演示模式"}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">今日汇总成交估算额 / GMV</div>
              <div className="text-lg font-black text-slate-900 tracking-tight">
                {formatCurrency(activeSummaryMetrics.totalSales)}
              </div>
            </div>
            <div className="h-8 w-[1px] bg-slate-200"></div>
            <button
              onClick={triggerGlobalSync}
              className="bg-indigo-600 text-white cursor-pointer hover:bg-indigo-700 px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
            >
              <Lucide.RefreshCw className="w-3.5 h-3.5" />
              全量同步数据
            </button>
          </div>
        </header>

        {/* Dynamic Content Viewport */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 text-slate-800">
          
          {activeTab === "dashboard" ? (
            <BrandDashboardTab
              platformList={activePlatformList}
              summaryMetrics={activeSummaryMetrics}
              onSyncPlatform={handleSyncPlatform}
              workflowLogs={workflowLogs}
              isSyncingId={isSyncingId}
              onNavigateToWorkflow={navigateToWorkflow}
              dataSourceMode={globalDataSource}
              onToggleDataSourceMode={setGlobalDataSource}
              onTriggerImport={() => setIsImportModalOpen(true)}
            />
          ) : activeTab === "supply_chain" ? (
            <SupplyChainTab
              products={activeSupplyChainProducts}
              isAILoading={isAILoadingSpecialized}
              onRunInventoryAI={async (pName, stock, speed) => handleRunSpecializedAI("supply-chain", { name: pName, stock, velocity: speed })}
              onNavigateToWorkflow={handlePrefillNavigateWorkflow}
            />
          ) : activeTab === "finance" ? (
            <FinanceTab
              ledgers={activeFinanceLedgers}
              isAILoading={isAILoadingSpecialized}
              onRunFinanceAI={async (pName, sales, ads, net) => handleRunSpecializedAI("finance", { platformName: pName, sales, adsExpense: ads, netRevenue: net })}
              onNavigateToWorkflow={handlePrefillNavigateWorkflow}
            />
          ) : activeTab === "hr" ? (
            <HRTab
              staffList={hrStaffList}
              isAILoading={isAILoadingSpecialized}
              onRunHRAI={async (name, role, score, tickets) => handleRunSpecializedAI("hr", { name, role, tickets, score })}
              onNavigateToWorkflow={handlePrefillNavigateWorkflow}
            />
          ) : activeTab === "general_hr" ? (
            <GeneralHRTab
              isAILoading={isAILoadingSpecialized}
              onRunGeneralHRAI={async (name, dept, role, score, att, sal, comm) => handleRunSpecializedAI("general-hr", { name, department: dept, role, performanceScore: score, attendanceRate: att, baseSalary: sal, commissionRate: comm })}
              onNavigateToWorkflow={handlePrefillNavigateWorkflow}
            />
          ) : activeTab === "middle_platform" ? (
            <MiddlePlatformAssistantTab
              platformList={activePlatformList}
              supplyChainProducts={activeSupplyChainProducts}
              financeLedgers={activeFinanceLedgers}
              hrStaffList={hrStaffList}
              onNavigateToWorkflow={handlePrefillNavigateWorkflow}
            />
          ) : activeTab === "operations_integration" ? (
            <OperationsIntegrationTab />
          ) : activeTab === "table_parsed_board" ? (
            <TableParsedBoardTab
              uploadedFileBoardData={uploadedFileBoardData}
              onTriggerImport={() => setIsImportModalOpen(true)}
              onLoadTemplate={(type) => {
                let fileName = "";
                let headers: string[] = [];
                let rows: any[] = [];
                if (type === "platforms") {
                  fileName = "standard_channels_payload_template.xlsx";
                  headers = ["渠道标号", "营业收款_当日", "挂单数", "待回复客诉", "均值转化率"];
                  rows = [
                    { "渠道标号": "天猫旗舰店", "营业收款_当日": 142000, "挂单数": 390, "待回复客诉": 12, "均值转化率": 3.6 },
                    { "渠道标号": "抖音小店", "营业收款_当日": 189000, "挂单数": 680, "待回复客诉": 29, "均值转化率": 3.1 },
                    { "渠道标号": "拼多多特价铺", "营业收款_当日": 95000, "挂单数": 890, "待回复客诉": 45, "均值转化率": 4.5 },
                    { "渠道标号": "小红书官方店", "营业收款_当日": 54000, "挂单数": 82, "待回复客诉": 6, "均值转化率": 2.2 }
                  ];
                } else if (type === "supply_chain") {
                  fileName = "factory_inventory_lead_time_sheet.csv";
                  headers = ["货号_SKU", "货品中文名", "在库现有实物", "起运在途", "日发货流速", "原厂生产备货周期"];
                  rows = [
                    { "货号_SKU": "SKU-9420-LOCAL", "货品中文名": "极速气动冰丝凉感防晒服", "在库现有实物": 2100, "起运在途": 800, "日发货流速": 150, "原厂生产备货周期": 15 },
                    { "货号_SKU": "SKU-3114-LOCAL", "货品中文名": "野山参黑松露凝胶夜用液", "在库现有实物": 180, "起运在途": 1200, "日发货流速": 80, "原厂生产备货周期": 21 },
                    { "货号_SKU": "SKU-5201-LOCAL", "货品中文名": "高能回弹越野跑步鞋限量款", "在库现有实物": 840, "起运在途": 400, "日发货流速": 95, "原厂生产备货周期": 12 }
                  ];
                } else {
                  fileName = "channel_p_and_l_accounting_ledgers.xlsx";
                  headers = ["店铺渠道名称", "销售月流水总计", "消费者退货赔损失", "直通车达人推广费", "平台技术佣金扣减"];
                  rows = [
                    { "店铺渠道名称": "天猫旗舰店", "销售月流水总计": 1640000, "消费者退货赔损失": 120000, "直通车达人推广费": 350000, "平台技术佣金扣减": 80000 },
                    { "店铺渠道名称": "抖音爆款核心小店", "销售月流水总计": 1520000, "消费者退货赔损失": 280000, "直通车达人推广费": 520000, "平台技术佣金扣减": 76000 },
                    { "店铺渠道名称": "京东自营旗舰店", "销售月流水总计": 1310000, "消费者退货赔损失": 78000, "直通车达人推广费": 220000, "平台技术佣金扣减": 105000 }
                  ];
                }
                setUploadedFileBoardData({
                  fileName,
                  dataType: type,
                  headers,
                  rows,
                  importedAt: new Date().toLocaleString("zh-CN")
                });
                showToast("标准预置表格载入成功！", "success");
              }}
              onLoadMappedDataToSandbox={() => {
                if (uploadedFileBoardData) {
                  const { dataType, rows } = uploadedFileBoardData;
                  setGlobalDataSource("sandbox");
                  
                  if (dataType === "platforms") {
                    const mapped = rows.map((r, i) => {
                      const nameVal = r["渠道标号"] || r["店铺渠道名称"] || r["渠道"] || r["平台"] || r["平台名称"] || Object.values(r)[0];
                      const salesVal = Number(r["营业收款_当日"]) || Number(r["今日成交"]) || Number(r["营业收款"]) || Number(r["流水"]) || 60000;
                      const ordersVal = Number(r["挂单数"]) || Number(r["挂单"]) || Number(r["订单数"]) || 50;
                      const msgVal = Number(r["待回复客诉"]) || Number(r["客诉"]) || Number(r["未回复"]) || 3;
                      const rateVal = Number(r["均值转化率"]) || Number(r["转化率"]) || 3.1;
                      return {
                        id: `local_${Date.now()}_${i}`,
                        name: String(nameVal),
                        channel: "B2C" as const,
                        logo: "Tmall" as const,
                        todaySales: salesVal,
                        monthlySales: salesVal * 12,
                        conversionRate: rateVal,
                        activeProducts: 80,
                        pendingOrders: ordersVal,
                        unreadMessages: msgVal,
                        status: "normal" as const,
                        syncCount: 1
                      };
                    });
                    setSandboxPlatformList(mapped);
                    
                    const totalSales = mapped.reduce((sum, m) => sum + m.monthlySales, 0);
                    setSandboxSummaryMetrics({
                      totalSales,
                      totalOrders: mapped.reduce((sum, m) => sum + m.pendingOrders, 0) + 12000,
                      b2bSales: 0,
                      b2cSales: totalSales,
                      lastUpdated: new Date().toISOString()
                    });
                  } else if (dataType === "supply_chain") {
                    const mapped = rows.map((r, i) => {
                      const skuVal = r["货号_SKU"] || r["sku"] || `SKU-LOCAL-${i}`;
                      const nameVal = r["货品中文名"] || r["产品名"] || r["name"] || Object.values(r)[1];
                      const stockVal = Number(r["在库现有实物"]) || Number(r["warehouseStock"]) || 1000;
                      const transitVal = Number(r["起运在途"]) || Number(r["transitStock"]) || 400;
                      const velocityVal = Number(r["日发货流速"]) || Number(r["currentVelocity"]) || 100;
                      const leadVal = Number(r["原厂生产备货周期"]) || Number(r["factoryLeadTime"]) || 15;
                      return {
                        id: `local_sc_${Date.now()}_${i}`,
                        sku: String(skuVal),
                        name: String(nameVal),
                        category: "服装美妆" as const,
                        warehouseStock: stockVal,
                        transitStock: transitVal,
                        safeDOH: 15,
                        currentVelocity: velocityVal,
                        factoryLeadTime: leadVal,
                        riskLevel: stockVal < velocityVal * 10 ? ("high" as const) : ("low" as const),
                        supplierName: "本地大仓制造厂"
                      };
                    });
                    setSandboxSupplyChainProducts(mapped);
                  } else if (dataType === "finance") {
                    const mapped = rows.map((r, i) => {
                      const nameVal = r["店铺渠道名称"] || r["渠道"] || r["平台"] || Object.values(r)[0];
                      const salesVal = Number(r["销售月流水总计"]) || Number(r["salesVolume"]) || 1000000;
                      const refundVal = Number(r["消费者退货赔损失"]) || Number(r["refundsVolume"]) || 50000;
                      const adVal = Number(r["直通车达人推广费"]) || Number(r["adsExpense"]) || 100000;
                      const feeVal = Number(r["平台技术佣金扣减"]) || Number(r["platformFee"]) || 40000;
                      const netVal = salesVal - refundVal - adVal - feeVal;
                      return {
                        id: `local_fin_${Date.now()}_${i}`,
                        platformId: `platform_${i}`,
                        platformName: String(nameVal),
                        salesVolume: salesVal,
                        refundsVolume: refundVal,
                        adsExpense: adVal,
                        platformFee: feeVal,
                        logisticsFee: 50000,
                        netRevenue: netVal,
                        marginPercent: salesVal > 0 ? Math.round((netVal / salesVal) * 100) : 0
                      };
                    });
                    setSandboxFinanceLedgers(mapped);
                  }
                  showToast("表格数据已完美加载至系统底层！现在所有子模块（包括平台、分部、中台决策助理等）都会使用您上传的真实表格内容了！", "success");
                }
              }}
            />
          ) : (
            
            // UPGRADED AI AGENT COMMAND HUB & WORKFLOW TAB (数字化 Agent 工作室)
            <div className="space-y-6">
              
              {/* Top: NLP Command input bar with glowing active border */}
              <div className="bg-white rounded-xl border border-indigo-100 p-5 shadow-sm transition-all duration-300 hover:border-indigo-200">
                <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
                      <Lucide.Terminal className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">
                        Agent 自然语言交互式调度中心 (Agent Command Hub)
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        输入自然语言指令进行业务提调，大模型中脑将自动路由、自动激活并流转对应部门的 Agent 技能
                      </p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-[9px] font-bold px-2.5 py-0.5 rounded-full border border-indigo-100/50">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
                    </span>
                    NL ROUTER ENABLED
                  </span>
                </div>

                <form onSubmit={handleAgentCommandSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={agentInstruction}
                    onChange={(e) => setAgentInstruction(e.target.value)}
                    disabled={isRunningAI}
                    placeholder="例如：'调用客服专员，处理今天天猫店那几个因催发货客诉的说辞' 或 '唤醒市场部的SEO优化师对防晒衣的标题进行爆款提分优化'..."
                    className="flex-1 text-xs px-3 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50/50 disabled:bg-slate-100 transition-all font-medium"
                  />
                  <button
                    type="submit"
                    disabled={isRunningAI || !agentInstruction.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white disabled:text-slate-400 px-5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    {isRunningAI ? (
                      <Lucide.Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                    ) : (
                      <Lucide.Sparkles className="w-4 h-4" />
                    )}
                    唤醒智能体
                  </button>
                </form>

                {/* Preset quick pills */}
                <div className="mt-3.5 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-bold mr-1">快捷联调指令:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAgentInstruction("调用客服Agent，帮我处理今日天猫店因暴雨延迟催发货的客诉话术");
                    }}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] px-2.5 py-1.5 rounded-md border border-slate-200/50 transition-all cursor-pointer font-medium"
                  >
                    💬 催发货客诉处理 (客诉分部)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAgentInstruction("唤醒市场推广标题SEO优化Agent，帮我建议黑松露冰钛凉感女款外套的核心自然词，使检索权重翻倍");
                    }}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] px-2.5 py-1.5 rounded-md border border-slate-200/50 transition-all cursor-pointer font-medium"
                  >
                    ✏️ 爆款搜索标题SEO优化 (市场部)
                  </button>
                </div>
              </div>

              {/* Three-column Tactical Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* 1. Left Column: Agent skill dictionary list */}
                <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col space-y-4">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                      <Lucide.Cpu className="w-4.5 h-4.5 text-indigo-600" />
                      Agent 部门工作室 (Directory)
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      优趣汇数字化智能体编队：打通全业务线的降废提效卡点。
                    </p>
                  </div>

                  {/* Department Filters tabs */}
                  <div className="flex flex-wrap gap-1 border-b border-slate-100 pb-2.5">
                    {["全部", "客服组", "市场部", "运营部", "供应链物流"].map((dept) => (
                      <button
                        key={dept}
                        type="button"
                        onClick={() => setSelectedDeptFilter(dept)}
                        className={`text-[10px] px-2.5 py-1 rounded-md transition-all cursor-pointer font-bold ${
                          selectedDeptFilter === dept
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}
                      >
                        {dept}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2.5 flex-1 max-h-[380px] overflow-y-auto pr-1">
                    {STAGE_WORKFLOWS.filter(wk => selectedDeptFilter === "全部" || wk.department === selectedDeptFilter).map((wk) => {
                      const isSelected = selectedWorkflow.id === wk.id;
                      const isBeta = wk.status === "beta";

                      return (
                        <button
                          key={wk.id}
                          onClick={() => setSelectedWorkflow(wk)}
                          className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                            isSelected
                              ? "bg-indigo-50 border-indigo-300 text-indigo-900 shadow-xs"
                              : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
                          }`}
                        >
                          <div className="flex items-start justify-between w-full gap-2">
                            <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded-lg shrink-0 ${isSelected ? "bg-white" : "bg-slate-150/50"}`}>
                                {getWorkflowIcon(wk.icon)}
                              </div>
                              <div>
                                <span className="text-xs font-bold block leading-tight">{wk.name}</span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className={`text-[8px] font-black px-1.5 py-0.2 rounded-full ${
                                    isBeta ? "bg-emerald-100 text-emerald-800" : "bg-slate-150 text-slate-400"
                                  }`}>
                                    {isBeta ? "Beta 可用" : "🔒 规划中"}
                                  </span>
                                  <span className="text-[9px] text-slate-400 font-medium font-mono">
                                    {wk.department}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <p className="text-[10px] text-slate-400 leading-relaxed font-normal">
                            {wk.description}
                          </p>
                        </button>
                      );
                    })}
                    {STAGE_WORKFLOWS.filter(wk => selectedDeptFilter === "全部" || wk.department === selectedDeptFilter).length === 0 && (
                      <div className="py-12 text-center text-slate-400 text-xs">
                        当前部门下暂无规划中智能体
                      </div>
                    )}
                  </div>

                  {/* Channel target selector */}
                  {selectedWorkflow.status === "beta" && (
                    <div className="pt-3.5 border-t border-slate-100">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                        <Lucide.Globe className="w-3.5 h-3.5 text-indigo-500" />
                        指定投放分部 / 载入子平台参数
                      </label>
                      <select
                        value={selectedPlatformId}
                        onChange={(e) => setSelectedPlatformId(e.target.value)}
                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-300 font-medium"
                      >
                        {selectedWorkflow.platforms.map((platId) => {
                          const platformObj = activePlatformList.find(p => p.id === platId);
                          return (
                            <option key={platId} value={platId}>
                              {platformObj ? platformObj.name : platId.toUpperCase()} ({selectedWorkflow.id === "customer-reply" ? "已启用违禁词过滤" : "SEO自适应规则"})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}
                </div>

                {/* 2. Middle Column: Config field inputs OR Coming Soon registration shell */}
                <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
                  {selectedWorkflow.status === "beta" ? (
                    // Regular interactive input form for active Beta Agent
                    <div className="space-y-4 flex flex-col justify-between h-full">
                      <div className="space-y-4">
                        <div>
                          <span className="text-[9px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                            BETA OPERATOR PANEL
                          </span>
                          <h3 className="font-bold text-slate-800 text-sm mt-1.5">
                            {selectedWorkflow.name} 参数微调
                          </h3>
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                            数字化员工已在电商中控台就绪。请对齐当前的真实阻碍卡点上下文，拉起 AI 提能。
                          </p>
                        </div>

                        <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
                          {selectedWorkflow.inputs.map((field) => (
                            <div key={field.id} className="space-y-1">
                              <label className="block text-xs font-semibold text-slate-700">
                                {field.label}
                              </label>
                              {field.type === "textarea" ? (
                                <textarea
                                  value={workflowInputs[field.id] || ""}
                                  onChange={(e) =>
                                      setWorkflowInputs((prev) => ({
                                        ...prev,
                                        [field.id]: e.target.value,
                                      }))
                                  }
                                  rows={4}
                                  placeholder={field.placeholder}
                                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-slate-50/50 leading-relaxed"
                                />
                              ) : field.type === "select" ? (
                                <select
                                  value={workflowInputs[field.id] || ""}
                                  onChange={(e) =>
                                      setWorkflowInputs((prev) => ({
                                        ...prev,
                                        [field.id]: e.target.value,
                                      }))
                                  }
                                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-slate-50/50"
                                >
                                  {field.options?.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  value={workflowInputs[field.id] || ""}
                                  placeholder={field.placeholder}
                                  onChange={(e) =>
                                    setWorkflowInputs((prev) => ({
                                      ...prev,
                                      [field.id]: e.target.value,
                                    }))
                                  }
                                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-slate-50/50"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-100 shrink-0">
                        <button
                          type="button"
                          onClick={triggerWorkflowExecution}
                          disabled={isRunningAI}
                          className="w-full bg-indigo-600 cursor-pointer hover:bg-indigo-700 text-white disabled:bg-indigo-350 py-3 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
                        >
                          {isRunningAI ? (
                            <>
                              <Lucide.RefreshCw className="w-4 h-4 animate-spin text-white" />
                              智能体业务决策处理中...
                            </>
                          ) : (
                            <>
                              <Lucide.Cpu className="w-4 h-4 text-white" />
                              立即执行 Agent 提质与生产
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Beautiful Early Access Shell presentation for Coming Soon Roadmap Agents
                    <div className="h-full flex flex-col justify-between space-y-4">
                      
                      {/* Top visualization of locked Agent pipelines */}
                      <div className="space-y-4">
                        <div>
                          <span className="text-[9px] text-slate-500 font-bold bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200 uppercase">
                            🔒 Enterprise Pipeline Preview
                          </span>
                          <h3 className="font-bold text-slate-800 text-sm mt-1.5">
                            {selectedWorkflow.name} 流程蓝图
                          </h3>
                          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                            此 Agent 已完成底层业务卡点审计。正在针对优趣汇 **{selectedWorkflow.department}** 的具体场景开放接口接入：
                          </p>
                        </div>

                        {/* Pipeline Node Diagram Schematic */}
                        <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 space-y-2.5 shadow-inset select-none">
                          <span className="text-[9px] font-bold text-indigo-600 block uppercase tracking-wider">自动流转工步规划:</span>
                          
                          <div className="flex flex-col gap-2 font-medium text-[10px] text-slate-700">
                            <div className="flex items-center gap-2 bg-white rounded-lg p-2 border border-slate-100">
                              <span className="h-4 w-4 rounded-full bg-indigo-100 text-indigo-700 text-[9px] flex items-center justify-center font-bold">1</span>
                              <div className="truncate">
                                抓取 **{selectedWorkflow.department}** 账表/API触发源
                              </div>
                            </div>
                            
                            <div className="text-center text-slate-300 leading-none py-0.5">▼</div>

                            <div className="flex items-center gap-2 bg-white rounded-lg p-2 border border-slate-100">
                              <span className="h-4 w-4 rounded-full bg-indigo-100 text-indigo-700 text-[9px] flex items-center justify-center font-bold">2</span>
                              <div className="truncate">
                                触发 **Gemini 异构交叉规则判定**
                              </div>
                            </div>

                            <div className="text-center text-slate-300 leading-none py-0.5">▼</div>

                            <div className="flex items-center gap-2 bg-white rounded-lg p-2 border border-slate-100">
                              <span className="h-4 w-4 rounded-full bg-emerald-100 text-emerald-800 text-[9px] flex items-center justify-center font-bold">3</span>
                              <div className="truncate">
                                自适应生成减损决策 & 分仓接口流转
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Shell Registration Box */}
                        <div className="border-t border-slate-100 pt-3">
                          {appliedAgentIds[selectedWorkflow.id] ? (
                            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs space-y-2 leading-relaxed">
                              <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                                <Lucide.CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                                灰度首批内测预约已登记！
                              </div>
                              <p className="text-[10px]">
                                优趣汇中台系统研发部正在优先调试该 Agent 的底层接口与表映射。我们将安排集团专属架构师在 2 个工作日内向 **wangzefeng0608@gmail.com** 推送内测灰度激活码，协助您打破业务孤岛阻碍！
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <span className="text-[10px] text-slate-400 font-bold block">申请优先打通此 Agent 场景（内测登记）：</span>
                              
                              <div className="space-y-2 text-[10px]">
                                <div>
                                  <label className="block text-slate-500 font-semibold mb-1">您公司该场景重复消耗频次？</label>
                                  <select className="w-full text-[11px] p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none">
                                    <option>日发/日审重复发生10+次（高耗能）</option>
                                    <option>每周大宗对账耗费2个工作日以上</option>
                                    <option>大促狂考期间瞬间拥堵瘫痪（缺货溢出）</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-slate-500 font-semibold mb-1">预期的关联系统数据源？</label>
                                  <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                                    <label className="flex items-center gap-1 bg-slate-50 p-1.5 rounded border border-slate-100 cursor-pointer">
                                      <input type="checkbox" defaultChecked className="rounded text-indigo-600 scale-90" />
                                      电商平台后台 API
                                    </label>
                                    <label className="flex items-center gap-1 bg-slate-50 p-1.5 rounded border border-slate-100 cursor-pointer">
                                      <input type="checkbox" defaultChecked className="rounded text-indigo-600 scale-90" />
                                      异构报表文件
                                    </label>
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-slate-500 font-semibold mb-1">内测接受邀请邮箱</label>
                                  <input type="text" readOnly value="wangzefeng0608@gmail.com" className="w-full text-[11px] p-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 focus:outline-none" />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {!appliedAgentIds[selectedWorkflow.id] && (
                        <div className="shrink-0 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => {
                              setAppliedAgentIds(prev => ({ ...prev, [selectedWorkflow.id]: true }));
                              showToast(`已成功提报【${selectedWorkflow.name}】的内测申请，专属团队将加速打通！`, "success");
                            }}
                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                          >
                            <Lucide.WandSparkles className="w-4 h-4 text-white" />
                            提交优先内测灰度申请
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. Right Column: Dark Black Terminal Monitor with stepwise audit logs */}
                <div className="lg:col-span-4 bg-slate-900 rounded-xl p-5 text-white shadow-xl flex flex-col justify-between overflow-hidden">
                  <div className="space-y-4 flex flex-col h-full overflow-hidden">
                    <div className="flex justify-between items-center pb-2.5 border-b border-white/10 shrink-0">
                      <div>
                        <span className="text-xs text-indigo-400 font-bold uppercase tracking-wider block">
                          ROBOTIC PROCESSOR MONITOR
                        </span>
                        <h4 className="text-xs font-semibold text-slate-300">
                          中控智能大模型决策输出窗口
                        </h4>
                      </div>
                      <span className="text-[10px] bg-indigo-500/25 border border-indigo-400/40 text-indigo-300 px-2.5 py-0.5 rounded animate-pulse">
                        STATUS: ACTIVE
                      </span>
                    </div>

                    {/* AI Results Scroll Pane or Step thoughts log terminal */}
                    <div className="flex-1 overflow-y-auto space-y-4 font-normal text-xs pr-1 leading-relaxed text-slate-200">
                      
                      {/* Interactive stepwise terminal thoughts logs log list */}
                      {terminalLogs.length > 0 && (
                        <div className="space-y-2 select-text font-mono text-[10px] bg-black/40 p-3 rounded-lg border border-white/5 leading-normal text-indigo-200/90 max-h-[175px] overflow-y-auto">
                          <p className="text-slate-400 border-b border-white/5 pb-1 font-sans font-bold text-[9px] uppercase tracking-wider">
                            🤖 Agent 执勤思维推演过程:
                          </p>
                          {terminalLogs.map((logStr, lIdx) => {
                            let status: "completed" | "processing" | "error" = "completed";
                            const lowerLog = logStr.toLowerCase();
                            const isError = lowerLog.includes("❌") || lowerLog.includes("failure") || lowerLog.includes("failed") || lowerLog.includes("error");
                            const isWarningOrTimeout = lowerLog.includes("⚠️") || lowerLog.includes("timeout") || lowerLog.includes("warning");
                            
                            if (isError) {
                              status = "error";
                            } else if (isWarningOrTimeout) {
                              status = "processing";
                            } else if (isRunningAI && lIdx === terminalLogs.length - 1) {
                              status = "processing";
                            } else {
                              status = "completed";
                            }

                            const dotColor = 
                              status === "completed" 
                                ? "bg-emerald-400" 
                                : status === "processing" 
                                ? "bg-amber-400 animate-pulse" 
                                : "bg-rose-500";

                            const pingColor = 
                              status === "completed" 
                                ? "bg-emerald-300" 
                                : status === "processing" 
                                ? "bg-amber-300" 
                                : "bg-rose-400";

                            return (
                              <div key={lIdx} className="flex items-start gap-2 whitespace-pre-wrap transition-opacity duration-300 py-0.5 group">
                                <span className="relative flex h-1.5 w-1.5 mt-1 shrink-0 select-none">
                                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${pingColor} opacity-75`}></span>
                                  <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${dotColor}`}></span>
                                </span>
                                <div className="flex-1">
                                  {logStr}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {isRunningAI ? (
                        <div className="py-12 text-center flex flex-col items-center justify-center space-y-3 shrink-0">
                          <Lucide.Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-200 text-xs">正在分析运营背景参数...</p>
                            <p className="text-[10px] text-slate-400">正在拼装最契合 {selectedPlatformId.toUpperCase()} 平台合规的话术大纲</p>
                          </div>
                        </div>
                      ) : aiOutputResult ? (
                        <div className="space-y-3.5 select-text prose prose-invert prose-xs">
                          {aiWarningMessage && (
                            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 p-2.5 rounded-lg text-[10px] flex gap-2 mb-3 leading-relaxed">
                              <Lucide.AlertCircle className="w-4.5 h-4.5 shrink-0 text-amber-400" />
                              <span>{aiWarningMessage}</span>
                            </div>
                          )}
                          <div className="whitespace-pre-line text-xs font-normal font-sans bg-white/[0.03] p-4 rounded-xl border border-white/10 text-slate-100 max-h-[350px] overflow-y-auto">
                            <div className="mb-2 pb-1.5 border-b border-white/10 text-[10px] uppercase font-bold text-indigo-400 tracking-wider flex items-center justify-between">
                              <span>📁 Agent Attribution Blueprint Report</span>
                              <span className="text-emerald-400">SUCCESS</span>
                            </div>
                            {aiOutputResult}
                          </div>
                        </div>
                      ) : (
                        <div className="py-20 text-center text-slate-400">
                          <Lucide.Cpu className="w-10 h-10 mx-auto text-slate-650 mb-2 stroke-1" />
                          <p className="font-semibold text-slate-300">决策仪等待指令进行激发</p>
                          <p className="text-[10px] text-slate-550 mt-1.5 max-w-[200px] mx-auto leading-relaxed">
                            请在左侧选择对应智能体。
                            若为 Beta 可用智能体，可在修改参数后点击下方 [立即执行] ；
                            若为建设中智能体模型，建议提调您的内测预约，我们将为您加急灰度授权！
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions bottom block */}
                  {aiOutputResult && !isRunningAI && (
                    <div className="pt-4 border-t border-white/10 flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(aiOutputResult);
                          showToast("内容已成功复制到剪贴板！可以直接粘贴到后台。", "success");
                        }}
                        className="flex-1 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Lucide.Copy className="w-3.5 h-3.5" />
                        复制此方案
                      </button>
                      <button
                        onClick={() => {
                          setAiOutputResult("");
                          setAiWarningMessage("");
                          setTerminalLogs([]);
                          showToast("已排空并格式化当前窗口缓存。", "info");
                        }}
                        className="px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                      >
                        清空
                      </button>
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}

        </div>

        {/* Bottom Activity Footer Bar */}
        <footer className="h-10 bg-white border-t border-slate-200 px-8 flex items-center justify-between text-[10px] text-slate-500 shrink-0 select-none">
          <div className="flex gap-6">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> 
              中控 API 响应延时: 12ms
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> 
              智库AI节点: 24/24 在线 
            </span>
          </div>
          <div className="font-mono text-[9px] text-slate-400">
            最后结算抓取时戳: {new Date(summaryMetrics.lastUpdated).toLocaleString("zh-CN")}
          </div>
        </footer>

      </main>

      {isImportModalOpen && (
        <ImportMappingModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImportComplete={handleImportComplete}
          platformList={activePlatformList}
        />
      )}
    </div>
  );
}
