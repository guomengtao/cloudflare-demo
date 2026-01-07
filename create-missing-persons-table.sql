-- 创建失踪人口案件表
CREATE TABLE IF NOT EXISTS missing_persons_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id TEXT UNIQUE NOT NULL, -- URL中的case值，如'dorothy-p-goroshko'
    url TEXT NOT NULL,
    source_text TEXT, -- 抓取的原始文本内容
    extracted_data JSON, -- 提取的结构化数据
    ai_analysis TEXT, -- AI案件分析
    webpage_code_zh TEXT, -- 简体中文网页代码
    webpage_code_en TEXT, -- 英文网页代码
    webpage_code_es TEXT, -- 西班牙语网页代码
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建生成历史记录表
CREATE TABLE IF NOT EXISTS generation_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id TEXT NOT NULL,
    language_code TEXT NOT NULL, -- 'zh', 'en', 'es'
    webpage_code TEXT,
    analysis_result TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES missing_persons_cases(case_id)
);
