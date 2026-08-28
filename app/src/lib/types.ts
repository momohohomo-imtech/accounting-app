export type Client = {
  id: string;
  name: string;
  type: "vendor" | "customer" | "both";
  phone: string | null;
  memo: string | null;
  created_at: string;
};

export type Site = {
  id: string;
  name: string;
  location: string | null;
  manager_name: string | null;
  client_id: string | null;
  color: string | null;
  created_at: string;
  clients?: Client;
};

export type Project = {
  id: string;
  site_id: string;
  parent_project_id: string | null;
  name: string;
  project_code: string | null;
  status: "review" | "ongoing" | "done" | "merged" | "etc";
  is_service: boolean;
  start_date: string | null;
  end_date: string | null;
  progress_pct: number | null;
  quote_amount: number | null;
  contract_amount: number | null;
  contract_amount_estimated: boolean;
  order_date: string | null;
  memo: string | null;
  year: number;
  created_at: string;
  sites?: Site;
};

export type PaymentMethod = {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
};

export type ExpenseCategory = {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
};

export type Transaction = {
  id: string;
  trans_date: string;
  type: "매입" | "매출";
  client_id: string | null;
  client_name_raw: string | null;
  project_id: string | null;
  item_name: string | null;
  category: string | null;
  category_id: string | null;
  quantity: number | null;
  unit_price: number | null;
  card_company: string | null;
  payment_method_id: string | null;
  tax_invoice_issued: boolean;
  vat_included: boolean;
  purchase_amount: number;
  purchase_vat: number;
  sales_amount: number;
  sales_vat: number;
  payment_type: "immediate" | "credit";
  is_verified_ai: boolean;
  receipt_image_url: string | null;
  ocr_extracted_raw: unknown;
  note1: string | null;
  note2: string | null;
  created_by: string | null;
  created_at: string;
  clients?: Client;
  projects?: Project;
  payment_methods?: PaymentMethod;
  expense_categories?: ExpenseCategory;
};

export type CreditPayment = {
  id: string;
  transaction_id: string;
  paid_date: string;
  paid_amount: number;
  remaining_amount: number;
  settlement_transaction_id: string | null;
  created_at: string;
};

export type WorkLog = {
  id: string;
  log_date: string;
  project_id: string | null;
  site_id: string | null;
  title: string;
  workers: string | null;
  start_time: string | null;
  end_time: string | null;
  content: string | null;
  color: string | null;
  sort_order: number;
  created_at: string;
  projects?: Project;
  sites?: Site;
};

export type Employee = {
  id: string;
  employee_no: string | null;
  name: string;
  role: string | null;
  department: string | null;
  employment_type: string | null;
  hired_date: string | null;
  resigned_date: string | null;
  birth_date: string | null;
  nationality: string | null;
  phone: string | null;
  home_phone: string | null;
  address: string | null;
  memo: string | null;
  emergency1_relation: string | null;
  emergency1_phone: string | null;
  emergency2_relation: string | null;
  emergency2_phone: string | null;
  monthly_salary: number | null;
  national_pension: number;
  health_insurance: number;
  long_term_care_insurance: number;
  employment_insurance: number;
  income_tax: number;
  local_income_tax: number;
  rural_tax: number;
  created_at: string;
};

export type Payroll = {
  id: string;
  employee_id: string;
  pay_month: string;
  work_days: number | null;
  amount: number;
  bonus: number;
  national_pension: number;
  health_insurance: number;
  long_term_care_insurance: number;
  employment_insurance: number;
  employment_insurance_refund: number;
  income_tax: number;
  local_income_tax: number;
  rural_tax: number;
  non_taxable_unreported: number;
  memo: string | null;
  created_at: string;
  employees?: Employee;
};

export type DailyWorkerOffice = {
  id: string;
  name: string;
  manager_name: string | null;
  phone: string | null;
  created_at: string;
};

export type DailyWorker = {
  id: string;
  office_id: string;
  name: string;
  birth_date: string | null;
  phone: string | null;
  nationality: string | null;
  current_location: string | null;
  status: "active" | "ended";
  memo: string | null;
  grade: string | null;
  resident_id_masked: string | null;
  language_ability: string | null;
  other_ability: string | null;
  bank_name: string | null;
  account_number: string | null;
  registered_at: string;
  daily_worker_offices?: DailyWorkerOffice;
};

export type AccessList = {
  id: string;
  company_name: string;
  site_id: string | null;
  supervisor_name: string | null;
  access_period: string | null;
  created_at: string;
  sites?: Site;
};

export type BankAccount = {
  id: string;
  bank_name: string;
  nickname: string | null;
  account_number: string | null;
  opening_balance: number;
  created_at: string;
};

export type BankTransaction = {
  id: string;
  bank_account_id: string;
  trans_date: string;
  description: string | null;
  direction: "입금" | "출금";
  amount: number;
  matched_client_id: string | null;
  matched_transaction_id: string | null;
  created_at: string;
  clients?: Client;
};

export type Backup = {
  id: string;
  file_name: string;
  file_size_mb: number | null;
  backup_type: "auto" | "manual";
  storage_url: string;
  created_at: string;
};

export type BusinessTripWorker = { name: string; work_date: string; overtime: boolean; note: string };
export type BusinessTripEquipment = { name: string; location: string; hours: string; note: string };
export type BusinessTripExpense = { vendor: string; amount: string; note: string };

export type BusinessTripLog = {
  id: string;
  work_date: string;
  created_date: string;
  client_name: string | null;
  site_name: string | null;
  project_name: string | null;
  work_types: string[];
  note: string | null;
  workers: BusinessTripWorker[];
  total_manpower: string | null;
  equipment: BusinessTripEquipment[];
  expenses: BusinessTripExpense[];
  created_at: string;
};
