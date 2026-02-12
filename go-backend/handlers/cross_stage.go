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

const passThreshold = 85

type CrossStageHandler struct {
	AIClient *ai.Client
	Repo     repo.UserStore
	Signer   *auth.TokenSigner
}

func NewCrossStageHandler(aiClient *ai.Client, r repo.UserStore, s *auth.TokenSigner) *CrossStageHandler {
	return &CrossStageHandler{AIClient: aiClient, Repo: r, Signer: s}
}

type CrossStageGenerateRequest struct {
	Stage        int         `json:"stage"`
	LearningPlan interface{} `json:"learningPlan"`
	UserProfile  interface{} `json:"userProfile"`
}

type CrossStageQuestion struct {
	ID      string   `json:"id"`
	Question string  `json:"question"`
	Type    string   `json:"type"` // "short" | "choice"
	Options []string `json:"options,omitempty"`
}

type CrossStageSubmitRequest struct {
	Stage    int                       `json:"stage"`
	Questions []CrossStageQuestion     `json:"questions"`
	Answers  map[string]string         `json:"answers"`
}

// CrossStageGenerate 生成跨阶测试题目
func (h *CrossStageHandler) CrossStageGenerate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	authHeader := r.Header.Get("Authorization")
	if !strings.HasPrefix(authHeader, "Bearer ") {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req CrossStageGenerateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteJSON(w, map[string]interface{}{"success": false, "message": "请求参数无效"})
		return
	}
	if req.Stage < 1 || req.Stage > 3 {
		WriteJSON(w, map[string]interface{}{"success": false, "message": "阶段参数无效"})
		return
	}

	planJSON, _ := json.Marshal(req.LearningPlan)
	profileJSON, _ := json.Marshal(req.UserProfile)
	stageDesc := getCrossStageDesc(req.Stage)

	prompt := fmt.Sprintf(`你是一个专业的 Python 学习教练。请根据用户当前的学习阶段和学习计划，生成跨阶测试题目。

【当前阶段】%s

【学习计划】
%s

【用户画像】
%s

【要求】
1. 生成 3 道测试题，考察用户对本阶段核心知识的掌握程度
2. 题目类型：2 道简答题（type: "short"），1 道选择题（type: "choice"，需包含 options 数组）
3. 题目应紧扣本阶段学习内容，难度适中

【输出格式】严格返回 JSON 数组，不要包含 markdown 代码块或其它说明：
[
  {"id": "q1", "question": "题目内容", "type": "short"},
  {"id": "q2", "question": "题目内容", "type": "short"},
  {"id": "q3", "question": "题目内容", "type": "choice", "options": ["A. 选项1", "B. 选项2", "C. 选项3", "D. 选项4"]}
]`, stageDesc, string(planJSON), string(profileJSON))

	messages := []ai.ChatMessage{{Role: "user", Content: prompt}}
	response, err := h.AIClient.Chat(messages)
	if err != nil {
		log.Printf("[CrossStage] Generate AI failed: %v", err)
		WriteJSON(w, map[string]interface{}{"success": false, "message": "生成题目失败"})
		return
	}

	questions := parseCrossStageQuestions(response)
	if len(questions) == 0 {
		questions = defaultCrossStageQuestions(req.Stage)
	}

	WriteJSON(w, map[string]interface{}{"success": true, "questions": questions})
}

func parseCrossStageQuestions(response string) []CrossStageQuestion {
	clean := strings.TrimSpace(response)
	clean = strings.TrimPrefix(clean, "```json")
	clean = strings.TrimPrefix(clean, "```")
	clean = strings.TrimSuffix(clean, "```")
	clean = strings.TrimSpace(clean)

	var questions []CrossStageQuestion
	if err := json.Unmarshal([]byte(clean), &questions); err != nil {
		log.Printf("[CrossStage] Parse questions failed: %v", err)
		return nil
	}
	return questions
}

