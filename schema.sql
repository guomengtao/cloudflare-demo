-- 高血压分析记录表
CREATE TABLE IF NOT EXISTS hypertension_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_data TEXT NOT NULL,
    analysis_result TEXT NOT NULL,
    analysis_date DATETIME DEFAULT CURRENT_TIMESTAMP
);