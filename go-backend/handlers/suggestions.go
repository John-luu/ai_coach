package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"aicoach-backend-go/internal/ai"
	"aicoach-backend-go/internal/config"
)

type SuggestionRequest struct {
	Stage         int         `json:"stage"`
	LearningPlan  interface{} `json:"learningPlan"`
	UserProfile   interface{} `json:"userProfile"`
	UsedQuestions []string    `json:"usedQuestions"`
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
	suggestions, err := generateSuggestionsWithAI(req)
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

	WriteJSON(w, map[string]interface{}{
		"success":     true,
		"suggestions": suggestions,
		"stage":       req.Stage,
	})
}

func generateSuggestionsWithAI(req SuggestionRequest) ([]SuggestionItem, error) {
	cfg := config.Load()
	aiClient := ai.New(
		cfg.AIBaseURL,
		cfg.AIKey,
		cfg.AIModel,
	)

	stageDescription := getStageDescription(req.Stage)
	usedQuestionsStr := strings.Join(req.UsedQuestions, "\n- ")
	if usedQuestionsStr != "" {
		usedQuestionsStr = "\n已经提过的问题（请避免重复）：\n- " + usedQuestionsStr
	}

	prompt := fmt.Sprintf(`你是一个优秀的 AI 学习教练。根据用户的学习情况，为用户在%s生成5个最相关、最实用的学习问题。

【用户学习画像】
%v

【当前学习阶段】
%s

【学习计划】
%v
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

请直接输出5个问题，不要添加任何其他说明。`, stageDescription, req.UserProfile, stageDescription, req.LearningPlan, usedQuestionsStr)

	messages := []ai.ChatMessage{
		{
			Role:    "user",
			Content: prompt,
		},
	}

	response, err := aiClient.Chat(messages)
	if err != nil {
		log.Printf("[Suggestions] AI Chat failed: %v", err)
		return nil, err
	}

	// 解析 AI 返回的问题列表
	suggestions := parseSuggestions(response)
	return suggestions, nil
}

func parseSuggestions(response string) []SuggestionItem {
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

	// 如果解析出的问题少于 5 个，填充默认问题
	if len(suggestions) < 5 {
		defaults := defaultSuggestions(1)
		for i := len(suggestions); i < 5 && i < len(defaults); i++ {
			suggestions = append(suggestions, SuggestionItem{
				Title: defaults[i].Title,
				Text:  defaults[i].Text,
			})
		}
	}

	return suggestions[:5]
}

func getStageDescription(stage int) string {
	switch stage {
	case 1:
		return "Python 基础与入门"
	case 2:
		return "Python 进阶与应用"
	case 3:
		return "Python 项目实战"
	default:
		return "Python 学习"
	}
}

func defaultSuggestions(stage int) []SuggestionItem {
	switch stage {
	case 1:
		return []SuggestionItem{
			{Title: "Python是什么？", Text: "用简单语言解释Python是什么及主要特点。"},
			{Title: "Python能做什么？", Text: "举例说明Python在实际应用中的用途。"},
			{Title: "学习Python需要什么基础？", Text: "入门需要的基础知识。"},
			{Title: "如何安装Python？", Text: "在我的系统上安装Python的步骤。"},
			{Title: "第一个Python程序", Text: "如何写出第一个Hello World程序。"},
		}
	case 2:
		return []SuggestionItem{
			{Title: "Python基础语法有哪些？", Text: "最基础、最重要的语法知识点。"},
			{Title: "如何使用数据结构？", Text: "列表、字典、集合等数据结构的使用场景。"},
			{Title: "函数有什么作用？", Text: "函数的定义、调用和参数传递。"},
			{Title: "模块和包是什么？", Text: "如何组织代码到模块和包中。"},
			{Title: "异常处理怎么做？", Text: "如何使用try-except处理错误。"},
		}
	case 3:
		return []SuggestionItem{
			{Title: "如何制定学习计划？", Text: "结合目标与时间制定计划。"},
			{Title: "如何结构化提问？", Text: "按目标、背景、尝试、卡点、输出格式组织。"},
			{Title: "项目架构怎样设计？", Text: "Web项目的标准架构和最佳实践。"},
			{Title: "如何调试代码？", Text: "使用调试工具和日志来定位问题。"},
			{Title: "代码质量如何保证？", Text: "单元测试、代码审查和CI/CD流程。"},
		}
	default:
		return defaultSuggestions(1)
	}
}
