package main

import (
	"log"
	"net/http"

	"aicoach-backend-go/handlers"
	"aicoach-backend-go/internal/ai"
	"aicoach-backend-go/internal/auth"
	"aicoach-backend-go/internal/config"
	"aicoach-backend-go/internal/db"
	"aicoach-backend-go/internal/repo"
)

func buildMux() *http.ServeMux {
	mux := http.NewServeMux()
	// Load config from environment variables
	cfg := config.Load()

	// Database and repos
	var userStore repo.UserStore
	var chatStore repo.ChatStore
	sqlDB, err := db.Connect(cfg.DBUser, cfg.DBPass, cfg.DBUrl)
	if err != nil || sqlDB == nil {
		log.Printf("DB connect error: %v; using in-memory user store", err)
		userStore = repo.NewMemoryUserRepo()
		chatStore = repo.NewMemoryChatRepo()
	} else {
		log.Println("数据库连接成功")
		userStore = repo.NewUserRepo(sqlDB)
		chatStore = repo.NewChatRepo(sqlDB)
	}

	// Auth
	signer := auth.NewTokenSigner(cfg.JWTSecret, cfg.JWTExpirationMillis)
	authHandlers := handlers.NewAuthHandlers(userStore, signer)
	mux.HandleFunc("/api/auth/login", authHandlers.Login)
	mux.HandleFunc("/api/auth/register", authHandlers.Register)
	mux.HandleFunc("/api/auth/validate-token", authHandlers.ValidateToken)

	// Suggestions
	mux.HandleFunc("/api/ai/suggestions", handlers.Suggestions)

	// Assessment
	aiClient := ai.New(cfg.AIBaseURL, cfg.AIKey, cfg.AIModel)
	assessment := handlers.NewAssessmentHandler(aiClient, userStore, signer)
	mux.HandleFunc("/api/assessment/evaluate", assessment.Evaluate)
	mux.HandleFunc("/api/assessment/latest", assessment.GetLatest)

	// Chat
	chatHandler := handlers.NewChatHandler(aiClient, userStore, chatStore, signer)
	mux.HandleFunc("/api/ai/chat", chatHandler.Chat)
	mux.HandleFunc("/api/chat/session", chatHandler.CreateSession)
	mux.HandleFunc("/api/chat/sessions", chatHandler.GetSessions)
	mux.HandleFunc("/api/chat/messages", chatHandler.GetMessages)

	// Cross-stage test
	crossStageHandler := handlers.NewCrossStageHandler(aiClient, userStore, signer)
	mux.HandleFunc("/api/cross-stage/generate", crossStageHandler.CrossStageGenerate)
	mux.HandleFunc("/api/cross-stage/submit", crossStageHandler.CrossStageSubmit)

	return mux
}
