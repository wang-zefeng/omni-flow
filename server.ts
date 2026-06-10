import express from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { generateAI } from "./ai-service";
import { createServerAuth } from "./server/auth";
import { createOpsIntegrationRouter } from "./server/opsIntegration";
import { createTableUploadRouter } from "./server/tableUpload";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "10mb" }));
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});

const PORT = Number.parseInt(process.env.PORT || "3001", 10) || 3001;
const APP_DATA_DIR = process.env.APP_DATA_DIR || path.join(process.cwd(), ".data");
const APP_STATE_FILE = path.join(APP_DATA_DIR, "app-state.json");
const MAX_WORKFLOW_LOGS = Number.parseInt(process.env.MAX_WORKFLOW_LOGS || "50", 10) || 50;
const auth = createServerAuth();

app.use(auth.requireInternalAccess);

function getAIStatus() {
  const primaryProvider = process.env.AI_PRIMARY_PROVIDER || "deepseek";
  const fallbackProvider = process.env.AI_FALLBACK_PROVIDER || "qwen";
  return {
    primaryProvider,
    fallbackProvider,
    modelOverride: process.env.AI_MODEL_OVERRIDE || null,
  };
}

function ensureDataDir() {
  fs.mkdirSync(APP_DATA_DIR, { recursive: true });
}

function persistAppState() {
  try {
    ensureDataDir();
    const tmpFile = `${APP_STATE_FILE}.tmp`;
    const state = {
      savedAt: new Date().toISOString(),
      platformData,
      workflowLogs,
      supplyChainProducts,
      financeLedgers,
      hrStaff,
      generalEmployees,
    };
    fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2));
    fs.renameSync(tmpFile, APP_STATE_FILE);
  } catch (error) {
    console.warn("[Persistence Warning] Failed to save app state:", error);
  }
}

function loadPersistedAppState() {
  try {
    if (!fs.existsSync(APP_STATE_FILE)) return;
    const state = JSON.parse(fs.readFileSync(APP_STATE_FILE, "utf8"));
    if (state.platformData) platformData = state.platformData;
    if (Array.isArray(state.workflowLogs)) workflowLogs = state.workflowLogs;
    if (Array.isArray(state.supplyChainProducts)) supplyChainProducts = state.supplyChainProducts;
    if (Array.isArray(state.financeLedgers)) financeLedgers = state.financeLedgers;
    if (Array.isArray(state.hrStaff)) hrStaff = state.hrStaff;
    if (Array.isArray(state.generalEmployees)) generalEmployees = state.generalEmployees;
    console.log(`[Persistence] Loaded local state snapshot from ${APP_STATE_FILE}`);
  } catch (error) {
    console.warn("[Persistence Warning] Failed to load app state. Using built-in demo seed data.", error);
  }
}

function appendWorkflowLog(logDetails: any) {
  workflowLogs.unshift(logDetails);
  if (workflowLogs.length > MAX_WORKFLOW_LOGS) {
    workflowLogs = workflowLogs.slice(0, MAX_WORKFLOW_LOGS);
  }
  persistAppState();
}

// 1. Initial simulated platform databases for B2B & B2C
let platformData = {
  summary: {
    totalSales: 4185400,
    totalOrders: 18520,
    b2bSales: 1654000,
    b2cSales: 2531400,
    lastUpdated: new Date().toISOString(),
  },
  platforms: [
    {
      id: "tmall",
      name: "天猫旗舰店",
      channel: "B2C",
      logo: "Tmall",
      todaySales: 124500,
      monthlySales: 1540800,
      conversionRate: 3.42,
      activeProducts: 142,
      pendingOrders: 420,
      unreadMessages: 18,
      status: "normal",
      syncCount: 1,
    },
    {
      id: "tmall_global",
      name: "天猫海外直营店",
      channel: "B2C",
      logo: "TmallGlobal",
      todaySales: 68400,
      monthlySales: 990600,
      conversionRate: 2.85,
      activeProducts: 85,
      pendingOrders: 180,
      unreadMessages: 5,
      status: "normal",
      syncCount: 1,
    },
    {
      id: "jd",
      name: "京东自营店",
      channel: "B2C",
      logo: "JD",
      todaySales: 110200,
      monthlySales: 1254000,
      conversionRate: 3.88,
      activeProducts: 110,
      pendingOrders: 290,
      unreadMessages: 11,
      status: "normal",
      syncCount: 1,
    },
    {
      id: "pinduoduo",
      name: "拼多多官方旗舰店",
      channel: "B2C",
      logo: "Piduoduo",
      todaySales: 89400,
      monthlySales: 825000,
      conversionRate: 4.12,
      activeProducts: 190,
      pendingOrders: 780,
      unreadMessages: 24,
      status: "normal",
      syncCount: 1,
    },
    {
      id: "douyin",
      name: "抖音小店",
      channel: "B2C",
      logo: "Douyin",
      todaySales: 154600,
      monthlySales: 1385000,
      conversionRate: 2.98,
      activeProducts: 48,
      pendingOrders: 510,
      unreadMessages: 37,
      status: "normal",
      syncCount: 1,
    },
    {
      id: "b2b_wholesale",
      name: "阿里巴巴1688批发通道",
      channel: "B2B",
      logo: "Alibaba",
      todaySales: 310000,
      monthlySales: 4850000,
      conversionRate: 8.5,
      activeProducts: 320,
      pendingOrders: 95,
      unreadMessages: 12,
      status: "normal",
      syncCount: 1,
    },
    {
      id: "b2b_offline",
      name: "渠道大宗B2B直供系统",
      channel: "B2B",
      logo: "OfflineB2B",
      todaySales: 212500,
      monthlySales: 3240000,
      conversionRate: 12.4,
      activeProducts: 75,
      pendingOrders: 28,
      unreadMessages: 4,
      status: "normal",
      syncCount: 1,
    }
  ]
};

// Simulated Workflow Automation Execution logs
let workflowLogs = [
  {
    id: "log_1",
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    platform: "tmall",
    workflow: "customer-reply",
    type: "Auto-Reply Draft",
    status: "success",
    summary: "自动回复顾客问询 (产地问题) 并生成优雅草稿，正在等候客服终审确认。"
  },
  {
    id: "log_2",
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    platform: "douyin",
    workflow: "marketing-copy",
    type: "Video Script Draft",
    status: "success",
    summary: "天猫618狂欢夜预赛抖音爆款短视频脚本5条自动生成，并根据热词包优化完成。"
  },
  {
    id: "log_3",
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    platform: "jd",
    workflow: "inventory-replenish",
    type: "Replenishment Suggestion",
    status: "warning",
    summary: "智能警报：检测到京东自营SKU-JD9420销售激增，预估库存在3天内耗尽，已自动发起补货提案。"
  }
];

// Simulated Supply Chain Database
let supplyChainProducts = [
  {
    id: "sc_1",
    sku: "SKU-9420",
    name: "冰丝凉感专业防晒衣 (男女同款气动防护系列)",
    category: "服装美妆",
    warehouseStock: 1840,
    transitStock: 650,
    safeDOH: 15,
    currentVelocity: 120,
    factoryLeadTime: 20,
    riskLevel: "medium" as const,
    supplierName: "浙江义乌织造工厂"
  },
  {
    id: "sc_2",
    sku: "SKU-3114",
    name: "奢透黑松露抗老夜间修护乳 (高浓度酵母紧致版)",
    category: "面部护肤",
    warehouseStock: 240,
    transitStock: 900,
    safeDOH: 20,
    currentVelocity: 65,
    factoryLeadTime: 18,
    riskLevel: "high" as const,
    supplierName: "苏州美妆智造第二车间"
  },
  {
    id: "sc_3",
    sku: "SKU-8842",
    name: "多气垫高回弹轻履越野跑鞋 (碳板支撑避震限量款)",
    category: "运动鞋靴",
    warehouseStock: 520,
    transitStock: 280,
    safeDOH: 12,
    currentVelocity: 85,
    factoryLeadTime: 15,
    riskLevel: "medium" as const,
    supplierName: "福建莆田精密航空鞋靴加工基地"
  },
  {
    id: "sc_4",
    sku: "SKU-1080",
    name: "定制款速干无缝健美瑜伽短裤 (塑形微压缩透气系列)",
    category: "服装美妆",
    warehouseStock: 3200,
    transitStock: 1500,
    safeDOH: 15,
    currentVelocity: 90,
    factoryLeadTime: 14,
    riskLevel: "low" as const,
    supplierName: "广东汕头无缝高密度织染厂"
  }
];

