package config

import (
	"os"
)

type Config struct {
	ServerPort string
	DBUrl      string
	DBUser     string
	DBPass     string
	AIBaseURL  string
	AIKey      string
	AIModel    string
	JWTSecret  string
	JWTExpirationMillis int64
}

func Load() *Config {
	return &Config{
		ServerPort: getEnv("AI_COACH_PORT", "8093"),
		DBUrl:      getEnv("AI_COACH_DB_URL", "tcp(localhost:3306)/ai_coach_db?charset=utf8&parseTime=True&loc=Local"),
		DBUser:     getEnv("AI_COACH_DB_USER", "root"),
		DBPass:     getEnv("AI_COACH_DB_PASS", "Root@123456"),
		AIBaseURL:  getEnv("AI_COACH_AI_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1"),
		AIKey:      getEnv("AI_COACH_AI_KEY", "sk-9915ab699b7f46ccbecdea96cdd6c342"),
		AIModel:    getEnv("AI_COACH_AI_MODEL", "qwen-plus"),
		JWTSecret:  getEnv("AI_COACH_JWT_SECRET", "ai-coach-jwt-secret-key-2024-strong-password"),
		JWTExpirationMillis: 10800000, // 3 hours (3 * 3600 * 1000)
	}
}

func getEnv(key, fallback string) string {
	val := os.Getenv(key)
	if val == "" {
		return fallback
	}
	return val
}
