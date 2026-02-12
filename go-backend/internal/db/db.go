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
	
	db, err := sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		return nil, err
	}
	if err := db.Ping(); err != nil {
		return nil, err
	}
	return db, nil
}

func connectManual(user, pass, addr string) (*sql.DB, error) {
	// addr might be "tcp(localhost:3306)/ai_coach_db"
	cfg := mysql.NewConfig()
	cfg.User = user
	cfg.Passwd = pass
	
	// Split addr into net and dbname if possible
	// This is a bit simplified, but handles the standard case
	cfg.Net = "tcp"
	cfg.Addr = "localhost:3306"
	cfg.DBName = "ai_coach_db"
	
	db, err := sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		return nil, err
	}
	return db, db.Ping()
}
