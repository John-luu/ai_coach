package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"aicoach-backend-go/internal/ai"
	"aicoach-backend-go/internal/auth"
	"aicoach-backend-go/internal/repo"
)

type ChatRequest struct {
	Question     string `json:"question"`
	Stage        int    `json:"stage"`
	UserProfile  any    `json:"userProfile"`
	LearningPlan any    `json:"learningPlan"`
}

type ChatHandler struct {
	AI     *ai.Client
	Repo   repo.UserStore
	Signer *auth.TokenSigner
}

func NewChatHandler(aiClient *ai.Client, r repo.UserStore, s *auth.TokenSigner) *ChatHandler {
	return &ChatHandler{AI: aiClient, Repo: r, Signer: s}
}

func (h *ChatHandler) Chat(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// 从 Header 获取 Token 并解析用户
	authHeader := r.Header.Get("Authorization")
	if !strings.HasPrefix(authHeader, "Bearer ") {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
	username, err := h.Signer.ParseUsername(tokenStr)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	// 优先从 assessments 表连表查询最新的回答风格
	u, err := h.Repo.FindByUsername(username)
	style := "通俗易懂，耐心引导"
	if err == nil && u != nil {
		joinStyle, joinErr := h.Repo.GetPreferredStyleByJoin(u.ID)
		if joinErr == nil && joinStyle != "" {
			style = joinStyle
			log.Printf("[Chat] User %s preferred style (from join): %s", username, style)
		}
	} else {
		log.Printf("[Chat] User %s not found or error: %v, using default style", username, err)
	}

	var req ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	// 构建系统提示词，包含用户偏好的回答风格
	systemPrompt := "你是一个专业的 AI 学习教练。你的任务是帮助用户学习 Python 和 AI 相关的知识。"
	systemPrompt += fmt.Sprintf("\n用户要求的回答风格是：%s。", style)

	// 根据具体风格添加更详细的指令
	switch style {
	case "像老师一样一步步引导我，帮我拆解任务":
		systemPrompt += " 请扮演一位耐心的导师，不要直接给出最终答案，而是将任务拆解成小步骤，引导用户思考并逐步完成。"
	case "直接给我答案和代码模板":
		systemPrompt += " 请直接、高效地提供准确的答案和可运行的代码模板，减少冗长的解释。"
	case "先自己尝试，遇到卡点再让 AI 帮我":
		systemPrompt += " 请鼓励用户先行尝试，当用户遇到困难时，提供针对性的启发和建议，而非全量答案。"
	case "希望 AI 像教练一样提问，逼我多思考":
		systemPrompt += " 请扮演一位严厉但专业的教练，通过苏格拉底式的提问来引导用户，迫使他们深入思考问题的本质。"
	}

	if req.UserProfile != nil {
		profileJSON, _ := json.Marshal(req.UserProfile)
		systemPrompt += fmt.Sprintf("\n用户当前画像信息：%s", string(profileJSON))
	}

	messages := []ai.ChatMessage{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: req.Question},
	}

	answer, err := h.AI.Chat(messages)
	if err != nil {
		WriteJSON(w, map[string]any{
			"success": false,
			"message": "AI 响应失败：" + err.Error(),
		})
		return
	}

	WriteJSON(w, map[string]any{
		"success": true,
		"answer":  answer,
	})
}