// Simulated Finance Database
let financeLedgers = [
  {
    id: "fin_1",
    platformId: "tmall",
    platformName: "天猫官方旗舰店",
    salesVolume: 1540800,
    refundsVolume: 123800,
    adsExpense: 324000,
    platformFee: 78500,
    logisticsFee: 54000,
    netRevenue: 960500,
    marginPercent: 62
  },
  {
    id: "fin_2",
    platformId: "jd",
    platformName: "京东自营店",
    salesVolume: 1254000,
    refundsVolume: 74200,
    adsExpense: 215000,
    platformFee: 104200,
    logisticsFee: 85000,
    netRevenue: 775600,
    marginPercent: 61
  },
  {
    id: "fin_3",
    platformId: "douyin",
    platformName: "抖音爆款核心小店",
    salesVolume: 1385000,
    refundsVolume: 243900,
    adsExpense: 485000,
    platformFee: 69250,
    logisticsFee: 48000,
    netRevenue: 538850,
    marginPercent: 39
  },
  {
    id: "fin_4",
    platformId: "pinduoduo",
    platformName: "拼多多百亿补贴旗舰店",
    salesVolume: 825000,
    refundsVolume: 112000,
    adsExpense: 142000,
    platformFee: 8250,
    logisticsFee: 41000,
    netRevenue: 521750,
    marginPercent: 63
  },
  {
    id: "fin_5",
    platformId: "b2b_wholesale",
    platformName: "1688批发分销大客户号",
    salesVolume: 4850000,
    refundsVolume: 35000,
    adsExpense: 150000,
    platformFee: 24200,
    logisticsFee: 220000,
    netRevenue: 4420800,
    marginPercent: 91
  }
];

// Simulated HR / Service Support Database
let hrStaff = [
  {
    id: "101",
    name: "张美琳",
    role: "天猫VIP客服主管",
    platformGroup: "天猫联合大组",
    onlineStatus: "online" as const,
    avgResponseSeconds: 9.4,
    satisfactionRate: 99.4,
    resolvedTicketsToday: 240,
    aiAssistedCount: 198
  },
  {
    id: "102",
    name: "刘星阳",
    role: "京东急速督办专员",
    platformGroup: "京东自营小组",
    onlineStatus: "online" as const,
    avgResponseSeconds: 12.8,
    satisfactionRate: 98.6,
    resolvedTicketsToday: 185,
    aiAssistedCount: 122
  },
  {
    id: "103",
    name: "陈小希",
    role: "拼多多极致争议调解员",
    platformGroup: "拼多多综合售后部",
    onlineStatus: "break" as const,
    avgResponseSeconds: 15.2,
    satisfactionRate: 96.2,
    resolvedTicketsToday: 290,
    aiAssistedCount: 245
  },
  {
    id: "104",
    name: "宋智贤",
    role: "抖音带货促复购专家",
    platformGroup: "抖音自播大本营",
    onlineStatus: "online" as const,
    avgResponseSeconds: 11.5,
    satisfactionRate: 98.9,
    resolvedTicketsToday: 310,
    aiAssistedCount: 280
  },
  {
    id: "105",
    name: "赵铁柱",
    role: "B2B批发渠道专属售后顾问",
    platformGroup: "1688批发与线下商大组",
    onlineStatus: "offline" as const,
    avgResponseSeconds: 45.0,
    satisfactionRate: 95.0,
    resolvedTicketsToday: 42,
    aiAssistedCount: 15
  }
];

// API Endpoints
// API Route 1: Healthcheck
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    time: new Date().toISOString(),
    ai: getAIStatus(),
    persistence: {
      enabled: true,
      stateFileExists: fs.existsSync(APP_STATE_FILE),
    },
    security: auth.securityStatus(),
  });
});

app.use("/api", auth.requireRequestOrigin);
app.get("/api/auth/session", auth.sessionHandler);
app.post("/api/auth/login", auth.loginHandler);
app.post("/api/auth/logout", auth.logoutHandler);
app.use("/api", auth.requireApiAccess);
app.use("/api", createOpsIntegrationRouter({ appDataDir: APP_DATA_DIR }));
app.use("/api", createTableUploadRouter());

// API Route 2: Get active platform data
app.get("/api/platform-data", (req, res) => {
  res.json(platformData);
});

// API Route 2b: Get supply chain products
app.get("/api/supply-chain/products", (req, res) => {
  res.json(supplyChainProducts);
});

// API Route 2c: Get finance ledgers
app.get("/api/finance/ledgers", (req, res) => {
  res.json(financeLedgers);
});

// API Route 2d: Get HR staff roster
app.get("/api/hr/staff", (req, res) => {
  res.json(hrStaff);
});

// Simulated Corporate HR / Employee Directory Database
let generalEmployees = [
  {
    id: "emp_1",
    name: "李建国",
    department: "运营部",
    role: "资深跨平台运营专家",
    baseSalary: 18500,
    performanceScore: 92,
    attendanceRate: 99.2,
    joinedDate: "2023-03-15",
    status: "active",
    commissionRate: 1.5,
  },
  {
    id: "emp_2",
    name: "王思萌",
    department: "市场部",
    role: "补货运营与抖音投手组长",
    baseSalary: 15000,
    performanceScore: 88,
    attendanceRate: 96.8,
    joinedDate: "2024-01-10",
    status: "active",
    commissionRate: 2.0,
  },
  {
    id: "emp_3",
    name: "周博文",
    department: "技术研发",
    role: "智研大语言系统全栈架构师",
    baseSalary: 28000,
    performanceScore: 95,
    attendanceRate: 100.0,
    joinedDate: "2022-07-01",
    status: "active",
    commissionRate: 0.0,
  },
  {
    id: "emp_4",
    name: "刘佳欣",
    department: "供应链物流",
    role: "干线分拨调度及质检督筹",
    baseSalary: 13800,
    performanceScore: 84,
    attendanceRate: 98.4,
    joinedDate: "2024-05-18",
    status: "probation",
    commissionRate: 0.8,
  },
  {
    id: "emp_5",
    name: "沈静婉",
    department: "财务行政",
    role: "总账统筹与大促出纳专员",
    baseSalary: 12000,
    performanceScore: 90,
    attendanceRate: 99.0,
    joinedDate: "2021-11-20",
    status: "active",
    commissionRate: 0.0,
  }
];

loadPersistedAppState();

// API Route 2e: Get Corporate Employees Roster
app.get("/api/hr/employees", (req, res) => {
  res.json(generalEmployees);
});

// API Route 2f: Save/Update Employee
app.post("/api/hr/employees/save", auth.requireAdminToken, (req, res) => {
  const emp = req.body;
  if (!emp.name || !emp.department) {
    return res.status(400).json({ error: "Missing required fields (name, department)" });
  }

  if (emp.id) {
    const idx = generalEmployees.findIndex(e => e.id === emp.id);
    if (idx !== -1) {
      generalEmployees[idx] = {
        ...generalEmployees[idx],
        ...emp,
        baseSalary: Number(emp.baseSalary) || 0,
        performanceScore: Number(emp.performanceScore) || 0,
        attendanceRate: Number(emp.attendanceRate) || 0,
        commissionRate: Number(emp.commissionRate) || 0
      };
      persistAppState();
      return res.json({ success: true, employee: generalEmployees[idx] });
    }
  }

  // Create new
  const newEmp = {
    ...emp,
    id: `emp_${Date.now()}`,
    baseSalary: Number(emp.baseSalary) || 0,
    performanceScore: Number(emp.performanceScore) || 0,
    attendanceRate: Number(emp.attendanceRate) || 0,
    commissionRate: Number(emp.commissionRate) || 0,
    status: emp.status || "active",
    joinedDate: emp.joinedDate || new Date().toISOString().split('T')[0]
  };
  generalEmployees.push(newEmp);
  persistAppState();
  res.json({ success: true, employee: newEmp });
});

// API Route 2g: Delete Employee
app.post("/api/hr/employees/delete", auth.requireAdminToken, (req, res) => {
  const { id } = req.body;
  const idx = generalEmployees.findIndex(e => e.id === id);
  if (idx !== -1) {
    generalEmployees.splice(idx, 1);
    persistAppState();
    return res.json({ success: true });
  }
  res.status(404).json({ error: "Employee not found" });
});


// API Route 3: Sync a platform (simulated database refresh + status review)
app.post("/api/platforms/sync", auth.requireAdminToken, (req, res) => {
  const { id } = req.body;
  const platform = platformData.platforms.find(p => p.id === id);
  if (platform) {
    platform.syncCount += 1;
    // Add random slight adjustments to data to simulate true scraping
    const percentChange = (Math.random() * 6 - 3) / 100; // -3% to +3%
    platform.todaySales = Math.round(platform.todaySales * (1 + percentChange));
    platform.pendingOrders = Math.max(0, platform.pendingOrders + Math.round((Math.random() * 10 - 5)));
    platform.unreadMessages = Math.max(0, platform.unreadMessages + Math.round((Math.random() * 4 - 2)));
    platform.status = Math.random() > 0.85 ? "warning" : "normal";
    
    // Add a logs detail
    const newLog = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      platform: platform.id,
      workflow: "data-sync",
      type: "Data Sync Engine",
      status: "success" as const,
      summary: `数据同步成功：已成功抓取并汇总 ${platform.name} 发货列表、未读和售后纠纷率。当前平台状态: ${platform.status === "warning" ? "【库存偏低警告】" : "正常"}`
    };
    appendWorkflowLog(newLog);

    // Recalculate summary metrics
    let salesTotal = 0;
    let b2cTotal = 0;
    let b2bTotal = 0;
    platformData.platforms.forEach(p => {
      salesTotal += p.todaySales; // using active day adjustments
      if (p.channel === "B2C") b2cTotal += p.monthlySales;
      else b2bTotal += p.monthlySales;
    });
    platformData.summary.totalSales = b2cTotal + b2bTotal;
    platformData.summary.b2cSales = b2cTotal;
    platformData.summary.b2bSales = b2bTotal;
    platformData.summary.lastUpdated = new Date().toISOString();
    persistAppState();

    res.json({ success: true, platform, summary: platformData.summary });
  } else {
    res.status(404).json({ error: "Platform not found" });
  }
});

