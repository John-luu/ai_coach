package com.example.aicoach.dto;

import java.util.List;

/**
 * 「你的 AI 学习画像」数据结构
 */
public class ProfileDto {

    /** 能力水平 + 方向，例如：初学者 · Python Web 开发方向 */
    private String level;

    /** 标签行，例如：目标：转行找工作、风格：教练式引导 */
    private List<String> tags;

    /** 当前能力的整体判断（1 段话） */
    private String abilitySummary;

    /** 需要补的知识点列表 */
    private List<String> knowledgeGaps;

    public String getLevel() {
        return level;
    }

    public void setLevel(String level) {
        this.level = level;
    }

    public List<String> getTags() {
        return tags;
    }

    public void setTags(List<String> tags) {
        this.tags = tags;
    }

    public String getAbilitySummary() {
        return abilitySummary;
    }

    public void setAbilitySummary(String abilitySummary) {
        this.abilitySummary = abilitySummary;
    }

    public List<String> getKnowledgeGaps() {
        return knowledgeGaps;
    }

    public void setKnowledgeGaps(List<String> knowledgeGaps) {
        this.knowledgeGaps = knowledgeGaps;
    }
}

