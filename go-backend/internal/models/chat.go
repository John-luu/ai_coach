package models

import "time"

type ChatSession struct {
	ID        string    `json:"id"`
	UserID    int64     `json:"userId"`
	Title     string    `json:"title"`
	CreatedAt time.Time `json:"createdAt"`
}

type ChatMessage struct {
	ID        int64     `json:"id"`
	SessionID string    `json:"sessionId"`
	Role      string    `json:"role"` // "user" or "ai"
	Content   string    `json:"content"`
	Sequence  int       `json:"sequence"`
	CreatedAt time.Time `json:"createdAt"`
}
