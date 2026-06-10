export interface PlatformData {
  id: string;
  name: string;
  channel: "B2B" | "B2C";
  logo: string;
  todaySales: number;
  monthlySales: number;
  conversionRate: number;
  activeProducts: number;
  pendingOrders: number;
  unreadMessages: number;
  status: "normal" | "warning" | "error";
  syncCount: number;
}

export interface SummaryMetrics {
  totalSales: number;
  totalOrders: number;
  b2bSales: number;
  b2cSales: number;
  lastUpdated: string;
}

export interface WorkflowPreset {
  id: string;
  name: string;
  icon: string;
  description: string;
  platforms: string[]; // compatible platforms
  status?: "beta" | "coming_soon";
  department?: string;
  inputs: {
    id: string;
    label: string;
    type: "text" | "textarea" | "select";
    placeholder: string;
    options?: { label: string; value: string }[];
    defaultValue?: string;
  }[];
}

export interface WorkflowLog {
  id: string;
  timestamp: string;
  platform: string;
  workflow: string;
  type: string;
  status: "success" | "warning" | "error";
  summary: string;
}

export interface SupplyChainProduct {
  id: string;
  sku: string;
  name: string;
  category: string;
  warehouseStock: number;
  transitStock: number;
  safeDOH: number; // Days of Hovering
  currentVelocity: number; // units per day
  factoryLeadTime: number; // days
  riskLevel: "low" | "medium" | "high";
  supplierName: string;
}

export interface FinanceLedger {
  id: string;
  platformId: string;
  platformName: string;
  salesVolume: number;
  refundsVolume: number;
  adsExpense: number;
  platformFee: number;
  logisticsFee: number;
  netRevenue: number;
  marginPercent: number;
}

export interface HRSupportStaff {
  id: string;
  name: string;
  role: string;
  platformGroup: string;
  onlineStatus: "online" | "break" | "offline";
  avgResponseSeconds: number;
  satisfactionRate: number;
  resolvedTicketsToday: number;
  aiAssistedCount: number;
}

export interface GeneralEmployee {
  id: string;
  name: string;
  department: "运营部" | "市场部" | "技术研发" | "供应链物流" | "财务行政" | "客服组";
  role: string;
  baseSalary: number;
  performanceScore: number; // 0 - 100
  attendanceRate: number; // percentage, e.g. 98.5
  joinedDate: string;
  status: "active" | "probation" | "leave";
  commissionRate: number; // e.g. 1.2 meaning 1.2%
}


