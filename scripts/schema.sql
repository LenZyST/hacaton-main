CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    login VARCHAR(64) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(32) NOT NULL,
    role VARCHAR(32) DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appeals (
    appeal_id SERIAL PRIMARY KEY,
    topic VARCHAR(255) NOT NULL,
    main_text TEXT NOT NULL,
    appeal_date DATE NOT NULL,
    status VARCHAR(64) NOT NULL,
    category VARCHAR(255) DEFAULT NULL,
    subcategory VARCHAR(255) DEFAULT NULL,
    confidence REAL DEFAULT NULL,
    routing_debug TEXT DEFAULT NULL,
    user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    address VARCHAR(500) DEFAULT NULL,
    address_normalized VARCHAR(500) DEFAULT NULL,
    lat REAL DEFAULT NULL,
    lon REAL DEFAULT NULL,
    tag VARCHAR(64) DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS admin_categories (
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    category VARCHAR(255) NOT NULL,
    PRIMARY KEY (user_id, category)
);
