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

type AssessmentRequest struct {
	WantToDo       string `json:"wantToDo"`
	Goal           string `json:"goal"`
	CurrentLevel   string `json:"currentLevel"`
	PreferredStyle string `json:"preferredStyle"`
	DailyTime      string `json:"dailyTime"`
}

type ProfileDto struct {
	Level          string   `json:"level"`
	Tags           []string `json:"tags"`
	AbilitySummary string   `json:"abilitySummary"`
	KnowledgeGaps  []string `json:"knowledgeGaps"`
	PreferredStyle string   `json:"preferredStyle"`
}

type PlanDto struct {
	DailyTime interface{} `json:"dailyTime"`
	Phases    []PhaseItem `json:"phases"`
}

// PhaseItem represents a learning phase, supporting both 'desc' and 'description' fields
type PhaseItem struct {
	Title       string `json:"title"`
	Desc        string `json:"desc,omitempty"`
	Description string `json:"description,omitempty"`
}

type AssessmentResult struct {
	Profile ProfileDto `json:"profile"`
	Plan    PlanDto    `json:"plan"`
}

type AssessmentHandler struct {
	AI     *ai.Client
	Repo   repo.UserStore
	Signer *auth.TokenSigner
}

func NewAssessmentHandler(aiClient *ai.Client, r repo.UserStore, s *auth.TokenSigner) *AssessmentHandler {
	return &AssessmentHandler{AI: aiClient, Repo: r, Signer: s}
}

