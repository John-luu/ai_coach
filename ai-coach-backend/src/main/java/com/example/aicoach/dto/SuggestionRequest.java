package com.example.aicoach.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class SuggestionRequest {
    private Integer stage;
    private PlanDto learningPlan;
    private ProfileDto userProfile;
    
    // 构造函数
    public SuggestionRequest() {}
    
    public SuggestionRequest(Integer stage, PlanDto learningPlan, ProfileDto userProfile) {
        this.stage = stage;
        this.learningPlan = learningPlan;
        this.userProfile = userProfile;
    }
    
    // Getters and Setters
    public Integer getStage() {
        return stage;
    }
    
    public void setStage(Integer stage) {
        this.stage = stage;
    }
    
    public PlanDto getLearningPlan() {
        return learningPlan;
    }
    
    public void setLearningPlan(PlanDto learningPlan) {
        this.learningPlan = learningPlan;
    }
    
    public ProfileDto getUserProfile() {
        return userProfile;
    }
    
    public void setUserProfile(ProfileDto userProfile) {
        this.userProfile = userProfile;
    }
}