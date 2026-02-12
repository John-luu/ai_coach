package ai

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
)

type Client struct {
	BaseURL string
	APIKey  string
	Model   string
}

func New(baseURL, apiKey, model string) *Client {
	log.Printf("[AI] Initializing client with BaseURL: %s, Model: %s", baseURL, model)
	return &Client{BaseURL: baseURL, APIKey: apiKey, Model: model}
}

// ChatMessage 消息结构
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// Chat 调用 AI 接口进行对话
func (c *Client) Chat(messages []ChatMessage) (string, error) {
	if strings.TrimSpace(c.APIKey) == "" {
		return "", errors.New("ai key not configured")
	}

	// 构造 DashScope 兼容接口请求体
	reqBody := map[string]any{
		"model":    c.Model,
		"messages": messages,
	}

	b, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	// 修正接口路径：DashScope 的兼容模式通常已经在 BaseURL 中包含了 /v1 或类似的路径
	// 如果配置的 BaseURL 是 https://dashscope.aliyuncs.com/compatible-mode/v1
	// 则完整的聊天路径是 BaseURL + "/chat/completions"
	url := strings.TrimSuffix(c.BaseURL, "/") + "/chat/completions"
	log.Printf("[AI] Calling URL: %s", url)
	log.Printf("[AI] Request Body: %s", string(b))
	
	req, err := http.NewRequest("POST", url, strings.NewReader(string(b)))
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.APIKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[AI] Request error: %v", err)
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		// 读取错误响应体
		var errBody []byte
		if b, err := io.ReadAll(resp.Body); err == nil {
			errBody = b
		}
		log.Printf("[AI] AI request failed. Status: %s, Body: %s", resp.Status, string(errBody))
		return "", fmt.Errorf("ai request failed with status: %s, body: %s", resp.Status, string(errBody))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	if len(result.Choices) > 0 {
		return result.Choices[0].Message.Content, nil
	}

	return "", errors.New("empty response from ai")
}

// CompleteAsJSON 调用外部AI服务，返回JSON字符串
func (c *Client) CompleteAsJSON(prompt string) (string, error) {
	if strings.TrimSpace(c.APIKey) == "" {
		return "", errors.New("ai key not configured")
	}
	// 示例：兼容 DashScope 的 /compatible-mode 接口。此处仅展示结构，避免真实调用。
	reqBody := map[string]any{
		"model": c.Model,
		"input": map[string]string{"prompt": prompt},
	}
	b, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest("POST", c.BaseURL, strings.NewReader(string(b)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", errors.New("ai request failed")
	}
	var result map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	// 假设返回体中有一个 fields.json 之类，这里仅示例，真实解析需按服务文档
	// 为避免误导，这里直接返回空字符串，上层走默认兜底
	return "", errors.New("ai response parsing not implemented")
}
