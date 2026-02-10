package com.example.aicoach.dto;

/**
 * 学习之旅进度条信息
 */
public class PlanProgressDto {

    /** 等级标签，例如：Lv.1 新手探索者 */
    private String levelLabel;

    /** 百分比 0-100 */
    private int percent;

    public String getLevelLabel() {
        return levelLabel;
    }

    public void setLevelLabel(String levelLabel) {
        this.levelLabel = levelLabel;
    }

    public int getPercent() {
        return percent;
    }

    public void setPercent(int percent) {
        this.percent = percent;
    }
}

