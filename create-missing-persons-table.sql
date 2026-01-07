-- 失踪人口案件表
CREATE TABLE IF NOT EXISTS missing_persons_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_url TEXT NOT NULL UNIQUE,
    case_title TEXT,
    scraped_content TEXT,
    analysis_result TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 生成历史记录表
CREATE TABLE IF NOT EXISTS generation_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER,
    target_language TEXT NOT NULL,
    generated_content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES missing_persons_cases(id)
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_case_url ON missing_persons_cases(case_url);
CREATE INDEX IF NOT EXISTS idx_created_at ON missing_persons_cases(created_at);
CREATE INDEX IF NOT EXISTS idx_case_id ON generation_history(case_id);
CREATE INDEX IF NOT EXISTS idx_language ON generation_history(target_language);