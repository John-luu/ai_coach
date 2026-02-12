package repo

import (
	"time"

	"aicoach-backend-go/internal/models"
)

type MemoryUserRepo struct {
	users map[string]*models.User
}

func NewMemoryUserRepo() *MemoryUserRepo {
	return &MemoryUserRepo{users: make(map[string]*models.User)}
}

func (r *MemoryUserRepo) FindByUsername(username string) (*models.User, error) {
	if u, ok := r.users[username]; ok {
		return u, nil
	}
	return nil, nil
}

func (r *MemoryUserRepo) FindByEmail(email string) (*models.User, error) {
	for _, u := range r.users {
		if u.Email == email {
			return u, nil
		}
	}
	return nil, nil
}

func (r *MemoryUserRepo) Create(username, email, password, displayName string) (*models.User, error) {
	now := time.Now()
	u := &models.User{
		ID:            time.Now().UnixNano(),
		Username:      username,
		Email:         email,
		Password:      password,
		DisplayName:   displayName,
		HasAssessment: 0,
		Stage:         1,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	r.users[username] = u
	return u, nil
}

func (r *MemoryUserRepo) UpdateHasAssessment(id int64, status int) error {
	for _, u := range r.users {
		if u.ID == id {
			u.HasAssessment = status
			return nil
		}
	}
	return nil
}

func (r *MemoryUserRepo) UpdateStage(id int64, stage int) error {
	for _, u := range r.users {
		if u.ID == id {
			u.Stage = stage
			return nil
		}
	}
	return nil
}

func (r *MemoryUserRepo) SaveAssessment(userID int64, requestJSON, resultJSON string) error {
	// 内存模式下暂时不实现详细存储，仅保证接口兼容
	return nil
}

func (r *MemoryUserRepo) GetPreferredStyleByJoin(userID int64) (string, error) {
	return "", nil
}

func (r *MemoryUserRepo) SaveProfile(userID int64, level, summary, tagsJSON, gapsJSON string) error {
	return nil
}

func (r *MemoryUserRepo) SavePlan(userID int64, dailyTime string, phases []struct {
	Title       string `json:"title"`
	Description string `json:"description"`
}) error {
	return nil
}

func (r *MemoryUserRepo) GetLatestAssessment(userID int64) (string, string, error) {
	return "", "", nil
}