func defaultCrossStageQuestions(stage int) []CrossStageQuestion {
	base := []CrossStageQuestion{
		{ID: "q1", Question: "请简述本阶段你最核心的收获是什么？", Type: "short"},
		{ID: "q2", Question: "遇到问题时，你会如何结构化地向 AI 提问？", Type: "short"},
		{ID: "q3", Question: "下列哪项最能描述有效的提问方式？", Type: "choice", Options: []string{"A. 直接问「怎么办」", "B. 包含目标、背景、已尝试和卡点", "C. 越详细越好", "D. 只描述错误信息"}},
	}
	return base
}

func getCrossStageDesc(stage int) string {
	switch stage {
	case 1:
		return "阶段一：建立基础"
	case 2:
		return "阶段二：结构化提问"
	case 3:
		return "阶段三"
	default:
		return "阶段一"
	}
}

// CrossStageSubmit 提交测试并评卷
func (h *CrossStageHandler) CrossStageSubmit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	authHeader := r.Header.Get("Authorization")
	if !strings.HasPrefix(authHeader, "Bearer ") {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	token := strings.TrimPrefix(authHeader, "Bearer ")
	username, err := h.Signer.ParseUsername(token)
	if err != nil || username == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req CrossStageSubmitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteJSON(w, map[string]interface{}{"success": false, "message": "请求参数无效"})
		return
	}
	if len(req.Questions) == 0 || len(req.Answers) == 0 {
		WriteJSON(w, map[string]interface{}{"success": false, "message": "缺少题目或答案"})
		return
	}

	// 构建题目和答案的文本
	var qaText strings.Builder
	for _, q := range req.Questions {
		qaText.WriteString(fmt.Sprintf("题目: %s\n答案: %s\n\n", q.Question, req.Answers[q.ID]))
	}

	prompt := fmt.Sprintf(`你是一个严格的 Python 学习测评专家。请根据以下题目和用户答案进行评分。

【评分标准】
- 满分 100 分，按题目数量平均分配每题分值
- 简答题：根据回答的完整性、准确性和逻辑性给分
- 选择题：选对得满分，选错得 0 分
- 鼓励有实质性内容的回答，敷衍回答酌情扣分

【题目与答案】
%s

【要求】
仅返回一个 JSON 对象，不要包含任何其他文字或 markdown：
{"score": 85, "feedback": "简要评语"}

score 为 0-100 的整数。`, qaText.String())

	messages := []ai.ChatMessage{{Role: "user", Content: prompt}}
	response, err := h.AIClient.Chat(messages)
	if err != nil {
		log.Printf("[CrossStage] Submit AI failed: %v", err)
		WriteJSON(w, map[string]interface{}{"success": false, "message": "评卷失败"})
		return
	}

	score := parseCrossStageScore(response)
	passed := score >= passThreshold

	if passed {
		// 更新用户阶段
		u, _ := h.Repo.FindByUsername(username)
		if u != nil {
			newStage := u.Stage + 1
			if newStage > 3 {
				newStage = 3
			}
			h.Repo.UpdateStage(u.ID, newStage)
		}
	}

	WriteJSON(w, map[string]interface{}{
		"success": true,
		"score":   score,
		"passed":  passed,
	})
}

func parseCrossStageScore(response string) int {
	clean := strings.TrimSpace(response)
	clean = strings.TrimPrefix(clean, "```json")
	clean = strings.TrimPrefix(clean, "```")
	clean = strings.TrimSuffix(clean, "```")
	clean = strings.TrimSpace(clean)

	var res struct {
		Score int `json:"score"`
	}
	if err := json.Unmarshal([]byte(clean), &res); err != nil {
		log.Printf("[CrossStage] Parse score failed: %v, raw: %s", err, clean)
		return 0
	}
	if res.Score < 0 {
		res.Score = 0
	}
	if res.Score > 100 {
		res.Score = 100
	}
	return res.Score
}
