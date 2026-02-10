package com.example.aicoach.dto;

/**
 * 体检结果：学习画像 + 学习计划
 */
public class AssessmentResult {

    private ProfileDto profile;
    private PlanDto plan;

    public ProfileDto getProfile() {
        return profile;
    }

    public void setProfile(ProfileDto profile) {
        this.profile = profile;
    }

    public PlanDto getPlan() {
        return plan;
    }

    public void setPlan(PlanDto plan) {
        this.plan = plan;
    }
}

