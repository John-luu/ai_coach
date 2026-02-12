package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"golang.org/x/crypto/bcrypt"

	"aicoach-backend-go/internal/auth"
	"aicoach-backend-go/internal/repo"
)

type AuthHandlers struct {
	Repo   repo.UserStore
	Signer *auth.TokenSigner
}

func NewAuthHandlers(r repo.UserStore, s *auth.TokenSigner) *AuthHandlers {
	return &AuthHandlers{Repo: r, Signer: s}
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type RegisterRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *AuthHandlers) Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if h.Repo == nil {
		WriteJSON(w, map[string]interface{}{"success": false, "message": "数据库暂不可用"})
		return
	}
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	u, err := h.Repo.FindByUsername(req.Username)
	if err != nil {
		WriteJSON(w, map[string]interface{}{"success": false, "message": "数据库查询出错"})
		return
	}
	if u == nil {
		WriteJSON(w, map[string]interface{}{"success": false, "message": "用户不存在"})
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(req.Password)) != nil {
		WriteJSON(w, map[string]interface{}{"success": false, "message": "密码错误"})
		return
	}
	token, _ := h.Signer.Generate(u.Username)
	WriteJSON(w, map[string]interface{}{
		"success": true,
		"token":   token,
		"user": map[string]interface{}{
			"username":      u.Username,
			"displayName":   u.DisplayName,
			"hasAssessment": u.HasAssessment,
		},
	})
}

func (h *AuthHandlers) Register(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if h.Repo == nil {
		WriteJSON(w, map[string]interface{}{"success": false, "message": "数据库暂不可用"})
		return
	}
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.Username) == "" || strings.TrimSpace(req.Email) == "" || strings.TrimSpace(req.Password) == "" {
		WriteJSON(w, map[string]interface{}{"success": false, "message": "请填写所有字段"})
		return
	}
	// 检查是否存在
	exists, err := h.Repo.FindByUsername(req.Username)
	if err != nil {
		WriteJSON(w, map[string]interface{}{"success": false, "message": "数据库查询出错"})
		return
	}
	if exists != nil {
		WriteJSON(w, map[string]interface{}{"success": false, "message": "用户名已存在"})
		return
	}
	existsEmail, err := h.Repo.FindByEmail(req.Email)
	if err != nil {
		WriteJSON(w, map[string]interface{}{"success": false, "message": "数据库查询出错"})
		return
	}
	if existsEmail != nil {
		WriteJSON(w, map[string]interface{}{"success": false, "message": "邮箱已被注册"})
		return
	}
	hashed, _ := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	_, err = h.Repo.Create(req.Username, req.Email, string(hashed), req.Username)
	if err != nil {
		log.Printf("注册失败详情: %v", err)
		WriteJSON(w, map[string]interface{}{"success": false, "message": "注册失败: " + err.Error()})
		return
	}
	WriteJSON(w, map[string]interface{}{"success": true, "message": "注册成功"})
}

func (h *AuthHandlers) ValidateToken(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	auth := r.Header.Get("Authorization")
	valid := strings.HasPrefix(auth, "Bearer ") && len(strings.TrimSpace(strings.TrimPrefix(auth, "Bearer "))) > 0
	if !valid {
		WriteJSON(w, map[string]interface{}{"valid": false})
		return
	}
	token := strings.TrimSpace(strings.TrimPrefix(auth, "Bearer "))
	WriteJSON(w, map[string]interface{}{"valid": h.Signer.Validate(token)})
}
