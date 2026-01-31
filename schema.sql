-- MedMitra Comprehensive Schema

-- 1. Patient Master Index
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

-- 2. MedMitra Enrollments
CREATE TABLE IF NOT EXISTS medmitra_enrollments (
    enrollment_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT UNIQUE,
    telegram_chat_id VARCHAR(50),
    language VARCHAR(10) DEFAULT 'en',
    complaint VARCHAR(255),
    diagnosis VARCHAR(255),
    consent_status TINYINT(1) DEFAULT 0,
    last_interaction TIMESTAMP NULL,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES master_patient_index(patient_id) ON DELETE CASCADE
);

-- 3. Medication Reminders
CREATE TABLE IF NOT EXISTS medmitra_reminders (
    reminder_id INT AUTO_INCREMENT PRIMARY KEY,
    enrollment_id INT,
    drug_name VARCHAR(100),
    dose_instruction VARCHAR(100),
    schedule_times JSON,
    FOREIGN KEY (enrollment_id) REFERENCES medmitra_enrollments(enrollment_id) ON DELETE CASCADE
);

-- 4. Interaction Logs
CREATE TABLE IF NOT EXISTS medmitra_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT,
    message_sent TEXT,
    response VARCHAR(50),
    response_at TIMESTAMP NULL,
    telegram_message_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. System Users (Staff/Admin)
CREATE TABLE IF NOT EXISTS system_users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    telegram_chat_id VARCHAR(50),
    name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'STAFF', -- 'SUPER_ADMIN', 'ADMIN', 'STAFF'
    otp_code VARCHAR(10),
    otp_expires_at TIMESTAMP NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed Super Admin
INSERT INTO system_users (email, telegram_chat_id, name, role, status)
VALUES ('ritesh.sinha37738@paruluniversity.ac.in', '-447215316', 'Dr. Ritesh Sinha', 'SUPER_ADMIN', 'ACTIVE')
ON DUPLICATE KEY UPDATE name='Dr. Ritesh Sinha', role='SUPER_ADMIN', telegram_chat_id='-447215316';