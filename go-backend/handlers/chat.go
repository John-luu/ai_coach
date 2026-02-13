package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"aicoach-backend-go/internal/ai"
	"aicoach-backend-go/internal/auth"
	"aicoach-backend-go/internal/repo"
)

type ChatRequest struct {
	SessionID    string `json:"sessionId"`
	Question     string `json:"question"`
	Stage        int    `json:"stage"`
	UserProfile  any    `json:"userProfile"`
	LearningPlan any    `json:"learningPlan"`
}

type ChatHandler struct {
	AI        *ai.Client
	Repo      repo.UserStore
	ChatStore repo.ChatStore
	Signer    *auth.TokenSigner
}

func NewChatHandler(aiClient *ai.Client, r repo.UserStore, cs repo.ChatStore, s *auth.TokenSigner) *ChatHandler {
	return &ChatHandler{AI: aiClient, Repo: r, ChatStore: cs, Signer: s}
}

func (h *ChatHandler) CreateSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	authHeader := r.Header.Get("Authorization")
	tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
	username, err := h.Signer.ParseUsername(tokenStr)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	u, _ := h.Repo.FindByUsername(username)
	if u == nil {
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}

	session, err := h.ChatStore.CreateSession(u.ID, "新会话")
	if err != nil {
		WriteJSON(w, map[string]any{"success": false, "message": err.Error()})
		return
	}
	WriteJSON(w, map[string]any{"success": true, "session": session})
}

func (h *ChatHandler) GetSessions(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
	username, err := h.Signer.ParseUsername(tokenStr)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	u, _ := h.Repo.FindByUsername(username)
	if u == nil {
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}

	sessions, err := h.ChatStore.GetSessionsByUserID(u.ID)
	if err != nil {
		WriteJSON(w, map[string]any{"success": false, "message": err.Error()})
		return
	}
	WriteJSON(w, map[string]any{"success": true, "sessions": sessions})
}

func (h *ChatHandler) GetMessages(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("sessionId")
	if sessionID == "" {
		http.Error(w, "sessionId required", http.StatusBadRequest)
		return
	}

	messages, err := h.ChatStore.GetMessagesBySessionID(sessionID)
	if err != nil {
		WriteJSON(w, map[string]any{"success": false, "message": err.Error()})
		return
	}
	WriteJSON(w, map[string]any{"success": true, "messages": messages})
}

func (h *ChatHandler) GetActivityDates(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
	username, err := h.Signer.ParseUsername(tokenStr)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	u, _ := h.Repo.FindByUsername(username)
	if u == nil {
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}

	dates, err := h.ChatStore.GetActivityDates(u.ID)
	if err != nil {
		WriteJSON(w, map[string]any{"success": false, "message": err.Error()})
		return
	}
	WriteJSON(w, map[string]any{"success": true, "dates": dates})
}