// API Route 4: Fetch Workflow logs
app.get("/api/workflow/logs", (req, res) => {
  res.json(workflowLogs);
});

// API Route 4b: Quick AI-based audit endpoint for specialized sectors
app.post("/api/gemini/quick-audit", async (req, res) => {
  const { sector, details } = req.body;
  if (!sector) {
    return res.status(400).json({ error: "Missing sector parameter" });
  }

  let systemInstruction = "";
  let promptText = "";

  if (sector === "supply-chain") {
    systemInstruction = `你是一位精通全球电商商品柔性货流链和安全库存决策的首席供应链精算官。
请结合顾客在库实物和去料速率进行分析，并给出一份字字珠玑、包含采购、排货等落地化解决大纲。以美观的Markdown格式返回。`;
    promptText = `商品名称：${details.name}
当前实物在库数：${details.stock} 件
常态去料消耗速度：${details.velocity} 件/天`;
  } else if (sector === "finance") {
    systemInstruction = `你是一位资深的电商财务首席审计官与大促投产算账师。你深谙拼多多、天猫各平台费用佣金和投流ROI杠杆。
请针对特定店铺渠道的销售流水额和广告直通车投入，评估ROI真实成色并起草具有针对性的利润改善和抗通胀、防退款损耗的财务诊断文书。`;
    promptText = `核算渠道：${details.platformName}
应收零售流水：${details.sales} 元
广告投入直通车费用：${details.adsExpense} 元
扣点后净收益额：${details.netRevenue} 元`;
  } else if (sector === "hr") {
    systemInstruction = `你是一位杰出的世界500强企业战略人力资源管理总监与绩效考核领头人。
请对客服人员提供的信息进行绩效评估。请在返回结果中包含：
1. 组员绩点亮点（肯定其在顾客满意度、AI提效度上的闪光点）；
2. 客观考评定级（核心指标：三秒钟超快妥决案、好评率综合测算）；
3. 激励建议（如针对性奖金倾斜、或大促黄金班次的挂牌特训方向）；
以高格局的Markdown格式呈现。`;
    promptText = `客服名：${details.name}
岗位级别：${details.role}
日决客诉并消单量：${details.tickets}单
综合客户满意好评率：${details.score}%`;
  } else if (sector === "general-hr") {
    systemInstruction = `你是一位世界级顶尖的企业聘训教练、首席CHO（人力资源官），擅长电商企业组织设计与人才盘点。
请综合分析本条一般企业员工的基本工资薪金、出勤完备率和考核绩效分（0-100），并给出一套囊括“潜能激活计划”、“提成效率评估与投产回报（ROI）”、“职业阶梯路径与激励调薪研判”的人力晋升改进方案。以高格局的Markdown格式呈现。`;
    promptText = `员工姓名：${details.name}
岗位部门：${details.department} (${details.role})
基础月薪：${details.baseSalary} 元
考勤出勤率：${details.attendanceRate}%
考核绩效分：${details.performanceScore}分
销售提成比：${details.commissionRate}%`;
  }

  try {
    const resultText = await generateAI({
      contents: promptText,
      systemInstruction,
      temperature: 0.7,
    });

    res.json({ success: true, result: resultText });
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    const isQuota = errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("quota") || errorMsg.includes("Circuit Breaker");
    if (isQuota) {
      console.warn("[AI Quick Audit Alert] Quota exceeded or Circuit Breaker active. Falling back to local offline diagnostician smoothly.");
    } else {
      console.warn("[AI Quick Audit Alert] Bypassing/fallback initiated gracefully. Reason:", errorMsg);
    }
    
    let simulatedText = `### 💡 AI 智能大厂评估报告 (备灾本地模式)\n\n`;
    if (sector === "supply-chain") {
      simulatedText += `##### 【当前备料安全预估结论】
分析显示，商品 **${details.name}** 分仓在库量 ${details.stock} 件，目前的日去料速度 ${details.velocity} 件/天。
* **安全周转 DOH**：当前在库预计可周转时间 ${(Number(details.stock) / Number(details.velocity)).toFixed(1)} 天。
* **排班采购建议**：供应商浙江织造/苏州美妆基地排期一般在15-20天。为对冲即将爆发的大促，建议立刻追加批签采购订单 ${(Number(details.velocity) * 20).toLocaleString()} 件，以彻底杜绝断档、超卖引发平台降权罚款！`;
    } else if (sector === "finance") {
      simulatedText += `##### 【Q2分仓财务ROI诊断分析】
渠道 **${details.platformName}** 流水累计高达 ${details.sales} 元，投流费用 ${details.adsExpense} 元。
* **投产回报率比 (ROI)**：${(Number(details.sales) / Math.max(1, Number(details.adsExpense))).toFixed(2)}。
* **财务整改大纲**：投流效率尚处于及格线，但平台费率与退税损耗有加剧趋势。建议针对该高流量渠道立即建立“客诉7天无理由先赔退货降耗阀”，推广直通车ROI应调高抓取机制，将资金向转化极高的高溢价新品倾斜。`;
    } else if (sector === "hr") {
      simulatedText += `##### 【特训客服主管绩效考绩】
客服 **${details.name}**（${details.role}）今日共妥帖处理客诉 ${details.tickets} 单，售后满意评分达 ${details.score}%。
* **主管定绩结论**：**【特优等 / EXCELLENT】**
* **绩效提效闪光点**：服务态度温和得体。得益于 AI 自动回复工作流的高效高渗透辅助，处理量大幅突破常态极限。
* **培训建议**：继续授权并保持高频 AI 草案调用，该名骨干推荐在大促期间挂帅“黄金极速破冰值班岗”，并申报季度服务杰出大奖！`;
    } else if (sector === "general-hr") {
      simulatedText += `##### 【综合人事绩效与薪酬管理诊断报告】
针对员工 **${details.name}**（部署部门：${details.department} | ${details.role}）的组织贡献分析：
* **人事定绩考核**：绩效得分 **${details.performanceScore}分**，出勤率达 **${details.attendanceRate}%**。整体出勤饱满度良好，处于高位水准。
* **薪资与提成投产比**：目前基础月薪为 ${details.baseSalary} 元，获设销售提成比例为 ${details.commissionRate}%。绩效产出符合岗位中坚力量水平，提成激励杠杆正向作用。
* **组织赋能建议**：该角色属于该组的核心基石。建议制定大促专案股权/大笔专项佣金冲刺方案，提升目标吸引力。可在大促结束后酌情考虑将底薪上浮 8~12% 并在组内配任“带新导师”！`;
    }

    res.json({ success: true, result: simulatedText });
  }
});

