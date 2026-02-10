package com.example.aicoach.service;

import com.example.aicoach.dto.AssessmentRequest;
import com.example.aicoach.dto.AssessmentResult;
import org.springframework.stereotype.Service;

@Service
public class AssessmentService {

    private final AiClient aiClient;

    public AssessmentService(AiClient aiClient) {
        this.aiClient = aiClient;
    }

    public AssessmentResult evaluate(AssessmentRequest req) {
        String normalizedDailyTime = normalizeDailyTime(req.getDailyTime());
        String prompt = buildPrompt(req, normalizedDailyTime);

        String aiJson = aiClient.completeAsJson(prompt);
        return aiClient.parseAssessmentResult(aiJson);
    }

    private String normalizeDailyTime(String raw) {
        if (raw == null || raw.isBlank()) {
            return "60 分钟 / 每天";
        }
        String text = raw.replaceAll("\\s+", "");
        if (text.contains("30")) {
            return "30 分钟 / 每天";
        }
        if (text.contains("2小时") || text.contains("两小时")) {
            return "120 分钟 / 每天";
        }
        if (text.contains("3小时") || text.contains("三小时")) {
            return "180 分钟 / 每天";
        }
        return "60 分钟 / 每天";
    }

    private String buildPrompt(AssessmentRequest r, String dailyTime) {
        return """
你是一个「AI 学习教练」，擅长根据用户的学习目标和基础，生成学习画像和学习计划。

现在有一位用户的体检问卷回答如下（用中文理解）：

1）他最想做什么 / 用 AI 学什么（学习/应用方向）：
%s

2）他当前阶段的核心学习目标：
%s

3）他目前对这个方向的掌握程度：
%s

4）他更喜欢 AI 如何帮他学习（偏好风格）：
%s

5）他理想中每天能拿出多久时间学习（原始描述）：
%s

后端系统已经把「每日学习时间」规范化为：
%s

请根据以上信息，输出一个 JSON，**严格按照下面的结构，不要多字段，不要解释文本，不要输出 markdown 代码块标记**：

{
  "profile": {
    "level": "字符串，描述当前能力水平和方向，例如：'初学者 · Python Web 开发方向'",
    "tags": [
      "字符串标签1，例如：'目标：转行找工作'",
      "字符串标签2，例如：'风格：教练式引导'"
    ],
    "abilitySummary": "1 段话，2～3 句，对当前能力的判断和评价",
    "knowledgeGaps": [
      "需要补的知识点 1",
      "需要补的知识点 2",
      "需要补的知识点 3"
    ]
  },
  "plan": {
    "dailyTime": "直接使用我给你的规范化时间字符串，例如："%s"",
    "currentPhase": "当前最适合他的学习阶段标题，例如：'阶段一 · 打好 Python 基础'",
    "phases": [
      {
        "title": "阶段一：xxx",
        "description": "用 1 段话概括这一阶段要做什么，结合他的目标和基础"
      },
      {
        "title": "阶段二：xxx",
        "description": "..."
      },
      {
        "title": "阶段三：xxx",
        "description": "..."
      }
    ],
    "progress": {
      "levelLabel": "用游戏化的方式给他一个等级名，例如：'Lv.1 新手探索者'",
      "percent": 20
    }
  }
}

注意：
- 只返回 JSON 字符串，不要带多余解释或 Markdown。
- 所有字段必须填写，不能为 null。
""".formatted(
                safe(r.getWantToDo()),
                safe(r.getGoal()),
                safe(r.getCurrentLevel()),
                safe(r.getPreferredStyle()),
                safe(r.getDailyTime()),
                dailyTime,
                dailyTime
        );
    }

    private String safe(String s) {
        return s == null ? "" : s;
    }
}