func (h *ChatHandler) GetGreeting(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
	username, err := h.Signer.ParseUsername(tokenStr)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	u, _ := h.Repo.FindByUsername(username)
	if u == nil {
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}

	// 1. 获取所有活动日期
	dates, err := h.ChatStore.GetActivityDates(u.ID)
	if err != nil {
		dates = []string{}
	}

	// 2. 获取最近一次消息时间
	latestTime, _ := h.ChatStore.GetLatestMessageTime(u.ID)

	greeting := "今天学什么？一起吧" // 默认文案
	now := time.Now()

	if len(dates) == 0 {
		// 新用户第1次
		greeting = "准备好开始学习了吗？"
	} else if latestTime.IsZero() {
		greeting = "准备好开始学习了吗？"
	} else {
		// 计算距离上一次提问的时间
		daysSinceLast := int(now.Sub(latestTime).Hours() / 24)

		if daysSinceLast == 0 || (daysSinceLast == 1 && now.Hour() < 4) {
			// 今天或昨天深夜（凌晨4点前算昨天）
			// 检查是否连续3天
			if len(dates) >= 3 {
				last3 := dates[len(dates)-3:]
				isContinuous := true
				for i := 1; i < len(last3); i++ {
					t1, _ := time.Parse("2006-01-02", last3[i-1])
					t2, _ := time.Parse("2006-01-02", last3[i])
					if int(t2.Sub(t1).Hours()/24) > 1 {
						isContinuous = false
						break
					}
				}
				if isContinuous {
					greeting = "已经坚持3天啦，继续突破！"
				} else {
					greeting = "昨天的知识点掌握了吗？"
				}
			} else {
				greeting = "昨天的知识点掌握了吗？"
			}
		} else if daysSinceLast >= 3 {
			// 3天没来
			greeting = "回来啦，这几天卡在哪了？"
		} else if daysSinceLast == 1 || daysSinceLast == 2 {
			// 昨天或前天
			greeting = "昨天的知识点掌握了吗？"
		}
	}

	WriteJSON(w, map[string]any{
		"success":  true,
		"greeting": greeting,
	})
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

	// Session management
	var sessionID = req.SessionID
	if sessionID == "" {
		// If no sessionId, we might need to create one, but usually frontend should handle this
		// For now, let's assume sessionId is required or handled by frontend
		http.Error(w, "sessionId required", http.StatusBadRequest)
		return
	}

	// Check message count limit (50 pairs = 100 messages)
	count, _ := h.ChatStore.GetMessageCount(sessionID)
	if count >= 100 {
		WriteJSON(w, map[string]any{
			"success": false,
			"message": "会话已达到最大对话数限制（50次对话），请开启新会话。",
		})
		return
	}

	// Get history messages for context
	history, _ := h.ChatStore.GetMessagesBySessionID(sessionID)
	aiMessages := []ai.ChatMessage{
		{Role: "system", Content: systemPrompt},
	}
	for _, m := range history {
		role := m.Role
		if role == "ai" {
			role = "assistant"
		}
		aiMessages = append(aiMessages, ai.ChatMessage{Role: role, Content: m.Content})
	}
	aiMessages = append(aiMessages, ai.ChatMessage{Role: "user", Content: req.Question})

	// Add user message to DB
	userMsg, err := h.ChatStore.AddMessage(sessionID, "user", req.Question, count+1)
	if err != nil {
		log.Printf("[Chat] Failed to store user message: %v", err)
	}

	// Update session title if it's the first message
	if count == 0 {
		title := generateTitle(req.Question)
		h.ChatStore.UpdateSessionTitle(sessionID, title)
	}

	answer, err := h.AI.Chat(aiMessages)
	if err != nil {
		log.Printf("[Chat] AI error for session %s: %v", sessionID, err)
		WriteJSON(w, map[string]any{
			"success": false,
			"message": "AI 响应失败：" + err.Error(),
		})
		return
	}

	// Add AI message to DB - fetch count again to ensure correct sequence
	currentCount, _ := h.ChatStore.GetMessageCount(sessionID)
	aiMsg, err := h.ChatStore.AddMessage(sessionID, "ai", answer, currentCount+1)
	if err != nil {
		log.Printf("[Chat] Failed to store AI message for session %s: %v", sessionID, err)
	}

	WriteJSON(w, map[string]any{
		"success": true,
		"answer":  answer,
		"userMsg": userMsg,
		"aiMsg":   aiMsg,
	})
}

func generateTitle(text string) string {
	text = strings.TrimSpace(text)
	if text == "" {
		return "新会话"
	}

	// 规则 3: 如果是图片/文件（假设前端传来的文本包含特定标记）
	if strings.HasPrefix(text, "[图片]") {
		return "[图片]"
	}
	if strings.HasPrefix(text, "[文件]") {
		return "[文件]"
	}

	// 规则 4: 纯表情/符号
	// 这里简单处理：如果全是 emoji，保留前4个
	if isAllEmoji(text) {
		runes := []rune(text)
		if len(runes) > 4 {
			return string(runes[:4])
		}
		return text
	}

	// 规则 1 & 5: 截取前8个字符
	runes := []rune(text)
	if len(runes) > 8 {
		return string(runes[:8])
	}
	return text
}

func isAllEmoji(s string) bool {
	for _, r := range s {
		// 简单的 Emoji 范围判断
		if !((r >= 0x1F600 && r <= 0x1F64F) || // Emoticons
			(r >= 0x1F300 && r <= 0x1F5FF) || // Misc Symbols and Pictographs
			(r >= 0x1F680 && r <= 0x1F6FF) || // Transport and Map
			(r >= 0x2600 && r <= 0x26FF) || // Misc Symbols
			(r >= 0x2700 && r <= 0x27BF) || // Dingbats
			(r >= 0x1F900 && r <= 0x1F9FF) || // Supplemental Symbols and Pictographs
			(r >= 0x1F1E6 && r <= 0x1F1FF)) { // Flags
			return false
		}
	}
	return true
}