func (h *AssessmentHandler) GetLatest(w http.ResponseWriter, r *http.Request) {
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

	u, err := h.Repo.FindByUsername(username)
	if err != nil || u == nil {
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}

	_, resultJSON, err := h.Repo.GetLatestAssessment(u.ID)
	if err != nil {
		if err.Error() == "sql: no rows in result set" {
			http.Error(w, "no assessment found", http.StatusNotFound)
			return
		}
		log.Printf("[Assessment] GetLatest error: %v", err)
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	if resultJSON == "" {
		log.Printf("[Assessment] User %d has assessment record but result_json is empty", u.ID)
		http.Error(w, "empty assessment result", http.StatusInternalServerError)
		return
	}

	var res AssessmentResult
	if err := json.Unmarshal([]byte(resultJSON), &res); err != nil {
		log.Printf("[Assessment] Unmarshal latest result error: %v, Raw content: %s", err, resultJSON)
		http.Error(w, "internal error: invalid data format in database", http.StatusInternalServerError)
		return
	}

	WriteJSON(w, res)
}

func (h *AssessmentHandler) Evaluate(w http.ResponseWriter, r *http.Request) {
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

	var req AssessmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	log.Printf("[Assessment] User %s started evaluation with req: %+v", username, req)

	// 1. 更新数据库状态
	u, err := h.Repo.FindByUsername(username)
	if err != nil || u == nil {
		log.Printf("[Assessment] User %s not found in DB", username)
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}
	_ = h.Repo.UpdateHasAssessment(u.ID, 1)

	// 2. 构建 prompt 并调用 AI
	prompt := buildPrompt(req)
	log.Printf("[Assessment] Sending prompt to AI: %s", prompt)

	messages := []ai.ChatMessage{
		{Role: "system", Content: "你是一个专业的 AI 学习评估专家。请根据用户的需求生成 JSON 格式的学习画像和计划。你必须严格返回合法的 JSON 格式，不要包含任何 Markdown 代码块标签或其他解释性文字。"},
		{Role: "user", Content: prompt},
	}

	aiRes, err := h.AI.Chat(messages)
	if err != nil {
		log.Printf("[Assessment] AI Chat failed: %v, falling back to default", err)
		// AI 调用失败，使用默认兜底方案
		res := defaultAssessmentResult(req)
		h.saveAndWriteResult(w, u.ID, req, res)
		return
	}

	log.Printf("[Assessment] AI Original Response: %s", aiRes)

	// 3. 尝试解析 AI 返回的 JSON
	var res AssessmentResult
	// 清理 AI 可能返回的 Markdown 标签
	cleanJSON := strings.TrimSpace(aiRes)
	cleanJSON = strings.TrimPrefix(cleanJSON, "```json")
	cleanJSON = strings.TrimPrefix(cleanJSON, "```")
	cleanJSON = strings.TrimSuffix(cleanJSON, "```")
	cleanJSON = strings.TrimSpace(cleanJSON)

	if err := json.Unmarshal([]byte(cleanJSON), &res); err != nil {
		log.Printf("[Assessment] Failed to parse AI JSON: %v, falling back to default. Raw: %s", err, cleanJSON)
		res = defaultAssessmentResult(req)
	} else {
		log.Printf("[Assessment] Successfully parsed AI response")
	}

	h.saveAndWriteResult(w, u.ID, req, res)
}

func (h *AssessmentHandler) saveAndWriteResult(w http.ResponseWriter, userID int64, req AssessmentRequest, res AssessmentResult) {
	// 1. 保存体检全量记录
	reqBytes, _ := json.Marshal(req)
	resBytes, _ := json.Marshal(res)
	_ = h.Repo.SaveAssessment(userID, string(reqBytes), string(resBytes))

	// 2. 同步到画像表
	tagsBytes, _ := json.Marshal(res.Profile.Tags)
	gapsBytes, _ := json.Marshal(res.Profile.KnowledgeGaps)
	_ = h.Repo.SaveProfile(userID, res.Profile.Level, res.Profile.AbilitySummary, string(tagsBytes), string(gapsBytes))

	// 3. 同步到计划表
	// Convert DailyTime to string
	dailyTimeStr := ""
	if dt, ok := res.Plan.DailyTime.(string); ok {
		dailyTimeStr = dt
	} else if dt, ok := res.Plan.DailyTime.(float64); ok {
		dailyTimeStr = fmt.Sprintf("%.0f分钟/每天", dt)
	}
	
	// Convert PhaseItems to repo expected format
	var phases []struct {
		Title       string `json:"title"`
		Description string `json:"description"`
	}
	for _, p := range res.Plan.Phases {
		desc := p.Desc
		if desc == "" {
			desc = p.Description
		}
		phases = append(phases, struct {
			Title       string `json:"title"`
			Description string `json:"description"`
		}{Title: p.Title, Description: desc})
	}
	_ = h.Repo.SavePlan(userID, dailyTimeStr, phases)

	WriteJSON(w, res)
}

func buildPrompt(r AssessmentRequest) string {
	return fmt.Sprintf(`请根据以下用户信息生成一份学习画像和学习计划。要求返回 JSON 格式，结构如下：
{
  "profile": {
    "level": "能力等级字符串",
    "tags": ["标签1", "标签2"],
    "abilitySummary": "一段话的能力总结",
    "knowledgeGaps": ["知识点1", "知识点2"],
    "preferredStyle": "回答风格"
  },
  "plan": {
    "dailyTime": "每日学习时长",
    "phases": [
      {"title": "阶段标题", "desc": "阶段描述"}
    ]
  }
}

用户信息：
1. 想学什么：%s
2. 学习目标：%s
3. 当前水平：%s
4. 学习风格：%s
5. 每日时长：%s`, r.WantToDo, r.Goal, r.CurrentLevel, r.PreferredStyle, r.DailyTime)
}

func defaultAssessmentResult(r AssessmentRequest) AssessmentResult {
	return AssessmentResult{
		Profile: ProfileDto{
			Level:          "初学者 · " + r.WantToDo,
			Tags:           []string{"目标：" + r.Goal, "风格：" + r.PreferredStyle},
			AbilitySummary: "你已经具备入门基础，建议从结构化练习开始。",
			KnowledgeGaps:  []string{"语法基础", "项目拆解", "提问结构化"},
			PreferredStyle: r.PreferredStyle,
		},
		Plan: PlanDto{
			DailyTime: r.DailyTime,
			Phases: []PhaseItem{
				{Title: "阶段一：建立基础", Desc: "通过练习掌握核心语法"},
				{Title: "阶段二：结构化提问", Desc: "练习将问题拆解为目标/背景/卡点"},
			},
		},
	}
}
