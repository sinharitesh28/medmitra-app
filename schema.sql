CREATE TABLE IF NOT EXISTS master_patient_index (
    patient_id INT AUTO_INCREMENT PRIMARY KEY,
    ip_no VARCHAR(50),
    opd_no VARCHAR(50) UNIQUE,
    full_name VARCHAR(100),
    age INT,
    gender VARCHAR(20),
    contact_number VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS medmitra_enrollments (
    enrollment_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT UNIQUE,
    telegram_chat_id VARCHAR(50),
    consent_status TINYINT(1) DEFAULT 0,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES master_patient_index(patient_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS medmitra_reminders (
    reminder_id INT AUTO_INCREMENT PRIMARY KEY,
    enrollment_id INT,
    drug_name VARCHAR(100),
    dose_instruction VARCHAR(100),
    schedule_times JSON,
    FOREIGN KEY (enrollment_id) REFERENCES medmitra_enrollments(enrollment_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS medmitra_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT,
    message_sent TEXT,
    response VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
