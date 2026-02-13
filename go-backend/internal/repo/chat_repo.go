package repo

import (
	"database/sql"
	"fmt"
	"time"

	"aicoach-backend-go/internal/models"
)

type ChatStore interface {
	CreateSession(userID int64, title string) (*models.ChatSession, error)
	GetSessionsByUserID(userID int64) ([]*models.ChatSession, error)
	GetSessionByID(sessionID string) (*models.ChatSession, error)
	UpdateSessionTitle(sessionID string, title string) error
	
	AddMessage(sessionID string, role, content string, sequence int) (*models.ChatMessage, error)
	GetMessagesBySessionID(sessionID string) ([]*models.ChatMessage, error)
	GetMessageCount(sessionID string) (int, error)
	GetActivityDates(userID int64) ([]string, error)
	GetLatestMessageTime(userID int64) (time.Time, error)
}

type ChatRepo struct {
	DB *sql.DB
}

func NewChatRepo(db *sql.DB) *ChatRepo {
	return &ChatRepo{DB: db}
}

func (r *ChatRepo) CreateSession(userID int64, title string) (*models.ChatSession, error) {
	id := fmt.Sprintf("%d-%d", userID, time.Now().UnixNano())
	now := time.Now()
	_, err := r.DB.Exec(`INSERT INTO sessions (id, user_id, title, created_at) VALUES (?, ?, ?, ?)`,
		id, userID, title, now)
	if err != nil {
		return nil, err
	}
	return &models.ChatSession{
		ID:        id,
		UserID:    userID,
		Title:     title,
		CreatedAt: now,
	}, nil
}

