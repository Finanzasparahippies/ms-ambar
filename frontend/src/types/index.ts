export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  is_superuser: boolean;
  phone?: string;
}

export interface UserProfile extends User {
  phone: string;
}

export interface Theater {
  id: number;
  name: string;
  location: string;
  layout: any; // Ideally this should be typed further if structure is known
}

export interface Event {
  id: number;
  title: string;
  artist: string;
  date: string;
  event_type: 'concert' | 'meet_greet';
  theater?: number | Theater;
  image?: string;
  flyer?: string;
  is_active: boolean;
  mg_price: number | string;
  mg_limit: number;
  price_multiplier: number | string;
  seatless_ticket_price?: number | string;
  numbered_ticket_price?: number | string;
  enable_dynamic_pricing?: boolean;
  monthly_price_increment?: number | string;
  allow_seatless_tickets?: boolean;
  allow_numbered_tickets?: boolean;
  venue_name?: string;
  venue_address?: string;
}

export interface Ticket {
  id: number;
  event: Event;
  seat?: any;
  ga_zone?: any;
  user_email: string;
  user_phone?: string;
  status: 'reserved' | 'paid' | 'used' | 'cancelled';
  token: string;
  has_mg: boolean;
  amount_paid?: string | number;
  created_at: string;
}

export interface OrderItem {
  product_id: number | null;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Order {
  id: number;
  user_email: string;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
  total_amount: number;
  created_at: string;
  full_name: string;
  address: string;
  city: string;
  country: string;
  items: OrderItem[];
}

export interface Expense {
  id: number;
  title: string;
  amount: number;
  category: string;
  description: string;
  created_at: string;
}

export interface Coupon {
  id: number;
  code: string;
  discount_type: 'free_vip' | 'percentage' | 'fixed';
  discount_value: number | string;
  max_uses: number;
  times_used: number;
  is_active: boolean;
  event: number | null;
  event_title?: string | null;
  assigned_email?: string | null;
  expiration_date?: string | null;
  created_at?: string;
}

export interface Campaign {
  id: number;
  subject: string;
  poem_text: string;
  email_title?: string;
  footer_text?: string;
  template_type: string;
  image?: string;
  bg_image?: string;
  bg_opacity?: number;
  bg_saturation?: number;
  bg_position?: string;
  cta_text?: string;
  cta_link?: string;
  font_family?: string;
  title_font_family?: string;
  footer_font_family?: string;
  image_style?: any;
  ctas?: any[];
  custom_styles?: any;
  marketing_list?: number | string;
}

export interface MarketingList {
  id: number;
  name: string;
  description: string;
  slug: string;
}

export interface Subscriber {
  id: number;
  email: string;
  name?: string;
  is_active: boolean;
  is_premium: boolean;
}

export interface CampaignTemplateImage {
  id: number;
  image: string;
  created_at: string;
}

export interface BookingInquiry {
  id: number;
  name: string;
  email: string;
  phone: string;
  company?: string;
  date?: string;
  venue_type: string;
  message: string;
  created_at: string;
  is_reviewed: boolean;
  contract_id?: number;
}

export interface BookingContract {
  id: number;
  inquiry: number | BookingInquiry;
  inquiry_detail?: BookingInquiry;
  fee: number | string;
  signature_base64?: string;
  signed_at?: string;
  manager_signature?: string;
  manager_signed_at?: string;
  is_fully_signed: boolean;
  created_at: string;
  pdf_file?: string;
}

export interface ProductSpecification {
  material?: string;
  dimensions?: string;
  weight?: string;
  care_instructions?: string;
  origin?: string;
  details?: Record<string, string>;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  description: string;
  detailed_description?: string;
  specifications?: ProductSpecification;
  price: string | number;
  stock: number;
  category: number | string | { id?: number; name: string; slug?: string };
  category_name?: string;
  is_active: boolean;
  image?: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
}

export interface Financials {
  gross_sales: number;
  ticket_sales: number;
  shop_sales: number;
  mg_revenue: number;
  total_expenses: number;
  net_profit: number;
}

export interface DashboardStats {
  financials: Financials;
  users?: {
    new_users: number;
    total_users: number;
  };
  funnel?: {
    successful_count: number;
    successful_amount: number;
    failed_count: number;
  };
  tickets: {
    total_sold: number;
    mg_upgrades: number;
  };
  shop: {
    total_orders: number;
    low_stock_count: number;
    total_products: number;
    top_products: any[];
  };
  vitals: any[];
  charts: {
    daily_sales: any[];
    weekly_sales: any[];
    monthly_sales: any[];
    event_sales: any[];
    revenue_breakdown: any[];
  };
  ads?: {
    is_connected?: boolean;
    summary?: {
      total_spend: number;
      total_impressions: number;
      total_clicks: number;
      total_conversions: number;
      ctr: number;
      cpa: number;
      roas: number;
    };
    platforms?: any;
    campaigns?: any[];
  };
  status: string;
  is_restricted?: boolean;
  is_historical_fallback?: boolean;
}

export interface SystemMetrics {
  cpu: {
    percent: number;
    cores: number;
  };
  memory: {
    total_gb: number;
    used_gb: number;
    percent: number;
  };
  disk: {
    total_gb: number;
    used_gb: number;
    percent: number;
  };
  database: {
    status: string;
  };
  system: {
    uptime: string;
    message?: string;
  };
}
