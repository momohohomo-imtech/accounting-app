-- ============================================================
-- 현장관리 앱 DB 스키마 (PostgreSQL)
-- 지금까지 화면 설계에서 나온 모든 기능을 반영한 최종안
-- ============================================================

-- ---------- 사용자 (로그인) ----------
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT UNIQUE NOT NULL,
    name            TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'admin',   -- admin / staff
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- 거래처 ----------
CREATE TABLE clients (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    type            TEXT NOT NULL DEFAULT 'both',    -- vendor(매입처) / customer(매출처) / both
    phone           TEXT,
    memo            TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- 현장 ----------
CREATE TABLE sites (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    location        TEXT,
    manager_name    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- 프로젝트 (하위 프로젝트 지원: parent_project_id) ----------
CREATE TABLE projects (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id             UUID NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
    parent_project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,  -- 프로젝트 안에 프로젝트
    name                TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'ongoing',  -- ongoing / done / etc
    is_service          BOOLEAN NOT NULL DEFAULT FALSE,   -- 서비스(무상 작업) 여부
    start_date          DATE,
    end_date            DATE,
    progress_pct        SMALLINT DEFAULT 0,
    year                SMALLINT NOT NULL,                -- 연도별 필터용 (기본 현재연도 표시)
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_projects_site ON projects(site_id);
CREATE INDEX idx_projects_parent ON projects(parent_project_id);
CREATE INDEX idx_projects_year ON projects(year);

-- ---------- 매입매출 거래 ----------
CREATE TABLE transactions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trans_date          DATE NOT NULL,
    type                TEXT NOT NULL,                 -- 매입 / 매출
    client_id           UUID REFERENCES clients(id) ON DELETE SET NULL,
    client_name_raw     TEXT,                           -- 거래처 미등록시 자유 텍스트(예: "온라인","화성")
    project_id          UUID REFERENCES projects(id) ON DELETE SET NULL,  -- 일반경비는 NULL 허용
    item_name           TEXT,
    category             TEXT,                          -- 종류구분: 출장/물품/차량/공구/회식 등
    quantity            NUMERIC,
    unit_price          NUMERIC,
    card_company        TEXT,                           -- 카드사 (삼성/KB/NH 등)
    vat_included        BOOLEAN NOT NULL DEFAULT TRUE,   -- VAT 포함/별도
    purchase_amount     NUMERIC NOT NULL DEFAULT 0,
    purchase_vat        NUMERIC NOT NULL DEFAULT 0,
    sales_amount        NUMERIC NOT NULL DEFAULT 0,
    sales_vat           NUMERIC NOT NULL DEFAULT 0,
    payment_type        TEXT NOT NULL DEFAULT 'immediate', -- immediate(즉시결제) / credit(외상)
    is_verified_ai      BOOLEAN NOT NULL DEFAULT TRUE,   -- 영수증 AI인식 후 사용자 확인여부
    receipt_image_url   TEXT,                            -- Cloud Storage 경로
    ocr_extracted_raw   JSONB,                            -- Gemini 원본 인식결과
    note1               TEXT,
    note2               TEXT,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_transactions_date ON transactions(trans_date);
CREATE INDEX idx_transactions_project ON transactions(project_id);
CREATE INDEX idx_transactions_client ON transactions(client_id);

-- ---------- 외상 결제 기록 (분할입금 이력) ----------
CREATE TABLE credit_payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id  UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    paid_date       DATE NOT NULL,
    paid_amount     NUMERIC NOT NULL,
    remaining_amount NUMERIC NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_credit_payments_tx ON credit_payments(transaction_id);

-- ---------- 작업일지 (하루 여러 건 등록 가능) ----------
CREATE TABLE work_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_date        DATE NOT NULL,
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
    title           TEXT NOT NULL,
    workers         TEXT,                    -- 자유 텍스트 (예: "김現場 외 2명")
    start_time      TIME,
    end_time        TIME,
    content         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_worklogs_date ON work_logs(log_date);
CREATE INDEX idx_worklogs_project ON work_logs(project_id);

-- ---------- 정규직 직원 ----------
CREATE TABLE employees (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    role            TEXT,
    employment_type TEXT,                    -- 정규직 / 계약직 등
    hired_date      DATE,
    phone           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payroll (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    pay_month       DATE NOT NULL,             -- 해당 월 1일로 저장
    work_days       SMALLINT,
    amount          NUMERIC NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payroll_employee ON payroll(employee_id);

-- ---------- 일용직 사무실 (인력사무소) ----------
CREATE TABLE daily_worker_offices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    manager_name    TEXT,
    phone           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- 일용직 근로자 ----------
CREATE TABLE daily_workers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id       UUID NOT NULL REFERENCES daily_worker_offices(id) ON DELETE RESTRICT,
    name            TEXT NOT NULL,
    birth_date      DATE,
    phone           TEXT,
    nationality     TEXT,
    current_location TEXT,                     -- 소속 프로젝트 대신 자유 위치 텍스트
    status          TEXT NOT NULL DEFAULT 'active', -- active(근무중) / ended(종료)
    memo            TEXT,
    registered_at   DATE NOT NULL DEFAULT CURRENT_DATE
);
CREATE INDEX idx_daily_workers_office ON daily_workers(office_id);
CREATE INDEX idx_daily_workers_location ON daily_workers(current_location);

-- 출입명단(원청 제출용) 생성 이력 - 어떤 근로자가 어느 출입명단에 포함됐는지
CREATE TABLE access_lists (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name    TEXT NOT NULL,
    site_id         UUID REFERENCES sites(id),
    supervisor_name TEXT,
    access_period   TEXT,                       -- 예: "2026-08-23~24일"
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE access_list_workers (
    access_list_id  UUID NOT NULL REFERENCES access_lists(id) ON DELETE CASCADE,
    daily_worker_id UUID NOT NULL REFERENCES daily_workers(id) ON DELETE CASCADE,
    PRIMARY KEY (access_list_id, daily_worker_id)
);

-- ---------- 은행 계좌 및 거래내역 ----------
CREATE TABLE bank_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_name       TEXT NOT NULL,
    nickname        TEXT,
    account_number  TEXT,
    opening_balance NUMERIC NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bank_transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    trans_date      DATE NOT NULL,
    description     TEXT,
    direction       TEXT NOT NULL,              -- 입금 / 출금
    amount          NUMERIC NOT NULL,
    matched_client_id UUID REFERENCES clients(id),
    matched_transaction_id UUID REFERENCES transactions(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bank_tx_account ON bank_transactions(bank_account_id);
CREATE INDEX idx_bank_tx_date ON bank_transactions(trans_date);

-- ---------- 백업 이력 (Cloud Storage에 실제 파일 저장, 여기엔 메타데이터만) ----------
CREATE TABLE backups (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name       TEXT NOT NULL,
    file_size_mb    NUMERIC,
    backup_type     TEXT NOT NULL DEFAULT 'auto',  -- auto / manual
    storage_url     TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