func (r *ChatRepo) GetSessionsByUserID(userID int64) ([]*models.ChatSession, error) {
	rows, err := r.DB.Query(`SELECT id, user_id, title, created_at FROM sessions WHERE user_id = ? ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []*models.ChatSession
	for rows.Next() {
		var s models.ChatSession
		var createdAtStr string
		if err := rows.Scan(&s.ID, &s.UserID, &s.Title, &createdAtStr); err != nil {
			return nil, err
		}
		s.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", createdAtStr)
		if s.CreatedAt.IsZero() {
			s.CreatedAt, _ = time.Parse(time.RFC3339, createdAtStr)
		}
		sessions = append(sessions, &s)
	}
	return sessions, nil
}

func (r *ChatRepo) GetSessionByID(sessionID string) (*models.ChatSession, error) {
	row := r.DB.QueryRow(`SELECT id, user_id, title, created_at FROM sessions WHERE id = ?`, sessionID)
	var s models.ChatSession
	var createdAtStr string
	if err := row.Scan(&s.ID, &s.UserID, &s.Title, &createdAtStr); err != nil {
		return nil, err
	}
	s.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", createdAtStr)
	if s.CreatedAt.IsZero() {
		s.CreatedAt, _ = time.Parse(time.RFC3339, createdAtStr)
	}
	return &s, nil
}

func (r *ChatRepo) UpdateSessionTitle(sessionID string, title string) error {
	_, err := r.DB.Exec(`UPDATE sessions SET title = ? WHERE id = ?`, title, sessionID)
	return err
}

func (r *ChatRepo) AddMessage(sessionID string, role, content string, sequence int) (*models.ChatMessage, error) {
	now := time.Now()
	res, err := r.DB.Exec(`INSERT INTO messages (session_id, role, content, sequence, created_at) VALUES (?, ?, ?, ?, ?)`,
		sessionID, role, content, sequence, now)
	if err != nil {
		return nil, err
	}
	id, _ := res.LastInsertId()
	return &models.ChatMessage{
		ID:        id,
		SessionID: sessionID,
		Role:      role,
		Content:   content,
		Sequence:  sequence,
		CreatedAt: now,
	}, nil
}

func (r *ChatRepo) GetMessagesBySessionID(sessionID string) ([]*models.ChatMessage, error) {
	rows, err := r.DB.Query(`SELECT id, session_id, role, content, sequence, created_at FROM messages WHERE session_id = ? ORDER BY sequence ASC`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []*models.ChatMessage
	for rows.Next() {
		var m models.ChatMessage
		var createdAtStr string
		if err := rows.Scan(&m.ID, &m.SessionID, &m.Role, &m.Content, &m.Sequence, &createdAtStr); err != nil {
			return nil, err
		}
		m.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", createdAtStr)
		if m.CreatedAt.IsZero() {
			m.CreatedAt, _ = time.Parse(time.RFC3339, createdAtStr)
		}
		messages = append(messages, &m)
	}
	return messages, nil
}

func (r *ChatRepo) GetMessageCount(sessionID string) (int, error) {
	var count int
	err := r.DB.QueryRow(`SELECT COUNT(*) FROM messages WHERE session_id = ?`, sessionID).Scan(&count)
	return count, err
}

func (r *ChatRepo) GetActivityDates(userID int64) ([]string, error) {
	// 获取用户所有会话中有消息产生的日期
	rows, err := r.DB.Query(`
		SELECT DISTINCT DATE(m.created_at) as activity_date 
		FROM messages m
		JOIN sessions s ON m.session_id = s.id
		WHERE s.user_id = ?
		ORDER BY activity_date ASC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var dates []string
	for rows.Next() {
		var d string
		if err := rows.Scan(&d); err != nil {
			return nil, err
		}
		dates = append(dates, d)
	}
	return dates, nil
}

func (r *ChatRepo) GetLatestMessageTime(userID int64) (time.Time, error) {
	var tStr string
	err := r.DB.QueryRow(`
		SELECT m.created_at 
		FROM messages m
		JOIN sessions s ON m.session_id = s.id
		WHERE s.user_id = ?
		ORDER BY m.created_at DESC
		LIMIT 1
	`, userID).Scan(&tStr)
	if err != nil {
		if err == sql.ErrNoRows {
			return time.Time{}, nil
		}
		return time.Time{}, err
	}
	t, err := time.Parse("2006-01-02 15:04:05", tStr)
	if err != nil {
		t, err = time.Parse(time.RFC3339, tStr)
	}
	return t, err
}

type MemoryChatRepo struct {
	sessions map[string]*models.ChatSession
	messages map[string][]*models.ChatMessage
}

func NewMemoryChatRepo() *MemoryChatRepo {
	return &MemoryChatRepo{
		sessions: make(map[string]*models.ChatSession),
		messages: make(map[string][]*models.ChatMessage),
	}
}

func (r *MemoryChatRepo) CreateSession(userID int64, title string) (*models.ChatSession, error) {
	id := fmt.Sprintf("%d-%d", userID, time.Now().UnixNano())
	now := time.Now()
	s := &models.ChatSession{
		ID:        id,
		UserID:    userID,
		Title:     title,
		CreatedAt: now,
	}
	r.sessions[id] = s
	return s, nil
}

func (r *MemoryChatRepo) GetSessionsByUserID(userID int64) ([]*models.ChatSession, error) {
	var res []*models.ChatSession
	for _, s := range r.sessions {
		if s.UserID == userID {
			res = append(res, s)
		}
	}
	// Sort by created_at desc would be nice but for memory repo it's okay
	return res, nil
}

func (r *MemoryChatRepo) GetSessionByID(sessionID string) (*models.ChatSession, error) {
	if s, ok := r.sessions[sessionID]; ok {
		return s, nil
	}
	return nil, nil
}

func (r *MemoryChatRepo) UpdateSessionTitle(sessionID string, title string) error {
	if s, ok := r.sessions[sessionID]; ok {
		s.Title = title
	}
	return nil
}

func (r *MemoryChatRepo) AddMessage(sessionID string, role, content string, sequence int) (*models.ChatMessage, error) {
	now := time.Now()
	m := &models.ChatMessage{
		ID:        time.Now().UnixNano(),
		SessionID: sessionID,
		Role:      role,
		Content:   content,
		Sequence:  sequence,
		CreatedAt: now,
	}
	r.messages[sessionID] = append(r.messages[sessionID], m)
	return m, nil
}

func (r *MemoryChatRepo) GetMessagesBySessionID(sessionID string) ([]*models.ChatMessage, error) {
	return r.messages[sessionID], nil
}

func (r *MemoryChatRepo) GetActivityDates(userID int64) ([]string, error) {
	dateMap := make(map[string]bool)
	for sid, msgs := range r.messages {
		if s, ok := r.sessions[sid]; ok && s.UserID == userID {
			for _, m := range msgs {
				dateStr := m.CreatedAt.Format("2006-01-02")
				dateMap[dateStr] = true
			}
		}
	}
	var dates []string
	for d := range dateMap {
		dates = append(dates, d)
	}
	return dates, nil
}

func (r *MemoryChatRepo) GetMessageCount(sessionID string) (int, error) {
	return len(r.messages[sessionID]), nil
}

func (r *MemoryChatRepo) GetLatestMessageTime(userID int64) (time.Time, error) {
	var latest time.Time
	for sid, msgs := range r.messages {
		if s, ok := r.sessions[sid]; ok && s.UserID == userID {
			for _, m := range msgs {
				if m.CreatedAt.After(latest) {
					latest = m.CreatedAt
				}
			}
		}
	}
	return latest, nil
}

// I need to import fmt for CreateSession
