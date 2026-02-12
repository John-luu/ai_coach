package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"aicoach-backend-go/internal/ai"
	"aicoach-backend-go/internal/config"
	"aicoach-backend-go/internal/db"
	"aicoach-backend-go/internal/repo"
)

type SuggestionRequest struct {
	Stage         int         `json:"stage"`
	LearningPlan  interface{} `json:"learningPlan"`
	UserProfile   interface{} `json:"userProfile"`
	UsedQuestions []string    `json:"usedQuestions"`
	SessionID     string      `json:"sessionId,omitempty"`
}

type SuggestionItem struct {
	Title string `json:"title"`
	Text  string `json:"text"`
}

func Suggestions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req SuggestionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if req.Stage < 1 {
		WriteJSON(w, map[string]interface{}{
			"success": false,
			"message": "阶段参数无效",
		})
		return
	}

	// 使用 AI 生成建议问题
	suggestions, rawResp, prompt, err := generateSuggestionsWithAI(req)
	if err != nil {
		log.Printf("[Suggestions] AI generation failed: %v, falling back to defaults", err)
		// 降级到默认建议
		WriteJSON(w, map[string]interface{}{
			"success":     true,
			"suggestions": defaultSuggestions(req.Stage),
			"stage":       req.Stage,
		})
		return
	}

	// 如果请求中包含 sessionId，则尝试将用户 prompt 与 AI 回复保存到 messages 表
	if req.SessionID != "" {
		cfg := config.Load()
		sqlDB, dberr := db.Connect(cfg.DBUser, cfg.DBPass, cfg.DBUrl)
		if dberr != nil || sqlDB == nil {
			log.Printf("[Suggestions] DB connect error: %v", dberr)
		} else {
			chatRepo := repo.NewChatRepo(sqlDB)
			cnt, _ := chatRepo.GetMessageCount(req.SessionID)
			_, uerr := chatRepo.AddMessage(req.SessionID, "user", prompt, cnt+1)
			if uerr != nil {
				log.Printf("[Suggestions] Failed to save user prompt: %v", uerr)
			}
			_, aerr := chatRepo.AddMessage(req.SessionID, "ai", rawResp, cnt+2)
			if aerr != nil {
				log.Printf("[Suggestions] Failed to save AI response: %v", aerr)
			}
		}
	}

	WriteJSON(w, map[string]interface{}{
		"success":     true,
		"suggestions": suggestions,
		"stage":       req.Stage,
	})
}

func generateSuggestionsWithAI(req SuggestionRequest) ([]SuggestionItem, string, string, error) {
	cfg := config.Load()
	aiClient := ai.New(
		cfg.AIBaseURL,
		cfg.AIKey,
		cfg.AIModel,
	)

	// 将学习计划和用户画像序列化为 JSON 字符串，以便在 prompt 中使用
	profileJSON, _ := json.Marshal(req.UserProfile)
	planJSON, _ := json.Marshal(req.LearningPlan)

	stageDesc := getStageDescription(req.Stage)

	usedQuestionsStr := ""
	if len(req.UsedQuestions) > 0 {
		usedQuestionsStr = "\n已经提过的问题（请避免重复）：\n- " + strings.Join(req.UsedQuestions, "\n- ")
	}

	prompt := fmt.Sprintf(`你是一个优秀的 AI 学习教练。根据用户的学习情况，为用户在%s生成5个最相关、最实用的学习问题。

【用户学习画像】
%s

【当前学习阶段】
%s

【学习计划】
%s
%s

【要求】
1. 生成的问题应该直接相关于当前学习阶段的学习内容
2. 问题应该能够帮助用户深入理解和掌握该阶段的知识
3. 问题应该循序渐进，从基础到进阶
4. 每个问题都应该是开放式的，能引发思考
5. 避免学术性过强，保持亲近感和实用性

【输出格式】
严格按照以下格式返回，每个问题占一行：
题目: 内容
题目: 内容
题目: 内容
题目: 内容
题目: 内容

请直接输出5个问题，不要添加任何其他说明。`, stageDesc, string(profileJSON), stageDesc, string(planJSON), usedQuestionsStr)

	messages := []ai.ChatMessage{
		{
			Role:    "user",
			Content: prompt,
		},
	}

	response, err := aiClient.Chat(messages)
	if err != nil {
		log.Printf("[Suggestions] AI Chat failed: %v", err)
		return nil, "", "", err
	}

	// 解析 AI 返回的问题列表
	suggestions := parseSuggestions(response, req.Stage)
	return suggestions, response, prompt, nil
}

func parseSuggestions(response string, stage int) []SuggestionItem {
	lines := strings.Split(response, "\n")
	var suggestions []SuggestionItem

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// 查找 ":" 或 "：" 的位置
		var parts []string
		if strings.Contains(line, ":") {
			parts = strings.SplitN(line, ":", 2)
		} else if strings.Contains(line, "：") {
			parts = strings.SplitN(line, "：", 2)
		}

		if len(parts) == 2 {
			title := strings.TrimSpace(parts[0])
			text := strings.TrimSpace(parts[1])

			// 移除可能的序号前缀（如 "1", "1."）
			titleRunes := []rune(title)
			for i := 0; i < len(titleRunes); i++ {
				r := titleRunes[i]
				if (r < '0' || r > '9') && r != '.' && r != '。' {
					title = string(titleRunes[i:])
					break
				}
				if r == '.' || r == '。' {
					title = strings.TrimSpace(string(titleRunes[i+1:]))
					break
				}
			}
			title = strings.TrimSpace(title)

			if title != "" && text != "" {
				suggestions = append(suggestions, SuggestionItem{
					Title: title,
					Text:  text,
				})
			}

			if len(suggestions) >= 5 {
				break
			}
		}
	}

	// 如果解析出的问题少于 5 个，直接返回已有的（不填充默认问题）
	return suggestions
}

func getStageDescription(stage int) string {
	switch stage {
	case 1:
		return "阶段一"
	case 2:
		return "阶段二"
	case 3:
		return "阶段三"
	default:
		return "阶段一"
	}
}

func defaultSuggestions(stage int) []SuggestionItem {
	// 返回空数组，表示暂无提示问题
	return []SuggestionItem{}
}
