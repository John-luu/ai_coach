package repo

import (
	"database/sql"
	"errors"
	"log"

	"aicoach-backend-go/internal/models"
)

type UserStore interface {
	FindByUsername(username string) (*models.User, error)
	FindByEmail(email string) (*models.User, error)
	Create(username, email, password, displayName string) (*models.User, error)
	UpdateHasAssessment(id int64, status int) error
	// 新增：保存体检记录
	SaveAssessment(userID int64, requestJSON, resultJSON string) error
	// 新增：获取用户最新的体检风格偏好（连表查询示例）
	GetPreferredStyleByJoin(userID int64) (string, error)
	// 新增：保存用户画像
	SaveProfile(userID int64, level, summary, tagsJSON, gapsJSON string) error
	// 新增：保存学习计划
	SavePlan(userID int64, dailyTime string, phases []struct {
		Title       string `json:"title"`
		Description string `json:"description"`
	}) error
	// 新增：获取用户最新的完整体检结果
	GetLatestAssessment(userID int64) (string, string, error)
}

type UserRepo struct {
	DB *sql.DB
}

func NewUserRepo(db *sql.DB) *UserRepo {
	return &UserRepo{DB: db}
}

func (r *UserRepo) FindByUsername(username string) (*models.User, error) {
	row := r.DB.QueryRow(`SELECT id, username, email, password, display_name, has_assessment FROM users WHERE username=?`, username)
	var u models.User
	if err := row.Scan(&u.ID, &u.Username, &u.Email, &u.Password, &u.DisplayName, &u.HasAssessment); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		log.Printf("[DB] FindByUsername error: %v", err)
		return nil, err
	}
	return &u, nil
}

func (r *UserRepo) FindByEmail(email string) (*models.User, error) {
	row := r.DB.QueryRow(`SELECT id, username, email, password, display_name, has_assessment FROM users WHERE email=?`, email)
	var u models.User
	if err := row.Scan(&u.ID, &u.Username, &u.Email, &u.Password, &u.DisplayName, &u.HasAssessment); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		log.Printf("[DB] FindByEmail error: %v", err)
		return nil, err
	}
	return &u, nil
}

func (r *UserRepo) Create(username, email, password, displayName string) (*models.User, error) {
	res, err := r.DB.Exec(`INSERT INTO users (username, email, password, display_name) VALUES (?,?,?,?)`,
		username, email, password, displayName)
	if err != nil {
		return nil, err
	}
	id, _ := res.LastInsertId()
	return &models.User{
		ID:            id,
		Username:      username,
		Email:         email,
		Password:      password,
		DisplayName:   displayName,
		HasAssessment: 0,
	}, nil
}

func (r *UserRepo) UpdateHasAssessment(id int64, status int) error {
	_, err := r.DB.Exec(`UPDATE users SET has_assessment=? WHERE id=?`, status, id)
	return err
}

func (r *UserRepo) SaveAssessment(userID int64, requestJSON, resultJSON string) error {
	_, err := r.DB.Exec(`INSERT INTO assessments (user_id, request_json, result_json) VALUES (?, ?, ?)`,
		userID, requestJSON, resultJSON)
	if err != nil {
		log.Printf("[DB] SaveAssessment error: %v", err)
	}
	return err
}

func (r *UserRepo) GetPreferredStyleByJoin(userID int64) (string, error) {
	// 这是一个连表查询的例子，从 assessments 表中提取最新的 preferredStyle
	// 注意：这里假设 request_json 中包含 preferredStyle 字段
	// MySQL JSON 提取语法: request_json->>'$.preferredStyle'
	var style string
	err := r.DB.QueryRow(`
		SELECT request_json->>'$.preferredStyle' 
		FROM assessments 
		WHERE user_id=? 
		ORDER BY created_at DESC 
		LIMIT 1`, userID).Scan(&style)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", nil
		}
		log.Printf("[DB] GetPreferredStyleByJoin error: %v", err)
		return "", err
	}
	return style, nil
}

func (r *UserRepo) SaveProfile(userID int64, level, summary, tagsJSON, gapsJSON string) error {
	_, err := r.DB.Exec(`
		INSERT INTO profiles (user_id, level, ability_summary, tags, knowledge_gaps, last_assessed_at) 
		VALUES (?, ?, ?, ?, ?, NOW()) 
		ON DUPLICATE KEY UPDATE 
		level=VALUES(level), ability_summary=VALUES(ability_summary), tags=VALUES(tags), 
		knowledge_gaps=VALUES(knowledge_gaps), last_assessed_at=NOW()`,
		userID, level, summary, tagsJSON, gapsJSON)
	if err != nil {
		log.Printf("[DB] SaveProfile error: %v", err)
	}
	return err
}

func (r *UserRepo) SavePlan(userID int64, dailyTime string, phases []struct {
	Title       string `json:"title"`
	Description string `json:"description"`
}) error {
	// 1. 将旧计划设为非活跃
	_, _ = r.DB.Exec(`UPDATE plans SET is_active=0 WHERE user_id=?`, userID)

	// 2. 插入新计划
	res, err := r.DB.Exec(`INSERT INTO plans (user_id, daily_time, is_active) VALUES (?, ?, 1)`, userID, dailyTime)
	if err != nil {
		log.Printf("[DB] SavePlan insert error: %v", err)
		return err
	}
	planID, _ := res.LastInsertId()

	// 3. 插入阶段
	for i, p := range phases {
		_, err = r.DB.Exec(`INSERT INTO plan_phases (plan_id, title, description, order_index) VALUES (?, ?, ?, ?)`,
			planID, p.Title, p.Description, i)
		if err != nil {
			log.Printf("[DB] SavePlan phase insert error: %v", err)
		}
	}
	return nil
}

func (r *UserRepo) GetLatestAssessment(userID int64) (string, string, error) {
	var requestJSON, resultJSON string
	err := r.DB.QueryRow(`
		SELECT request_json, result_json 
		FROM assessments 
		WHERE user_id=? 
		ORDER BY created_at DESC 
		LIMIT 1`, userID).Scan(&requestJSON, &resultJSON)
	if err != nil {
		return "", "", err
	}
	return requestJSON, resultJSON, nil
}