// API Route 4bb: Deep AI audit for custom spreadsheets uploaded by the user
app.post("/api/gemini/audit-spreadsheet", async (req, res) => {
  const {
    fileName,
    dataType,
    headers,
    rows,
    activeSheetName,
    dailySeriesSummarized,
    customQuestion,
    tableProfile,
    sheetSummaries,
    selectedVisual,
    derivedMetrics,
    topRows,
    anomalyRows,
  } = req.body;
  if (!rows || !Array.isArray(rows)) {
    return res.status(400).json({ error: "Missing rows dataset parameter" });
  }

  const systemInstruction = customQuestion 
    ? `你是一位企业级数据中台 Agent 的高级业务分析师。
你的职责是针对用户刚刚导出的本地 Excel/CSV/JSON 表格，就用户提问的特定问题，结合字段画像、异常行、Top行、工作簿摘要和当前可视化维度，给出精准回答。
不要只复述表格字段，要根据表格所属业务类型（运营、供应链、财务、人事、市场、客服、CRM、项目、采购、设计需求或通用业务表）判断真正的业务含义。
请用专业、沉稳、可执行的 Markdown 输出。`
    : `你是一位企业级公司中台 Agent 的“通用表格智能审计官”。
你不仅分析电商运营报表，也能分析供应链、财务、人事绩效、市场投放、客服、CRM、采购、项目管理、设计需求等多类型业务表。

请基于上传文件、字段画像、工作簿摘要、时间序列、Top行和异常行完成以下内容：
1. 【表格画像与可信度】：说明当前工作表 ${activeSheetName || "默认工作表"} 的业务类型、行列规模、字段角色、完整度、是否存在空值/格式风险。
2. 【核心指标洞察】：围绕自动识别的主指标、金额字段、比例字段、日期字段、文本维度，指出最重要的业务结论。
3. 【可视化解读】：结合用户当前选择的 X轴、Y轴、分组维度、时间粒度，说明图表应该如何阅读。
4. 【异常与红线】：结合异常行、Top行、波动/空值/极端值，指出真正值得管理者关注的风险。
5. 【下一步动作】：给出 3-5 条可落地的部门协作动作，按优先级排序。

如果数据不是电商运营表，不要硬套 GMV、库存或投流话术；要按实际字段语义分析。请用结构化 Markdown 输出。`;

  // Limit raw row context so we don't blow up token limits, but give a highly accurate subset.
  const croppedRows = rows.slice(0, 50);
  const promptText = `
【上传表格文件名称】：${fileName || "未知报表文件.xlsx"}
【当前工作工作表名称】：${activeSheetName || "默认工作表"}
【业务标签分类】：${dataType}
【解析字段名称 (Headers)】：${JSON.stringify(headers)}
【自动字段画像 (Table Profile)】：
${JSON.stringify(tableProfile || {}, null, 2)}

【工作簿内各工作表摘要 (Sheet Summaries)】：
${JSON.stringify(sheetSummaries || [], null, 2)}

【当前图表选择 (Selected Visual Context)】：
${JSON.stringify(selectedVisual || {}, null, 2)}

【当前选中指标的派生统计 (Derived Metrics)】：
${JSON.stringify(derivedMetrics || {}, null, 2)}

【前 50 行解析数据行 (Rows JSON)】：
${JSON.stringify(croppedRows, null, 2)}

【按当前主指标排序的Top行 (Top Rows)】：
${JSON.stringify((topRows || []).slice(0, 10), null, 2)}

【疑似异常行 (Anomaly Rows)】：
${JSON.stringify((anomalyRows || []).slice(0, 10), null, 2)}

${dailySeriesSummarized && dailySeriesSummarized.length > 0 ? `
【已提取的日度/周度成交流水 (Daily/Weekly Series Raw - 前 100 条)】：
${JSON.stringify(dailySeriesSummarized.slice(0, 100), null, 2)}
` : ""}

${customQuestion ? `用户特别提出的分析诊断问题：【 ${customQuestion} 】
请对此具体疑惑指标予以针对性重点攻坚，计算关键数据并得出专业结论与避险方法：` : `用户补充诉求：请结合上述真实上传的日/周/月跨工作表明细指标，给我出一份极其透彻的阶段性经营诊断，不要任何废话，直击痛点并给出执行对策。`}
`;

  try {
    const resultText = await generateAI({
      contents: promptText,
      systemInstruction,
      temperature: 0.8,
    });

    res.json({ success: true, result: resultText });
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    const isQuota = errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("quota") || errorMsg.includes("Circuit Breaker");
    if (isQuota) {
      console.warn("[AI Spreadsheet Audit Alert] Quota exceeded or Circuit Breaker active. Running dynamic math-driven backup parser.");
    } else {
      console.warn("[AI Spreadsheet Audit Alert] Bypassing/fallback initiated gracefully. Reason:", errorMsg);
    }

    // Dynamic analysis based on the parsed rows!
    const rowCount = rows.length;
    const colCount = headers ? headers.length : 0;
    
    // Dynamic math estimation
    let numericSums: Record<string, number> = {};
    let matchedNumericKeys: string[] = [];
    const parseServerNumber = (value: any): number | null => {
      if (value === null || value === undefined || value === "") return null;
      if (typeof value === "number" && Number.isFinite(value)) return value;
      let text = String(value).trim();
      if (!text) return null;
      let negative = false;
      if (/^\(.*\)$/.test(text)) {
        negative = true;
        text = text.slice(1, -1);
      }
      const isWan = text.endsWith("万");
      text = text.replace(/[￥¥$,%\s,，]/g, "").replace(/[＋+]/g, "").replace(/万$/, "");
      const num = Number(text);
      if (!Number.isFinite(num)) return null;
      const scaled = isWan ? num * 10000 : num;
      return negative ? -scaled : scaled;
    };

    // Detect numeric columns
    if (headers && rows.length > 0) {
      headers.forEach(h => {
        let isAllNum = true;
        let sum = 0;
        let count = 0;
        rows.forEach(r => {
          const val = r[h];
          if (val !== undefined && val !== "") {
            const num = parseServerNumber(val);
            if (num !== null) {
              sum += num;
              count++;
            } else {
              isAllNum = false;
            }
          }
        });
        if (count > 0 && isAllNum) {
          numericSums[h] = sum;
          matchedNumericKeys.push(h);
        }
      });
    }

    let dynamicReport = `### 📊 离线数据算账与智能化诊断报告 (中台算力离线解析)\n\n`;
    dynamicReport += `> **成功拦截数据：由于本地演示环境，系统已调度智能核算算法，完成对您的真实上传文件 \`${fileName || "电子表文件"}\` 的 100% 数值物理加总校验和逻辑异常诊断。**\n\n`;
    
    dynamicReport += `#### 📁 1. 报表元数据结构分析\n`;
    dynamicReport += `* **解析文件名称**：\`${fileName}\`\n`;
    dynamicReport += `* **自动归类维度**：\`${tableProfile?.businessDomainLabel || (dataType === "platforms" ? "渠道运营数据" : dataType === "supply_chain" ? "供应链库存数据" : dataType === "finance" ? "多渠道财务损益表" : "通用业务结构报表")}\`\n`;
    dynamicReport += `* **有效载荷记录量**：\`${rowCount}\` 行记录\n`;
    dynamicReport += `* **列字段完整度**：共 \`${colCount}\` 个数据维度，检测到指标包含：${headers ? headers.map(h => `\`${h}\``).join(", ") : "无"}\n\n`;
    if (tableProfile) {
      dynamicReport += `* **字段画像识别**：金额字段 ${tableProfile.moneyFields?.length || 0} 个、数值字段 ${tableProfile.numericFields?.length || 0} 个、比例字段 ${tableProfile.ratioFields?.length || 0} 个、日期字段 ${tableProfile.dateFields?.length || 0} 个、文本维度 ${tableProfile.dimensionFields?.length || 0} 个。\n`;
      dynamicReport += `* **数据完整度**：${Number(tableProfile.fillRate || 0).toFixed(1)}%，缺失单元格 ${tableProfile.missingCells || 0} 个。\n\n`;
    }

    dynamicReport += `#### 🛠️ 2. 全量物理数字指标初探 (Summation Summary)\n`;
    if (matchedNumericKeys.length > 0) {
      dynamicReport += `本地精算引擎对您的数值维度完成了自动加总与多退少补核对：\n`;
      matchedNumericKeys.forEach(k => {
        const sum = numericSums[k];
        const average = rowCount > 0 ? (sum / rowCount) : 0;
        const isSales = k.toLowerCase().includes("sales") || k.toLowerCase().includes("volume") || k.toLowerCase().includes("收") || k.includes("成交") || k.includes("流水") || k.includes("营业");
        const formattedSum = isSales ? `¥${sum.toLocaleString()}` : sum.toLocaleString();
        const formattedAvg = isSales ? `¥${average.toLocaleString(undefined, {maximumFractionDigits:2})}` : average.toLocaleString(undefined, {maximumFractionDigits:2});
        dynamicReport += `* **列【${k}】**：总统计累计值 \`${formattedSum}\` | 单条记录均值 \`${formattedAvg}\`\n`;
      });
    } else {
      dynamicReport += `* 暂外在该报表检测到标准数值型物理指标。请检查表头是否包含数字格式。\n`;
    }

    dynamicReport += `\n#### 🚨 3. 中台红色商业红线异常研判\n`;
    if (dataType === "platforms") {
      dynamicReport += `* **【客服回复效率降权红线】**：检查到表单内涉及消息待处理堆积。根据均值测算，积压的消息若超过客诉阈值大关，将对全店成交带来 15% 以上自然流量腰折惩罚。\n`;
      dynamicReport += `* **【流量漏斗转化断层】**：不同分铺之间的转化率起伏明显（如特价铺与官旗店），依赖低价倾销。建议拉高官旗体验分，保持溢价水位。\n`;
    } else if (dataType === "supply_chain") {
      dynamicReport += `* **【断料缺件重大警戒】**：基于您的去库存出库流速，部分SKU在库天数明显偏短。由于上游制造厂工艺完工需 15 天以上，很容易产生空单爆单超卖受罚！\n`;
      dynamicReport += `* **【调配起运延误占用】**：建议通过 OmniFlow 加急派发备货单完成中转仓点收接收。\n`;
    } else if (dataType === "finance") {
      dynamicReport += `* **【投流与推广杠杆失重】**：直通车与千川付费流量开销在部分渠道侵蚀毛利极其惊人（部分账单中广告比最高近 35%）。这导致名义流水大、拿到兜里净利润却在滴血。建议将非新品常态直通车计划预算下提 20%。\n`;
      dynamicReport += `* **【逆流售后巨幅亏损】**：消费者由于仅退款或质量退款额过高。需即时同发包厂梳理工序，杜绝质量降级产生退还折损。\n`;
    } else {
      dynamicReport += `* **【通用业务表自适应研判】**：该表未被强制归入运营、供应链或财务模板。系统已按字段画像识别主维度 \`${tableProfile?.primaryDimension || "未识别"}\` 与主指标 \`${tableProfile?.primaryMetric || "未识别"}\`。\n`;
      if (anomalyRows && anomalyRows.length > 0) {
        dynamicReport += `* **【异常样本提醒】**：检测到 ${anomalyRows.length} 条疑似偏离样本，建议优先查看 Top 行和异常行中对应的部门、负责人、项目或状态字段。\n`;
      }
    }

    dynamicReport += `\n#### 💡 4. 中台执行对策推荐\n`;
    dynamicReport += `1. **先确认字段画像**：检查系统识别的金额、比例、日期、文本维度是否符合业务语义；如不符合，可重新选择 X/Y 轴和分组字段。\n`;
    dynamicReport += `2. **优先排查异常行**：围绕 Top 行和异常行定位负责人、部门、渠道、SKU 或项目阶段，先处理影响最大的 20% 记录。\n`;
    dynamicReport += `3. **沉淀为标准模板**：把当前字段结构固化成部门模板，后续上传同类文件即可快速完成分析。\n\n`;
    dynamicReport += `*离线精算引擎算法生成时间*: ${new Date().toLocaleString()}`;

    res.json({ success: true, result: dynamicReport });
  }
});

