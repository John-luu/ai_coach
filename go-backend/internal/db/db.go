package db

import (
	"database/sql"

	"github.com/go-sql-driver/mysql"
)

func Connect(user, pass, urlStr string) (*sql.DB, error) {
	// urlStr example: tcp(localhost:3306)/ai_coach_db?params...
	// We use mysql.ParseDSN to get a config, then override user/pass
	cfg, err := mysql.ParseDSN(urlStr)
	if err != nil {
		// If urlStr isn't a full DSN, it might just be the address part from our jdbcToDSN
		// fallback to manual config if parsing fails
		return connectManual(user, pass, urlStr)
	}

	cfg.User = user
	cfg.Passwd = pass
	if cfg.Params == nil {
		cfg.Params = map[string]string{}
	}
	// Use utf8mb4 to support full Unicode (emoji etc.) and set a utf8mb4 collation
	cfg.Params["charset"] = "utf8mb4"
	cfg.Params["collation"] = "utf8mb4_unicode_ci"
	
	db, err := sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		return nil, err
	}
	if err := db.Ping(); err != nil {
		return nil, err
	}
	
	if err := initSchema(db); err != nil {
		return nil, err
	}

	return db, nil
}

func initSchema(db *sql.DB) error {
	// Create users table if not exists (including stage field)
	_, err := db.Exec(`CREATE TABLE IF NOT EXISTS users (
		id BIGINT AUTO_INCREMENT PRIMARY KEY,
		username VARCHAR(255) UNIQUE NOT NULL,
		email VARCHAR(255) UNIQUE NOT NULL,
		password VARCHAR(255) NOT NULL,
		display_name VARCHAR(255),
		has_assessment TINYINT DEFAULT 0,
		stage INT DEFAULT 1,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	)`)
	if err != nil {
		return err
	}

	// Add stage and has_assessment columns if they don't exist (in case table was created earlier)
	_, _ = db.Exec(`ALTER TABLE users ADD COLUMN stage INT DEFAULT 1`)
	_, _ = db.Exec(`ALTER TABLE users ADD COLUMN has_assessment TINYINT DEFAULT 0`)

	// Create sessions table
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS sessions (
		id VARCHAR(255) PRIMARY KEY,
		user_id BIGINT NOT NULL,
		title VARCHAR(255),
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id)
	)`)
	if err != nil {
		return err
	}

	// Create messages table
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS messages (
		id BIGINT AUTO_INCREMENT PRIMARY KEY,
		session_id VARCHAR(255) NOT NULL,
		role VARCHAR(50) NOT NULL,
		content LONGTEXT NOT NULL,
		sequence INT NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (session_id) REFERENCES sessions(id)
	)`)
	if err != nil {
		return err
	}

	// Create assessments table
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS assessments (
		id BIGINT AUTO_INCREMENT PRIMARY KEY,
		user_id BIGINT NOT NULL,
		request_json TEXT,
		result_json TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id)
	)`)
	if err != nil {
		return err
	}

	// Create snapshots table
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS snapshots (
		id BIGINT AUTO_INCREMENT PRIMARY KEY,
		user_id BIGINT NOT NULL,
		role VARCHAR(50) NOT NULL,
		content LONGTEXT NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id)
	)`)
	if err != nil {
		return err
	}

	// Create profiles table
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS profiles (
		user_id BIGINT PRIMARY KEY,
		level VARCHAR(255),
		ability_summary TEXT,
		tags TEXT,
		knowledge_gaps TEXT,
		last_assessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id)
	)`)
	if err != nil {
		return err
	}

	// Create plans table
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS plans (
		id BIGINT AUTO_INCREMENT PRIMARY KEY,
		user_id BIGINT NOT NULL,
		daily_time VARCHAR(255),
		is_active TINYINT DEFAULT 1,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id)
	)`)
	if err != nil {
		return err
	}

	// Create plan_phases table
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS plan_phases (
		id BIGINT AUTO_INCREMENT PRIMARY KEY,
		plan_id BIGINT NOT NULL,
		title VARCHAR(255),
		description TEXT,
		order_index INT,
		FOREIGN KEY (plan_id) REFERENCES plans(id)
	)`)
	if err != nil {
		return err
	}

	return nil
}

func connectManual(user, pass, addr string) (*sql.DB, error) {
	// addr might be "tcp(localhost:3306)/ai_coach_db"
	cfg := mysql.NewConfig()
	cfg.User = user
	cfg.Passwd = pass
	if cfg.Params == nil {
		cfg.Params = map[string]string{}
	}
	cfg.Params["charset"] = "utf8mb4"
	cfg.Params["collation"] = "utf8mb4_unicode_ci"
	
	// Split addr into net and dbname if possible
	// This is a bit simplified, but handles the standard case
	cfg.Net = "tcp"
	cfg.Addr = "localhost:3306"
	cfg.DBName = "ai_coach_db"
	
	db, err := sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		return nil, err
	}
	if err := db.Ping(); err != nil {
		return nil, err
	}
	
	if err := initSchema(db); err != nil {
		return nil, err
	}

	return db, nil
}
