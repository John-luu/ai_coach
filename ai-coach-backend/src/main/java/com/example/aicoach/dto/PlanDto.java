package com.example.aicoach.dto;

import java.util.List;

/**
 * 「你的专属学习计划」数据结构
 */
public class PlanDto {

    /** 规范化后的每日学习时间，例如：60 分钟 / 每天 */
    private String dailyTime;

    /** 当前阶段标题，例如：阶段一 · 打好 Python 基础 */
    private String currentPhase;

    /** 分阶段学习计划 */
    private List<PhaseDto> phases;

    /** 用于右侧/左侧进度显示 */
    private PlanProgressDto progress;

    public String getDailyTime() {
        return dailyTime;
    }

    public void setDailyTime(String dailyTime) {
        this.dailyTime = dailyTime;
    }

    public String getCurrentPhase() {
        return currentPhase;
    }

    public void setCurrentPhase(String currentPhase) {
        this.currentPhase = currentPhase;
    }

    public List<PhaseDto> getPhases() {
        return phases;
    }

    public void setPhases(List<PhaseDto> phases) {
        this.phases = phases;
    }

    public PlanProgressDto getProgress() {
        return progress;
    }

    public void setProgress(PlanProgressDto progress) {
        this.progress = progress;
    }
}