// API Route 4c: Middle Platform AI Operational Diagnostician
app.post("/api/middle-platform/consult", async (req, res) => {
  const { query, dimension } = req.body;
  const useDimension = dimension || "all";
  const userQuery = query || "对集团当前整体经营盘口进行一次全面的归因诊断与决策判断建议。";

  // Formulate the base comprehensive live system data context
  const targetDimensionPrompt = `
当前的分析维度是: [${useDimension}]
分析的主旨或用户提问: "${userQuery}"
`;

  const systemInstruction = `你是一位电商集团最顶尖、最权威的“智能数据中台决策大脑（Chief Operations Officer & COO AI Brain）”。
你对各平台经营指标、供应链安全水位、多维度财务成本(P&L)及全链条组织绩效（包括客服质量和综合人事激励）具有秒级融会贯通的跨域数据分析与归因洞察能力。

目前系统中的实时数据如下，作为你分析和归因判断的绝对事实依据：

【1. 各大促出货渠道实时就绪度 (Omnichannel Channels)】
${JSON.stringify(platformData.platforms, null, 2)}

【2. 柔性供应链安全库存及缺货断档风险 (Supply Chain Products)】
${JSON.stringify(supplyChainProducts, null, 2)}

【3. 多渠道财务P&L开支与利润ROI明细 (Finance Ledgers)】
${JSON.stringify(financeLedgers, null, 2)}

【4. 集团人事名册与薪金提点设定 (General Employees)】
${JSON.stringify(generalEmployees, null, 2)}

【5. 金牌售后大组客服满意度与AI辅助工作量 (Support Staff)】
${JSON.stringify(hrStaff, null, 2)}

请基于上述真实电商盘口数据，对用户的分析请求或预设的诊断维度，进行深度的多维度交叉分析、诊断归因、瓶颈判断，并给出可落地的实战行动决策。

请遵循以下输出规范：
1. 态度极其专业、客观而睿智，用高格局、金牌中台总指挥的电商术语（如：DOH安全水位、ROI投产比、净边际收益率、人效配比、退货率磨损、排产交期、增量边际溢价等）。
2. 在归因分析中，必须精确引用上面提供的数据指标进行严密的计算与对比说明（如销售额、未读消息、缺货DOH天数、绩点占比等）。
3. 分析要形成【中台深度透析与多维归因】和【中台执行官决策判断建议】两大部分。以排版极佳、段落合理的 Markdown 格式呈现，加入富有质感的系统标识符号（如：🎯, 📊, ⚠️, 💡, 🛡️, 📈等）。
`;

  try {
    const resultText = await generateAI({
      contents: targetDimensionPrompt,
      systemInstruction,
      temperature: 0.8,
    });

    res.json({ success: true, result: resultText });
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    const isQuota = errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("quota") || errorMsg.includes("Circuit Breaker");
    if (isQuota) {
      console.warn("[AI Middle Platform Alert] Quota exceeded or Circuit Breaker active. Falling back to local diagnostic consultant smoothly.");
    } else {
      console.warn("[AI Middle Platform Alert] Bypassing/fallback initiated gracefully. Reason:", errorMsg);
    }

    // High quality data-bounded offline analyzer
    let simulatedText = `### 🎯 【智能中台决策大脑 · 全面诊断与归因分析书】 (中台本地离线解析舱)\n\n`;
    
    if (useDimension === "all" || useDimension === "omnichannel") {
      const b2bTotal = platformData.platforms.filter(p => p.channel === "B2B").reduce((sum, p) => sum + p.monthlySales, 0);
      const b2cTotal = platformData.platforms.filter(p => p.channel === "B2C").reduce((sum, p) => sum + p.monthlySales, 0);
      const totalMonthly = b2bTotal + b2cTotal;
      const pdPending = platformData.platforms.find(p => p.id === "pinduoduo")?.pendingOrders || 780;
      const dyUnread = platformData.platforms.find(p => p.id === "douyin")?.unreadMessages || 37;

      simulatedText += `#### 📊 一、全渠道就绪度与流量归因
* **渠道总盘口规模**：集团全渠道月交易流转总额约为 **¥${totalMonthly.toLocaleString()}** 元。
  * **B2B大宗分销模式** 占比达 **${((b2bTotal / totalMonthly) * 100).toFixed(1)}%**（主要依托 *${platformData.platforms.find(p => p.id === "b2b_wholesale")?.name || '1688'}* 贡献）。
  * **B2C零售直营模式** 占比约为 **${((b2cTotal / totalMonthly) * 100).toFixed(1)}%**。
* **运营阻断红线告警**：
  * **【积单告警】** **拼多多官方旗舰店** 存在 **${pdPending}单** 待发货订单，已积累到临界降权阈值。归因为：“大促仓配交接不齐配”。
  * **【会话堵塞】** **抖音小店** 未读顾客咨询累积 **${dyUnread}条**，接待响应磨损极易导致千川引流流失。
* **诊断判词**：过度依赖高流速低利润单渠道，必须立即启动“AI 调度工作流”进行未读自动处理。

`;
    }

    if (useDimension === "all" || useDimension === "supply_chain") {
      const highRiskProds = supplyChainProducts.filter(p => p.riskLevel === "high");
      simulatedText += `#### ⚠️ 二、柔性供应链缺货断料与履约风险归因
* **高危断货预警**：目前供应链中存在 **${highRiskProds.length}款** SKU 触及“断档红线”：
`;
      supplyChainProducts.forEach(p => {
        const doh = (p.warehouseStock / p.currentVelocity).toFixed(1);
        const limitDOH = (p.warehouseStock + p.transitStock) / p.currentVelocity;
        if (p.riskLevel === "high" || Number(doh) < 8) {
          simulatedText += `  * **[${p.sku}] ${p.name.slice(0, 18)}...** 现仓储库存数 ${p.warehouseStock}件，额定去料速率 ${p.currentVelocity}件/天，**DOH周转仅剩 ${doh}天**！工厂排期交期 (Lead Time) 高达 **${p.factoryLeadTime}天**。预计断档断货天数将达 **${Math.ceil(p.factoryLeadTime - Number(doh))}天**！
`;
        }
      });
      simulatedText += `* **供方链条阻碍**：主要瓶颈在于“${supplyChainProducts[0]?.supplierName || '供应商'}”在对冲大促排期时的柔性不足。
* **诊断建议**：必须立即签发紧急在途调度令，将部分在途库存 ${supplyChainProducts[0]?.transitStock || 350}件 进行顺丰空路极速调拨，同时立即使用中台 [柔性供应链精算流] 对后续排班进行重构。

`;
    }

    if (useDimension === "all" || useDimension === "finance") {
      const lowestMarginPlatform = financeLedgers.reduce((min, p) => p.marginPercent < min.marginPercent ? p : min, financeLedgers[0]);
      const highExpensePlatform = financeLedgers.reduce((max, p) => p.adsExpense > max.adsExpense ? p : max, financeLedgers[0]);
      
      simulatedText += `#### 💡 三、多平台P&L盈利成色与营销引流ROI归因
* **核心P&L漏斗透析**：
  * **最低净润边际渠道**：**${lowestMarginPlatform.platformName}**。其账面销售额为 ¥${lowestMarginPlatform.salesVolume.toLocaleString()}，但退款占比达 **${((lowestMarginPlatform.refundsVolume / lowestMarginPlatform.salesVolume) * 100).toFixed(1)}%**（退款额 ¥${lowestMarginPlatform.refundsVolume.toLocaleString()}），直通车及内容投流直推率（投流占比）高达 **${((lowestMarginPlatform.adsExpense / lowestMarginPlatform.salesVolume) * 100).toFixed(1)}%**！导致实际净边际收益率 (Margin) 被压缩到极致的 **${lowestMarginPlatform.marginPercent}%**。
  * **直通车最重火力投放渠道**：**${highExpensePlatform.platformName}**（投研投钱开支 ¥${highExpensePlatform.adsExpense.toLocaleString()}）。
* **诊断建议**：
  * 对广告直通车投入实施“上限卡边控费”，优化极速词词包；
  * 抖音等高退款平台，强制加入“7天无理由破损客解补偿金”工作包，通过 AI 挽单和补偿降低逆向物流带来的运送磨损。

`;
    }

    if (useDimension === "all" || useDimension === "hr") {
      const totalSalary = generalEmployees.reduce((sum, e) => sum + e.baseSalary, 0);
      const totalCs = hrStaff.length;
      simulatedText += `#### 🛡️ 四、劳能配比与组织弹性薪金边际效益分析
* **集团人事盘点**：在册骨干 ${generalEmployees.length}人，客服大队 ${totalCs}人。薪资刚性沉没成本固定高昂（底薪底盘 ¥${totalSalary.toLocaleString()} 元/月）。
* **激励边际漏洞**：由于客服人员好评率波动较大，部分员工缺乏大促提成刺激，而一般运营岗位考核绩效均分仅 ${Math.round(generalEmployees.reduce((sum,e)=>sum+e.performanceScore,0)/generalEmployees.length)} 分。
* **中台决策落地**：
  1. 建立以 **“出勤率 + KPI优秀度分 + 承担GMV抽提比”** 的三段弹性薪资重调盘口。
  2. 启用中台“AI 人才复用”策略，将开发研发及物流等岗位的人员考勤、绩效分，与业务核心环节的销售利润深度挂钩，引导组织全面ROI导向。

`;
    }

    // Append context responsive addition
    if (query && query.trim() !== "") {
      simulatedText += `\n* 针对您补充的个性化中台追问 **"${query}"**，COO 决策大脑指示：
  该问题已归入您的“特定中台分析纪要”。大促激进节点应建立专项行动小组，整合全维工作流自动化去阻断降噪，通过将业务各层级串联，真正形成中台数字化驱动的核心壁垒。`;
    }

    res.json({ success: true, result: simulatedText });
  }
});

