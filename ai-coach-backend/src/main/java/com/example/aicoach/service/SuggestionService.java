package com.example.aicoach.service;

import com.example.aicoach.dto.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class SuggestionService {
    
    private final AiClient aiClient;
    private final ObjectMapper objectMapper;
    
    @Autowired
    public SuggestionService(AiClient aiClient, ObjectMapper objectMapper) {
        this.aiClient = aiClient;
        this.objectMapper = objectMapper;
    }
    
    /**
     * 根据学习阶段和计划生成提示问题
     */
    public List<SuggestionItem> generateSuggestions(Integer stage, PlanDto learningPlan, ProfileDto userProfile) {
        try {
            // 构建提示词
            String prompt = buildPrompt(stage, learningPlan, userProfile);
            
            // 使用AiClient调用AI
            String aiJson = aiClient.completeAsJson(prompt);
            
            // 解析AI返回的JSON
            return parseAiResponse(aiJson);
            
        } catch (Exception e) {
            // 如果AI调用失败，返回默认建议
            return getDefaultSuggestions(stage);
        }
    }
    
    /**
     * 构建提示词
     */
    private String buildPrompt(Integer stage, PlanDto learningPlan, ProfileDto userProfile) {
        StringBuilder prompt = new StringBuilder();
        
        prompt.append("你是一个AI学习教练，需要根据用户的学习画像和当前学习阶段，生成3-5个最可能被问到的问题。\n\n");
        
        // 添加用户画像信息
        if (userProfile != null) {
            prompt.append("用户学习画像：\n");
            prompt.append("- 学习水平：").append(userProfile.getLevel()).append("\n");
            if (userProfile.getTags() != null && !userProfile.getTags().isEmpty()) {
                prompt.append("- 标签：").append(String.join("、", userProfile.getTags())).append("\n");
            }
            if (userProfile.getAbilitySummary() != null) {
                prompt.append("- 能力总结：").append(userProfile.getAbilitySummary()).append("\n");
            }
            if (userProfile.getKnowledgeGaps() != null && !userProfile.getKnowledgeGaps().isEmpty()) {
                prompt.append("- 需要补充的知识：").append(String.join("、", userProfile.getKnowledgeGaps())).append("\n");
            }
            prompt.append("\n");
        }
        
        // 添加学习计划信息
        if (learningPlan != null) {
            prompt.append("学习计划：\n");
            prompt.append("- 每日学习时间：").append(learningPlan.getDailyTime()).append("\n");
            prompt.append("- 当前阶段：").append(learningPlan.getCurrentPhase()).append("\n");
            
            if (learningPlan.getPhases() != null && !learningPlan.getPhases().isEmpty()) {
                prompt.append("- 所有阶段：\n");
                for (int i = 0; i < learningPlan.getPhases().size(); i++) {
                    PhaseDto phase = learningPlan.getPhases().get(i);
                    prompt.append("  阶段").append(i + 1).append(": ").append(phase.getTitle())
                          .append(" - ").append(phase.getDescription()).append("\n");
                }
            }
            prompt.append("\n");
        }
        
        // 添加当前阶段信息
        prompt.append("当前学习阶段：第").append(stage).append("阶段\n");
        
        if (learningPlan != null && learningPlan.getPhases() != null && 
            stage <= learningPlan.getPhases().size()) {
            PhaseDto currentPhase = learningPlan.getPhases().get(stage - 1);
            prompt.append("阶段名称：").append(currentPhase.getTitle()).append("\n");
            prompt.append("阶段目标：").append(currentPhase.getDescription()).append("\n");
        }
        
        prompt.append("\n");
        prompt.append("请生成3-5个用户在当前阶段最可能关心、最适合提问的问题。\n");
        prompt.append("每个问题应包括：\n");
        prompt.append("1. 问题标题（简短描述）\n");
        prompt.append("2. 问题内容（完整的提问语句）\n");
        prompt.append("\n");
        prompt.append("请以JSON数组格式返回，每个对象包含'title'和'text'字段。\n");
        prompt.append("示例格式：\n");
        prompt.append("[\n");
        prompt.append("  {\n");
        prompt.append("    \"title\": \"如何理解Python的核心概念？\",\n");
        prompt.append("    \"text\": \"请用简单的例子解释Python的核心编程概念\"\n");
        prompt.append("  }\n");
        prompt.append("]\n");
        
        return prompt.toString();
    }
    
    /**
     * 解析AI返回的JSON
     */
    private List<SuggestionItem> parseAiResponse(String aiResponse) throws Exception {
        JsonNode suggestionsArray = objectMapper.readTree(aiResponse);
        
        List<SuggestionItem> suggestions = new ArrayList<>();
        if (suggestionsArray.isArray()) {
            for (JsonNode itemNode : suggestionsArray) {
                String title = itemNode.path("title").asText();
                String text = itemNode.path("text").asText();
                
                if (!title.isBlank() && !text.isBlank()) {
                    suggestions.add(new SuggestionItem(title, text));
                }
            }
        }
        
        return suggestions;
    }
    
    /**
     * 获取默认建议（AI调用失败时的备选方案）
     */
    private List<SuggestionItem> getDefaultSuggestions(Integer stage) {
        List<SuggestionItem> suggestions = new ArrayList<>();
        
        switch (stage) {
            case 1:
                suggestions.add(new SuggestionItem(
                    "Python是什么？",
                    "请用简单的语言解释Python编程语言是什么，以及它的主要特点。"
                ));
                suggestions.add(new SuggestionItem(
                    "Python能做什么？",
                    "请举例说明Python在实际应用中可以做什么事情。"
                ));
                suggestions.add(new SuggestionItem(
                    "学习Python需要什么基础？",
                    "作为一个初学者，我需要具备哪些基础知识才能开始学习Python？"
                ));
                break;
            case 2:
                suggestions.add(new SuggestionItem(
                    "Python基础语法有哪些？",
                    "请列出Python最基础、最重要的语法知识点，我应该先掌握哪些？"
                ));
                suggestions.add(new SuggestionItem(
                    "如何安装Python环境？",
                    "请详细说明如何在Windows/Mac上安装Python开发环境。"
                ));
                suggestions.add(new SuggestionItem(
                    "Python变量和数据类型",
                    "请解释Python中的变量和基本数据类型，并举例说明。"
                ));
                break;
            case 3:
                suggestions.add(new SuggestionItem(
                    "Python练习题推荐",
                    "请根据我当前的学习阶段，推荐一些适合的Python练习题。"
                ));
                suggestions.add(new SuggestionItem(
                    "如何调试Python代码？",
                    "当我的Python代码出现错误时，应该如何调试和排查问题？"
                ));
                suggestions.add(new SuggestionItem(
                    "Python代码规范",
                    "请介绍Python的代码规范（PEP 8），以及为什么它很重要。"
                ));
                break;
            default:
                suggestions.add(new SuggestionItem(
                    "学习进度咨询",
                    "根据我当前的学习阶段，我应该重点学习哪些内容？"
                ));
                suggestions.add(new SuggestionItem(
                    "下一步学习建议",
                    "请给我一些关于下一步学习的建议和方向。"
                ));
        }
        
        return suggestions;
    }
}