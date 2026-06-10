import { WorkflowPreset } from "./types";

export const STAGE_WORKFLOWS: WorkflowPreset[] = [
  {
    id: "customer-reply",
    name: "「客服部」智能客诉回复专员 Agent",
    icon: "MessageSquare",
    status: "beta",
    department: "客服组",
    description: "针对各大连锁店铺常态问询、延迟发货、漏错发包、退款纠纷、恶意敲诈等一键提炼符合平台合规的温婉亲切回复话术。",
    platforms: ["tmall", "tmall_global", "jd", "pinduoduo", "douyin"],
    inputs: [
      {
        id: "customerMsg",
        label: "顾客原声消息 / 问题详情",
        type: "textarea",
        placeholder: "请输入顾客发来的问题，或差评内容...",
        defaultValue: "商家在吗？怎么我都拍下三天了还没发货，不想要了，赶紧把退款处理了，不然投诉你们延迟发货！"
      },
      {
        id: "category",
        label: "纠纷/问询分类",
        type: "select",
        placeholder: "选择问题分类",
        options: [
          { label: "发货时效延迟", value: "发货时效/物流积压" },
          { label: "收货破损/漏发", value: "包裹破损/少配件" },
          { label: "商品质量挑剔", value: "质量纠纷" },
          { label: "退换货流程咨询", value: "常态售后退换" },
          { label: "尺码推荐/材质问询", value: "常态售前尺码材质咨询" },
          { label: "职业索赔/打假风险", value: "疑似恶意打假/广告过滤" }
        ],
        defaultValue: "发货时效/物流积压"
      },
      {
        id: "tone",
        label: "期望回复语气",
        type: "select",
        placeholder: "语气风格",
        options: [
          { label: "亲切淘宝亲亲格调 (淘宝/天猫/抖音常用)", value: "friendly" },
          { label: "稳重京东管家格调 (京东自营适用)", value: "professional" },
          { label: "极致赔礼道歉与补偿格调 (退款防纠纷必备)", value: "apologetic" }
        ],
        defaultValue: "friendly"
      }
    ]
  },
  {
    id: "product-optimize",
    name: "「市场推广」视觉与标题 SEO 优化师 Agent",
    icon: "SearchCode",
    status: "beta",
    department: "市场部",
    description: "全链融入平台高权重流量词、防雷禁语与点击增长架构，设计满足直通车和自然排名权重的爆棚级引流商品标题与属性策划。",
    platforms: ["tmall", "tmall_global", "jd", "pinduoduo", "b2b_wholesale"],
    inputs: [
      {
        id: "title",
        label: "原始标题 (或模糊商品名称)",
        type: "text",
        placeholder: "如：夏季防晒衣女抗紫外线户外防晒外套...",
        defaultValue: "2026年夏季最新款冰丝凉感防晒服薄款防紫外线透气亲肤防晒外套带面罩女"
      },
      {
        id: "specs",
        label: "商品核心参数 / 属性规格描述",
        type: "textarea",
        placeholder: "面料、克重、科技因子、质检证书等...",
        defaultValue: "UPF50+以上，阻隔99.9%紫外线。冰钛冷感面料，水洗50次防晒力不减退，重量仅110g极度轻盈，连帽自带可拆卸防晒大帽檐与微孔防雾口罩。"
      },
      {
        id: "targetKeywords",
        label: "期望主抢热词 / 竞争蓝海词",
        type: "text",
        placeholder: "多个词语用逗号或空格分隔...",
        defaultValue: "凉感防晒衣、户外骑行钓鱼、超薄全防晒、皮肤衣"
      }
    ]
  },
  {
    id: "marketing-copy",
    name: "「市场推广」新媒体社群种草大师 Agent",
    icon: "Volume2",
    status: "coming_soon",
    department: "市场部",
    description: "一脉打通小红书精致高情绪爆长文、抖音15秒极强钩子直播分镜、以及微信高成交私域催付社群秒杀话术文案。",
    platforms: ["tmall", "jd", "douyin"],
    inputs: [
      {
        id: "productInfo",
        label: "产品及大促活动基础信息",
        type: "textarea",
        placeholder: "产品功效亮点、打折机制...",
        defaultValue: "黑松露人参精纯抗老夜间乳。主打3周淡化深度细纹，熬夜蜡黄脸救星，天猫双11预售价299元(买一赠五，送同等容量体验装加限量熬夜发光眼霜)。"
      },
      {
        id: "theme",
        label: "营销主题受众 / 情感共鸣主线",
        type: "text",
        placeholder: "例如：深夜备战中大促的打工职场人自救、情人节浪漫告白等",
        defaultValue: "深夜打工人/精致白领的爆肝抗衰自救课，拒绝垮脸拒绝黄气"
      },
      {
        id: "objectives",
        label: "关键营销目的",
        type: "select",
        placeholder: "选择主要目标",
        options: [
          { label: "痛点种草、心动拔草 (适合小红书)", value: "小红书爆款种草" },
          { label: "黄金3秒钩子冲突带货 (适合抖音脚本)", value: "抖音高转化脚本" },
          { label: "私域大促限时秒杀催单 (适合社群微信)", value: "私域社群催付抢购" }
        ],
        defaultValue: "抖音高转化脚本"
      }
    ]
  },
  {
    id: "sales-forecast",
    name: "「供应链部」大宗销量走势销量精算师 Agent",
    icon: "TrendingUp",
    status: "coming_soon",
    department: "供应链物流",
    description: "对比本届大促引流策略、平台费率政策、分仓物流偏好，由自适应多变量算法推导大宗发货备货销售天数与安全阀建议。",
    platforms: ["tmall_global", "jd", "pinduoduo", "b2b_wholesale", "b2b_offline"],
    inputs: [
      {
        id: "pastSales",
        label: "近月/近一周期销量历史快照",
        type: "textarea",
        placeholder: "请输入近期电商各月份的客单价与出库量...",
        defaultValue: "3月份：整店销量3800单，客单250W；4月份：整店销量4500单，客单310W；5月常态预热：整店销量5800单，客单420W。"
      },
      {
        id: "campaignPlan",
        label: "本期营销引流推流排期表",
        type: "textarea",
        placeholder: "如大促周期、直播间排期、达人坑位布局...",
        defaultValue: "618大促即将爆发，共计与30位自媒体头部达人及中腰部红人合作；整店额外直通车品效广告投入比上月暴增40%；主要爆款防晒服进行降级回馈降价15%打爆市场。"
      },
      {
        id: "targetGrowth",
        label: "管理期望同比增幅 (%)",
        type: "text",
        placeholder: "例如：50%",
        defaultValue: "45%"
      }
    ]
  },
  {
    id: "campaign-planner",
    name: "「运营部」全域大促战案金牌策划官 Agent",
    icon: "Calendar",
    status: "coming_soon",
    department: "运营部",
    description: "根据集团各渠道P&L账面扣点和在厂流转DOH周期，高并发生成各子渠道（淘宝盖单、抖音打卡、拼多多超级买赠）的最佳玩法矩阵。",
    platforms: ["tmall", "tmall_global", "jd", "pinduoduo", "douyin", "b2b_wholesale"],
    inputs: [
      {
        id: "festivalName",
        label: "大促主档期名称 / 促销大考节点",
        type: "text",
        placeholder: "如：618年中狂欢盛典、双十一超级爆发季...",
        defaultValue: "618品牌首届年中‘清凉一夏’联合狂欢促销盛宴"
      },
      {
        id: "budget",
        label: "大促总推广预算分配策略",
        type: "textarea",
        placeholder: "投放总费用，直播间配置，优惠券池配置...",
        defaultValue: "站内投放直通车+超级推荐共40万；达人种草带货共30万；私域群红包与专属优惠返现券池15万；快递保障物流护航包5万。"
      },
      {
        id: "goals",
        label: "考核总销量/GMV与客单构成",
        type: "text",
        placeholder: "销售额目标与主推品类期望值",
        defaultValue: "狂卷800万GMV，客单价稳定在180元左右，主推两款黑松露抗老新品。"
      }
    ]
  },
  {
    id: "inventory-replenish",
    name: "「供应链部」跨分仓存料与周转调度专家 Agent",
    icon: "Layers",
    status: "coming_soon",
    department: "供应链物流",
    description: "实时读取多区域仓库存备、残次率、物流积单堵塞和原厂排单时效(Lead Time)，产出精准避开爆仓和空窗风险的安全周转建议。",
    platforms: ["tmall", "jd", "pinduoduo", "b2b_wholesale", "b2b_offline"],
    inputs: [
      {
        id: "currentStock",
        label: "全仓在库库存与残次品损耗量 (SKU-A)",
        type: "text",
        placeholder: "仓储当前总量...",
        defaultValue: "在库安全件数1800件；有瑕疵包装破损滞销在库约120件。"
      },
      {
        id: "dailyVelocity",
        label: "常态每日去库消耗量 VS. 大促爆发预期消耗量",
        type: "text",
        placeholder: "日常均销量 / 大促暴涨系数",
        defaultValue: "常态全渠道消耗120件/天，周六日约180件。但是大促主爆期预计瞬间可穿透至1500件/天。"
      },
      {
        id: "leadTime",
        label: "原厂生产备货周期 + 境外/本土物流清关天数",
        type: "text",
        placeholder: "供应商耗时、仓储物流时效期...",
        defaultValue: "原厂下单备料排期生产为15天，工厂装箱卡车货运至中央仓库大概4天，总周期约19-20天。"
      },
      {
        id: "supplierState",
        label: "大促物流风险 / 供应商配合状态",
        type: "textarea",
        placeholder: "如浙江代工、境外清关堵塞、物流网点大面积爆仓风险等...",
        defaultValue: "由于端午大促临近，全国顺丰与圆通揽收运能有些吃紧，原厂包装纸箱略微有些缺货。需要提前5天申报备料。"
      }
    ]
  }
];