// API Route 4d: AI Agent Dispatcher and Natural Language Router
app.post("/api/agent/dispatch", async (req, res) => {
  const { instruction } = req.body;
  if (!instruction || instruction.trim() === "") {
    return res.status(400).json({ error: "Instruction parameters is required" });
  }

  const query = instruction.trim().toLowerCase();

  // 1. Initial Local Parsing (Local Fallback Parser)
  let detectedWorkflowId = "customer-reply";
  let description = "智能客服代答 Agent";
  let prefillInputs: Record<string, string> = {
    customerMsg: "有顾客反映今天在天猫旗舰店拍下的防晒衣还一直没有发货，并催促若不及时发货就立刻申请退款及投诉延迟！",
    category: "发货时效/物流积压",
    tone: "friendly"
  };

  if (query.includes("标题") || query.includes("seo") || query.includes("主图") || query.includes("优化") || query.includes("检索")) {
    detectedWorkflowId = "product-optimize";
    description = "SEO 主图与爆款标题优化 Agent";
    prefillInputs = {
      title: "2026新款冰丝防紫外线女款超薄防晒衣户外防晒外套带面罩",
      specs: "UPF50+以上，阻隔99.9%紫外线。冰钛冷感面料，重量仅110g，连压防雾口罩。",
      targetKeywords: "防晒衣、空心轻便、超薄全抗紫外线、凉感自热、骑行服"
    };
  } else if (query.includes("文案") || query.includes("种草") || query.includes("小红书") || query.includes("脚本") || query.includes("新媒体") || query.includes("社群")) {
    detectedWorkflowId = "marketing-copy";
    description = "新媒体种草与短视频脚本制作 Agent";
    prefillInputs = {
      productInfo: "奢透黑松露抗老修护晚乳。主打3周淡纹，熬夜蜡黄脸救星，买一送五，赠发光眼霜。",
      theme: "精致都市白领深夜抗老自救，拒绝熬夜黄气与面部下垮",
      objectives: "小红书爆款种草"
    };
  } else if (query.includes("销量") || query.includes("预测") || query.includes("估算") || query.includes("推演")) {
    detectedWorkflowId = "sales-forecast";
    description = "大数据销量预测与精细化运营 Agent";
    prefillInputs = {
      pastSales: "3月份：3800单，客单250W；4月份：4500单，客单310W；5月份：5800单，客单420W。",
      campaignPlan: "618大促直通车预算暴增40%，合作达人30位，爆款防晒外套让利打爆15%。",
      targetGrowth: "45%"
    };
  } else if (query.includes("活动") || query.includes("大促") || query.includes("满减") || query.includes("创意") || query.includes("企划")) {
    detectedWorkflowId = "campaign-planner";
    description = "全链路联合大促全案策划 Agent";
    prefillInputs = {
      festivalName: "618品牌首届‘清凉一夏’多店联合大促狂欢节",
      budget: "站内直通车+首推40万，KOL达人带货30万，首发私域池5万。",
      goals: "销售冲刺总考核指标 800万 GMV"
    };
  } else if (query.includes("库存") || query.includes("备货") || query.includes("周转") || query.includes("补货") || query.includes("doh") || query.includes("在途")) {
    detectedWorkflowId = "inventory-replenish";
    description = "柔性供应链库存监测与调拨补货 Agent";
    prefillInputs = {
      currentStock: "冰丝防晒外套现有在库1800件，另外常态运输在途650件。",
      dailyVelocity: "日常每天去库存120件，周末180件。双十一爆发预估销量突增至 1500件/天！",
      leadTime: "原厂排产备料耗时15天，物流装卸运输到分仓4天，共需20天。",
      supplierState: "供货源由于端午包装箱纸张短缺，揽收紧俏，需额外提早5天提报审批。"
    };
  } else if (query.includes("客服") || query.includes("催发货") || query.includes("客诉") || query.includes("催货") || query.includes("回复") || query.includes("差评") || query.includes("纠纷")) {
    detectedWorkflowId = "customer-reply";
    description = "智能客服温和回复 Agent";
    prefillInputs = {
      customerMsg: query.length > 20 ? query : "商家在吗？怎么我都拍下三天了还没发货，不想要了，赶紧把退款处理了，不然投诉你们延迟发货！",
      category: "发货时效/物流积压",
      tone: "friendly"
    };
  }

  // 2. Dynamic parsing using the configured AI provider when available
  try {
    const systemInstruction = `你是一位专门负责调度和调用各种智能体的“中台 Agent 指令解析调度中枢（Chief Dispatcher Agent）”。
你能够解析用户的自然语言语句，并将其分类对应到我们系统已有的 6 个核心 AI 智能体工作流之一：

1. 'customer-reply': 针对买家延迟发货催促、物流积压、质量挑剔、差评纠纷、常态问询的“智能回复 Agent”；
2. 'product-optimize': 用于解决原标题词组诊断、详情页卖点提炼、SEO分词优化的“商品主图标题优化 Agent”；
3. 'marketing-copy': 生成小红书爆文短篇、抖音脚本15s钩子、私域秒杀通知的“媒体种草策划 Agent”；
4. 'sales-forecast': 基于历史销量记录和推广投入估量，来做“大促销量趋势及规划 Agent”；
5. 'campaign-planner': 策划全链路平台互动（天猫互动、抖音视频、京东直降、拼多多拼团）的“大促创意方案 Agent”；
6. 'inventory-replenish': 开展在库安全 DOH 天数推算、下单备料起量预估的“供应链补货调度 Agent”。

请解析用户的需求，返回格式必须是以下 JSON 字符串（不要有 markdown 语法块外衣，直接输出纯 JSON），包含：
- workflowId: 只能是上面 6 个选项之一；
- explanation: 一句向用户反馈智能体解析情况的话语（如：“正为您唤醒‘智能客服 Agent’对该笔天猫漏发差评进行温和解扣”）；
- prefilledInputs: 基于用户的输入，推断并合理拟定出来的适合传入给该工作流的字段配置。

示例用户输入: “天猫店防晒服爆款标题该怎么写比较吸粉？”
示例输出 JSON:
{
  "workflowId": "product-optimize",
  "explanation": "已成功拦截指令，正在为您唤醒‘SEO 主图与标题优化 Agent’进行新品爆款词重推。",
  "prefilledInputs": {
    "title": "冰丝凉感防晒服",
    "specs": "冰钛冷感科技面料，UPF50+阻隔99.9%紫外线，重约110g",
    "targetKeywords": "高流量蓝海词、骑行钓鱼、超薄全抗"
  }
}
`;
    const resultText = await generateAI({
      contents: `用户大促命令："${instruction}"`,
      systemInstruction,
      temperature: 0.1,
    });

    const parsed = JSON.parse(resultText.trim());
    if (parsed && parsed.workflowId) {
      return res.json({
        success: true,
        workflowId: parsed.workflowId,
        explanation: parsed.explanation || `已唤醒对应智能体: ${parsed.workflowId}`,
        prefilledInputs: { ...prefillInputs, ...parsed.prefilledInputs }
      });
    }
  } catch (err) {
    console.warn("AI dispatcher failed, falling back to regex: ", err);
  }

  // Return the fallback resolved details
  res.json({
    success: true,
    workflowId: detectedWorkflowId,
    explanation: `已匹配中台高级指令规则，成功拦截并为您呼叫【${description}】。`,
    prefilledInputs: prefillInputs
  });
});

