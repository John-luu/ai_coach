package com.example.aicoach.dto;

/**
 * 前端「学习能力体检」提交的 5 个问题答案
 */
public class AssessmentRequest {

    /** 第1题：最想做什么 / 学什么 / 用来干什么 */
    private String wantToDo;

    /** 第2题：当前阶段的核心目标 */
    private String goal;

    /** 第3题：当前掌握程度（结合第1题的方向来描述） */
    private String currentLevel;

    /** 第4题：更喜欢 AI 如何帮你学习（偏好风格） */
    private String preferredStyle;

    /** 第5题：理想中每天能拿出多少时间学习（原始文本） */
    private String dailyTime;

    public String getWantToDo() {
        return wantToDo;
    }

    public void setWantToDo(String wantToDo) {
        this.wantToDo = wantToDo;
    }

    public String getGoal() {
        return goal;
    }

    public void setGoal(String goal) {
        this.goal = goal;
    }

    public String getCurrentLevel() {
        return currentLevel;
    }

    public void setCurrentLevel(String currentLevel) {
        this.currentLevel = currentLevel;
    }

    public String getPreferredStyle() {
        return preferredStyle;
    }

    public void setPreferredStyle(String preferredStyle) {
        this.preferredStyle = preferredStyle;
    }

    public String getDailyTime() {
        return dailyTime;
    }

    public void setDailyTime(String dailyTime) {
        this.dailyTime = dailyTime;
    }
}

