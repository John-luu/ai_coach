package com.example.aicoach.service;

import com.example.aicoach.dto.AssessmentResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;

/**
 * 调用 DeepSeek（兼容 OpenAI 风格）的简单客户端。
 *
 * 注意：
 * - 这里假设 DeepSeek 提供 OpenAI Chat Completions 兼容接口：
 *   POST https://api.deepseek.com/v1/chat/completions
 *   Request body 中至少包含 model, messages。
 * - 你需要根据 DeepSeek 官方文档，确认 baseUrl、path、model 名称。
 */
@Component
public class AiClient {

    private final WebClient webClient;
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final String model;

    public AiClient(
            @Value("${ai.api.base-url}") String baseUrl,
            @Value("${ai.api.key}") String apiKey,
            @Value("${ai.api.model:qwen-plus}") String model,
            ObjectMapper objectMapper
    ) {
        this.webClient = WebClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader("Content-Type", "application/json")
                .defaultHeader("Authorization", "Bearer " + apiKey)
                .build();
        this.objectMapper = objectMapper;
        this.apiKey = apiKey;
        this.model = model;
    }

    /**
     * 把 prompt 发给 DeepSeek，让它「只返回 JSON 字符串」。
     */
    public String completeAsJson(String prompt) {
        try {
            // 构造兼容 OpenAI 风格的 Chat Completions 请求
            JsonNode requestBody = objectMapper.readTree("""
                {
                  "model": "%s",
                  "messages": [
                    { "role": "system", "content": "你是一个严谨的后端服务，只能返回严格的 JSON，不允许出现多余说明文字。" },
                    { "role": "user",   "content": %s }
                  ],
                  "temperature": 0.3
                }
                """.formatted(
                    model,
                    objectMapper.writeValueAsString(prompt)
            ));

            String rawResponse = webClient.post()
                    .uri("/v1/chat/completions")
                    .header("Authorization", "Bearer " + apiKey)
                    .body(BodyInserters.fromValue(requestBody))
                    .retrieve()
                    .bodyToMono(String.class)
                    .onErrorResume(e -> {
                        e.printStackTrace();
                        return Mono.error(new RuntimeException("调用 DeepSeek 失败: " + e.getMessage(), e));
                    })
                    .block();

            if (rawResponse == null) {
                throw new RuntimeException("DeepSeek 返回为空");
            }

            // 解析出 content 字段（OpenAI 风格）
            JsonNode root = objectMapper.readTree(rawResponse);
            JsonNode choices = root.path("choices");
            if (!choices.isArray() || choices.isEmpty()) {
                throw new RuntimeException("DeepSeek 返回数据格式异常：缺少 choices");
            }
            String content = choices.get(0).path("message").path("content").asText();
            if (content == null || content.isBlank()) {
                throw new RuntimeException("DeepSeek 返回内容为空");
            }

            // 某些模型会在 JSON 前后带 ```json 标记，这里做个简单清理
            content = content.trim();
            if (content.startsWith("```")) {
                int firstBrace = content.indexOf('{');
                int lastBrace = content.lastIndexOf('}');
                if (firstBrace != -1 && lastBrace != -1 && lastBrace > firstBrace) {
                    content = content.substring(firstBrace, lastBrace + 1);
                }
            }

            // 确保持有合法 JSON
            // 会在 parseResult 中再做一次反序列化校验
            objectMapper.readTree(content.getBytes(StandardCharsets.UTF_8));
            return content;
        } catch (Exception e) {
            throw new RuntimeException("处理 DeepSeek 返回结果失败: " + e.getMessage(), e);
        }
    }

    /**
     * 把 JSON 字符串解析为 AssessmentResult。
     */
    public AssessmentResult parseAssessmentResult(String aiJson) {
        try {
            return objectMapper.readValue(aiJson, AssessmentResult.class);
        } catch (Exception e) {
            throw new RuntimeException("解析 AI 返回 JSON 失败", e);
        }
    }
}

