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

-- Seed Super Admin (Insert or Update if exists)
INSERT INTO system_users (email, telegram_chat_id, name, role, status)
VALUES ('ritesh.sinha37738@paruluniversity.ac.in', '-447215316', 'Ritesh Sinha', 'SUPER_ADMIN', 'ACTIVE')
ON DUPLICATE KEY UPDATE role='SUPER_ADMIN', telegram_chat_id='-447215316';