// API Route 5: Run AI agent workflows with the configured AI provider
app.post("/api/gemini/run-workflow", async (req, res) => {
  const { workflowId, platformId, platformName, inputs } = req.body;

  if (!workflowId) {
    return res.status(400).json({ error: "Missing workflowId parameter" });
  }

  // Set default simulated outputs as safety fallback
  let promptText = "";
  let systemInstruction = "";

  switch (workflowId) {
    case "customer-reply": {
      const { customerMsg, category, tone } = inputs || {};
      systemInstruction = `你是一位精通电商后台管理的金牌智能客服主管。
你现在负责在“${platformName || "官方旗舰店"}”处理消费者咨询和投诉纠纷。
请基于顾客的留言和问题分类，书写一份话术高超、亲切得体、符合平台法规且能促成转化或平息消费者不满的专业多版本回复草稿。

【注意事项】：
1. 根据选择的语气：'professional' (专业严谨)、'friendly' (亲切活泼)、'apologetic' (诚恳赔礼) 进行撰写。
2. 天猫和天猫海外平台严禁提及“微信、微信客服、私下交易、微信红包、转账等”站外导流词汇，否则可能导致商家账户被重罚。
3. 京东自营必须保证售后严谨和尊贵体验。
4. 拼多多需要拼多多式的极致性价比和极速包退换亲和语气。
5. 请输出三个回复方案以供客服挑选：
   - 方案 A (直入主题/简洁流)
   - 方案 B (温情话术/深度关怀)
   - 方案 C (促成复购/多重方案)
6. 最终返回的结果，请以结构化的格式和美观的 Markdown 呈现。`;

      promptText = `顾客消息： "${customerMsg || "你们这个产品怎么这么慢还没发货？再不发货我要退款并投诉了！"}"
问题分类： "${category || "发货延迟"}"
期望语气风格: ${tone || "friendly"}`;
      break;
    }

    case "product-optimize": {
      const { title, specs, targetKeywords, platformType } = inputs || {};
      systemInstruction = `你是一位顶尖的电商SEO搜索优化专家与大促操盘手。
现在需要优化一款商品在“${platformName || "平台"}”上的标题展示及卖点策划。
目标是将点击率 (CTR) 提升 50%，转化率 (CR) 提升 30%，最大化平台站内流量检索。

请输出以下优化板块：
1. 诊断意见：分析原标题存在的问题。
2. 推荐爆款标题方案：结合平台分词策略（天猫/京东一般格式为：品牌+主品名+核心功效+场景亮点+规格），生成3个高权重的标题。
3. 详情页核心痛点提炼（5个突出的痛点/卖点Bullet-Points）。
4. 本平台专属标签和SEO热词植入建议。`;

      promptText = `原始标题： "${title || "夏季透气防晒衣男女款轻薄防晒衫"}"
核心配置/规格: "${specs || "冰丝面料, UPF50+, 重量仅90g, 灰色/蓝色, 均码"}"
目标关键词: "${targetKeywords || "户外防晒、凉感冰丝、防紫外线"}"`;
      break;
    }

    case "marketing-copy": {
      const { productInfo, theme, platformType, objectives } = inputs || {};
      systemInstruction = `你是一位深谙新媒体、小红书和抖音带货生态的爆款内容策划总监。
现在需要为产品针对“${platformName || "社交渠道"}”制作高质量的营销文案和视频/图文创意思路。

请提供：
1. 【小红书种草长文案】：含情绪共鸣开场、痛点引入、多维度评测体验、精美Emoji和热门标签。
2. 【抖音带货/直播15秒视频黄金脚本】：格式包含 画面(视觉)-话术(语音)-特效(字幕)-音频建议，前3秒必须有吸睛神转折。
3. 【私域社群促销秒杀文案】：高点击短平快风格，突出稀缺感和折扣优惠。
请深度契合产品形态，文风具有强烈的转化和种草带货属性。`;

      promptText = `产品信息: "${productInfo || "黑松露人参抗皱抗衰夜间精华乳，主打提亮、抚平干纹、修护屏障"}"
活动主题/受众: "${theme || "深夜打工人自救/25+抗初老党"}"
关键营销目标: "${objectives || "拉新、裂变、首单秒杀"}"`;
      break;
    }

    case "sales-forecast": {
      const { pastSales, campaignPlan, targetGrowth } = inputs || {};
      systemInstruction = `你是一位拥有多年千万量级大促经验的高级电商数据精细化运营分析师。
请针对给出的销售历史数据、营销大促节点以及管理层预期的增长目标，利用深度数据洞察，生成销售预测与智能备货指导。

请输出：
1. 【趋势分析】：洞察上阶段的销量波谷与波峰。
2. 【大促销量预测】：对接下来大促爆发期的总销售额及核心SKU数量做合理科学预测。
3. 【备货与资金预算】：给出明确的安全库存天数（DOS）、最佳发货方案及对应备货库占比建议。
4. 【运营排期战术提示】：给出大促预售、爆发以及尾声三个阶段的运营操盘关键战术。`;

      promptText = `近3个月销售情况: "${pastSales || "3月: 3200件 / 45W | 4月: 3800件 / 52W | 5月(5月天猫年中预热): 4900件 / 70W"}"
本期营销计划: "${campaignPlan || "即将迎来618超级大促年中大考，预算投入增加35%，网红直播坑位20个"}"
期待GMV同比增长目标: "${targetGrowth || "40%"}"`;
      break;
    }

    case "campaign-planner": {
      const { festivalName, budget, goals, platformsCount } = inputs || {};
      systemInstruction = `你是一位世界500强消费品牌的全链路大促活动合伙人与首席创意官。
请定制一份全面且深具可操作性的全网联合活动企划。

请提供：
1. 核心创意主题（具有传播力和高点击感的主张）。
2. 四大主战场（天猫/抖音/京东/拼多多）的特色配合机制：
   - 天猫：适合新品定制、盖章互动与会员蓄水。
   - 抖音：品牌专场短视频流与排位赛。
   - 京东：高效配送，白条免息，大额直降。
   - 拼多多：百亿补贴拼团引流，裂变大转盘。
3. 预算分配方案饼图结构（分析ROI）及大促预热至结束的甘特图式进度建议。
4. 应急避坑预案（如爆仓、超卖、退换货过高）。`;

      promptText = `活动档期: "${festivalName || "天猫双十一狂欢盛典"}"
总预算及配置: "${budget || "100万（站内直通车/超级引力占比60%，KOL种草网红占比40%）"}"
活动总GMV考核目标: "${goals || "1200万 GMV（综合跨店满减折合全店客单价210元）"}"`;
      break;
    }

    case "inventory-replenish": {
      const { currentStock, dailyVelocity, leadTime, supplierState } = inputs || {};
      systemInstruction = `你是一位资深的全球供应链计划管理者及智能库存决策顾问。
请根据当前仓储和货品流转参数，自动规划供应链补货策略，避免缺货和爆仓的双重风险。

您的输出格式：
1. 【红线状态评估】：极度缺货、安全、严重积压。
2. 【智能计算】：建议下一次触发补货提报的时间刻度及最佳补货数量。
3. 【供应链优化方案】：若核心供应商供货周期拉长，如何分货协调多仓库和多渠道销售（天猫/京东自营/拼多多/1688等）。
4. 【应急机制建议】：提供防断货调配措施。`;

      promptText = `当前总仓备货数量: "${currentStock || "2100件 (占总仓库5k上限的42%)"}"
日常每日消耗速度: "${dailyVelocity || "平均每日销售450件，大促期爆发达2200件/天"}"
海外/本土供应链回港及清关到仓耗时（货期）: "${leadTime || "下单到入库需要15天，工厂产能目前紧张"}"
供应商与配送仓储状态: "${supplierState || "1688代工工厂在浙江，快递由于物流大促容易拥堵"}"`;
      break;
    }

    default:
      return res.status(400).json({ error: "Invalid workflowId" });
  }

  // Set default prompt text if empty
  if (!promptText) {
    promptText = "请根据品牌渠道运营策略，生成AI自动化工作报告。";
  }

  try {
    const resultText = await generateAI({
      contents: promptText,
      systemInstruction,
      temperature: 0.7,
    });

    const aiResponse = resultText;
    
    // Create an automatic log of this successful run
    const brandName = platformName || inputs?.platformType || "电商集成中控";
    const logDetails = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      platform: platformId || "global",
      workflow: workflowId,
      type: `${workflowId === 'customer-reply' ? '智能客服回复' : workflowId === 'product-optimize' ? 'SEO标题诊断' : workflowId === 'marketing-copy' ? '多平台媒介策划' : workflowId === 'sales-forecast' ? '智能销售预测' : workflowId === 'campaign-planner' ? '联合大促方案' : '供应链智能补货'}`,
      status: "success" as const,
      summary: `AI 流程 [${workflowId}] 成功在 ${brandName} 运行。模型输出已打包，可一键发送或同步。`
    };
    appendWorkflowLog(logDetails);

    res.json({
      success: true,
      result: aiResponse,
      log: logDetails,
    });
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    const isQuota = errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("quota") || errorMsg.includes("Circuit Breaker");
    if (isQuota) {
      console.warn("[AI Run Workflow Alert] Quota exceeded or Circuit Breaker active. Running local knowledgebase content gracefully.");
    } else {
      console.warn("[AI Run Workflow Alert] Fallback initiated gracefully. Reason:", errorMsg);
    }
    
    // We provide a realistic mock fallback response if key is missing or invalid so the app never shows a blank screen
    // It is elegant, professional and explains how the user can paste in their API Key.
    const aiStatus = getAIStatus();
    const isMissingKey = errorMsg.includes("API key is not configured");
    
    let fallbackText = `### 💡 AI 自动化工作流程工作报告\n\n`;
    if (isMissingKey) {
      fallbackText += `> ⚠️ **温馨提示**：当前开发服务器尚未配置真实的 AI provider API Key。为了保障产品体验，系统已自动加载 **本土模拟电商运营智库模型** 为您生成分析报告。若要启用真实云端模型，请在 \`.env.local\` 中配置 \`${aiStatus.primaryProvider}\` 或 \`${aiStatus.fallbackProvider}\` 对应的 API Key。\n\n`;
    }
    
    fallbackText += `#### 🤖 品牌官方专家系统为您生成的建议 [已通过电商中控引擎优化]：\n\n`;

    if (workflowId === "customer-reply") {
      fallbackText += `##### 【方案 A：金牌话术 - 极速安抚型】 (推荐选用)
*亲爱的顾客尊享，非常抱歉给您带来困扰！您拍下的这批货品由于近期大促订单量暴增，正在我们最大的华东中央智慧仓快马加鞭地拣配装箱包好。目前已为您申请客服“专属加急绿色通道”，预计在今晚24小时内前必能发出快递并同步运单信息！如有任何疑问，我会随时为您贴心跟进，祝您生活愉快！🌈*

##### 【方案 B：金牌话术 - 补偿推荐型】
*亲亲您好！真的很惭愧给您添麻烦了！您的订单属于我们非常热销的限量款，目前我们已经催促配货部为您优先妥善打包，同时已经单独为您额外搭配打包了一份定制周边精美赠品！稍后打包完成后我们会及时通过包裹返现券为您发放一份全平台无门槛致歉券。感谢您的耐心包容与坚守！*

##### 【方案 C：高阶纠纷预控 - B2B/大客户专业型】
*尊敬的企业采购商/顾客您好，针对您反映的发货积压问题，我们深表歉意。为了不延误您的开业活动/营销排线，我司已经将该批次紧急流转至就近的备用物流专线进行装运。发货完毕后将由专人电话向您反馈具体提货详情，感谢您的鼎力支持！*

\n\n`;
    } else if (workflowId === "product-optimize") {
      fallbackText += `##### 1. 原标题诊断意见
* 关键词堆砌较明显，缺乏核心应用场景；
* 搜特定品牌或工艺词无法精准覆盖；
* 缺少爆款标识词，未完全释放站内千人千面的长尾搜索能效。

##### 2. Tmall/京东 双引擎优化标题方案
* **方案（尊享主打）**：\`【冰丝凉感】官方正品轻薄防晒衣男女款 SPF50+ 高端防晒服 户外透气不闷汗 2026新款\`
* **方案（场景引流）**：\`轻薄冰感防紫外线防晒衫 男女同款 皮肤衣 90g極輕 钓鱼骑行露营专用防晒外套\`
* **方案（拼多多高转化）**：\`【工厂直销 買一送一】超博透气防晒衣 男女夏冰丝防紫外线防晒服 戶外透气便携\`

##### 3. 详情页核心卖点 (Bullet-Points)
* **[凉感科技]**：采用双根复合凉感纤维，上身瞬间降温 3-5℃；
* **[超强御光]**：UPF 50+，深层抵御 99.1% 的紫外线（UVA/UVB）；
* **[极致羽量]**：整衣仅重约 90g，可折叠至一掌大小，随时随地毫无重负携带；
* **[空气循环]**：后背设有隐形微孔导汗格栅，排汗速率提升 200%；
* **[国标保障]**：通过一等品标准检测，多次机洗不缩水、不减弱防晒力。

\n\n`;
    } else if (workflowId === "marketing-copy") {
      fallbackText += `##### 📌 渠道 1：小红书爆款种草文案 (点击破万秘籍)
*标题：熬夜打工脸自救！25+垮脸少女靠它撑起饱满苹果肌！✨*

*正文：*
救命！最近双十一大促天天熬夜到清晨，照镜子感觉自己的脸在以肉眼可见的速度向下垮，细纹、暗沉、毛孔集体爆发！😭
还好闺蜜给我安利了这个 **【黑松露人参夜间抗皱修护精华】**！用了小半个月，终于敢素颜出门了！

它里面的成分真的能打，浓浓的黑松露抗氧精粹搭配高纯度人参抗皱核芯，就像是把胶原蛋白往脸上疯狂填补！质地是那种极度丝滑的乳霜质感，上脸一抹化水，高级法式木质香调治愈感拉满～
晚上抹完，第二天早上醒来整张脸不仅没有泛油，反而透着那种健康饱满的哑光少女肌，摸起来软软弹弹的，连法令纹都淡了许多！

* 🏷️ #熬夜好物 #抗初老精华 #黑松露人参 #敏感肌抗初老 #小红书爆款*

##### 🎬 渠道 2：抖音15秒极速单品带货脚本
* **[0-3s 痛点黄金吸引]**：
  * **画面**：主播面容疲倦，用红色口红在脸上粗暴画一个大大的叉，然后拿出苹果往桌上痛苦一摔。
  * **语音(主播配音)**：\`25岁以后，女人最怕的就是“苹果肌”变成“烂苹果”！熬夜一晚，十张面膜都救不回来！\`
  * **特效**：红色大字体出现“千万别熬垮你自己的脸！”
* **[3-10s 核心秘密揭秘]**：
  * **画面**：主播手持精华乳，按压出丝滑质地在手臂，拉近特写，显示一抹即化和水润感。
  * **语音(主播配音)**：\`别慌！今天天猫美妆节我们抖音直播间把镇店之宝——黑松露人参抗老精华直接打到4折！10%浓度野人参精粹，把垮下去的皮肤瞬间给你撑起来！\`
* **[10-15s 限时催单收尾]**：
  * **画面**：主播指向下方黄色小黄车，双手拍桌促下单，打字机显示“限时买一送一”。
  * **语音(主播配音)**：\`只有最后50单！拍一发六，抢到就是赚到，赶快点下方小黄车！\`

\n\n`;
    } else {
      fallbackText += `##### 📊 电商中控大数据洞察建议 
根据您提交的指标：(
  * 渠道库存储备状态良好，目前总库存对准预计活动周期的备货系数在 1.7 左右
  * 考虑到拼多多、抖音等高周转渠道存在流量暴增的突发期，建议将 15% 的常态周转备料调拨到各前置智慧仓
  * 在大促大流量灌顶前，务必对工厂原材料进销存以及物流爆仓节点进行全方位的排期预演。
  )

\n\n`;
    }

    // Still add log even if fallback used
    const logDetails = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      platform: platformId || "global",
      workflow: workflowId,
      type: `${workflowId === 'customer-reply' ? '智能客服 (引擎本地推荐)' : '智能数据诊断'}`,
      status: "warning" as const,
      summary: `AI 流程 [${workflowId}] 以本地备份形式激活并成功输出，请配置 AI provider API Key 后切换至真实模型。`
    };
    appendWorkflowLog(logDetails);
    
    res.json({
      success: true,
      result: fallbackText,
      log: logDetails,
      warning: "Running in preview backup database engine."
    });
  }
});


function shouldServeStaticBuild(): boolean {
  const entryPoint = (process.argv[1] || "").replace(/\\/g, "/");
  return (
    process.env.NODE_ENV === "production" ||
    process.env.npm_lifecycle_event === "start" ||
    entryPoint.endsWith("/dist/server.cjs") ||
    entryPoint.endsWith("dist/server.cjs")
  );
}

// Serve static frontend build files with dynamic Vite config for local development / production
async function startServer() {
  if (!shouldServeStaticBuild()) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Brand Operation Backend listening on port ${PORT}`);
  });
}

startServer();
