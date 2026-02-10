// ------------------------------
// 学习能力体检向导（前端 Demo，问题与逻辑写死）
// ------------------------------

const assessmentCard = document.getElementById("assessment-card");
const assessmentSteps = Array.from(
  document.querySelectorAll(".assessment-step"),
);
const assessmentPrevBtn = document.getElementById("assessment-prev-btn");
const assessmentNextBtn = document.getElementById("assessment-next-btn");
const assessmentProgressBar = document.getElementById(
  "assessment-progress-bar",
);
const assessmentProgressLabel = document.getElementById(
  "assessment-progress-label",
);
const startAssessmentBtn = document.getElementById("start-assessment-btn");
const assessmentSummaryCard = document.getElementById(
  "assessment-summary-card",
);
const planCard = document.getElementById("plan-card");
const introSection = document.getElementById("intro-section");
const goJourneyBtn = document.getElementById("go-journey-btn");
const journeyCard = document.getElementById("journey-card");
const currentPhaseLabel = document.getElementById("current-phase-label");
const journeyStageLabel = document.getElementById("journey-stage-label");
const journeyProgressBar = document.getElementById("journey-progress-bar");
const journeyProgressText = document.getElementById("journey-progress-text");

// 后端 API 地址
const API_BASE_URL = "http://localhost:8080";

// 最近一次体检的 AI 评估结果
let lastAssessmentResult = null;

// 左侧画像 & 学习计划相关 DOM
const profileLevelEl = document.querySelector(".profile-level");
const profileTagRowEl = document.querySelector(".profile-tag-row");
const abilityContentEl = document.querySelector(
  "#assessment-summary-card .section-content",
);
const knowledgeListEl = document.querySelector(
  "#assessment-summary-card .section-list",
);
const planTimeValueEl = document.querySelector(".plan-time-value");
const phaseListEl = document.querySelector(".phase-list");

let currentAssessmentStep = 1;
const totalAssessmentSteps = assessmentSteps.length;

function startJourney() {
  if (!assessmentCard || !journeyCard) return;

  assessmentCard.classList.add("hidden");
  journeyCard.classList.remove("hidden");

  if (lastAssessmentResult && lastAssessmentResult.plan) {
    const plan = lastAssessmentResult.plan;
    if (journeyStageLabel && plan.currentPhase) {
      journeyStageLabel.textContent = plan.currentPhase;
    }
  } else {
    if (currentPhaseLabel) {
      currentPhaseLabel.textContent = "阶段一 · 打好问题地基";
    }
    if (journeyStageLabel) {
      journeyStageLabel.textContent = "阶段一 · 目标说清楚";
    }
    if (journeyProgressBar) {
      journeyProgressBar.style.width = "20%";
    }
    if (journeyProgressText) {
      journeyProgressText.textContent = "Lv.1 新手探索者 · 进度 20%";
    }
  }

  journeyCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

function populateProfileAndPlan(result) {
  if (!result) return;
  lastAssessmentResult = result;

  const profile = result.profile || {};
  const plan = result.plan || {};

  // 学习画像
  if (profileLevelEl && profile.level) {
    profileLevelEl.textContent = profile.level;
  }

  if (profileTagRowEl) {
    profileTagRowEl.innerHTML = "";
    const tags = Array.isArray(profile.tags) ? profile.tags : [];
    tags.forEach((tagText) => {
      const span = document.createElement("span");
      span.className = "tag";
      span.textContent = tagText;
      profileTagRowEl.appendChild(span);
    });
  }

  if (abilityContentEl && profile.abilitySummary) {
    abilityContentEl.textContent = profile.abilitySummary;
  }

  if (knowledgeListEl) {
    knowledgeListEl.innerHTML = "";
    const gaps = Array.isArray(profile.knowledgeGaps)
      ? profile.knowledgeGaps
      : [];
    gaps.forEach((gap) => {
      const li = document.createElement("li");
      li.textContent = gap;
      knowledgeListEl.appendChild(li);
    });
  }

  // 学习计划
  if (planTimeValueEl && plan.dailyTime) {
    planTimeValueEl.textContent = plan.dailyTime;
  }

  if (currentPhaseLabel && plan.currentPhase) {
    currentPhaseLabel.textContent = plan.currentPhase;
  }

  if (phaseListEl) {
    phaseListEl.innerHTML = "";
    const phases = Array.isArray(plan.phases) ? plan.phases : [];
    phases.forEach((phase, index) => {
      const li = document.createElement("li");
      li.className = "phase-item";
      if (index === 0) {
        li.classList.add("phase-item-active");
      }

      const titleDiv = document.createElement("div");
      titleDiv.className = "phase-title";
      titleDiv.textContent = phase.title || "";

      const descDiv = document.createElement("div");
      descDiv.className = "phase-desc";
      descDiv.textContent = phase.description || "";

      li.appendChild(titleDiv);
      li.appendChild(descDiv);
      phaseListEl.appendChild(li);
    });
  }

  const progress = plan.progress || {};
  const percent =
    typeof progress.percent === "number" && progress.percent >= 0
      ? Math.min(progress.percent, 100)
      : 20;
  const levelLabel = progress.levelLabel || "Lv.1 学习者";

  if (journeyProgressBar) {
    journeyProgressBar.style.width = `${percent}%`;
  }
  if (journeyProgressText) {
    journeyProgressText.textContent = `${levelLabel} · 进度 ${percent}%`;
  }
}

function collectAssessmentAnswers() {
  const q1Textarea = document.querySelector(
    '.assessment-step[data-step="1"] textarea',
  );
  const q2Selected = document.querySelector(
    '.assessment-step[data-step="2"] .chip-selected',
  );
  const q3Selected = document.querySelector(
    '.assessment-step[data-step="3"] .chip-selected',
  );
  const q4Selected = document.querySelector(
    '.assessment-step[data-step="4"] .chip-selected',
  );
  const q5Input = document.querySelector(
    '.assessment-step[data-step="5"] input',
  );

  return {
    wantToDo: q1Textarea?.value.trim() || "",
    goal: q2Selected?.textContent.trim() || "",
    currentLevel: q3Selected?.textContent.trim() || "",
    preferredStyle: q4Selected?.textContent.trim() || "",
    dailyTime: q5Input?.value.trim() || "",
  };
}

async function handleAssessmentComplete() {
  const answers = collectAssessmentAnswers();

  if (!answers.wantToDo) {
    alert("请先填写：你现在最想用 AI 帮你学什么？");
    currentAssessmentStep = 1;
    updateAssessmentUI();
    return;
  }
  if (!answers.goal) {
    alert("请先选择：当前阶段你的核心学习目标。");
    currentAssessmentStep = 2;
    updateAssessmentUI();
    return;
  }

  if (assessmentNextBtn) {
    assessmentNextBtn.disabled = true;
    assessmentNextBtn.textContent = "生成学习画像中…";
  }

  try {
    const resp = await fetch(`${API_BASE_URL}/api/assessment/evaluate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(answers),
    });

    if (!resp.ok) {
      throw new Error(`后端返回错误状态码：${resp.status}`);
    }

    const data = await resp.json();
    populateProfileAndPlan(data);

    assessmentSummaryCard.classList.remove("hidden");
    planCard.classList.remove("hidden");
    introSection.classList.add("hidden");

    document
      .querySelector(".sidebar")
      ?.scrollTo({ top: 0, behavior: "smooth" });

    startJourney();
  } catch (err) {
    console.error(err);
    alert("生成学习画像失败，请稍后重试。");
  } finally {
    if (assessmentNextBtn) {
      assessmentNextBtn.disabled = false;
      assessmentNextBtn.textContent = "完成体检";
    }
  }
}

function updateAssessmentUI() {
  assessmentSteps.forEach((step) => {
    const stepIndex = Number(step.dataset.step);
    step.classList.toggle("active", stepIndex === currentAssessmentStep);
  });

  const progressPercent = (currentAssessmentStep / totalAssessmentSteps) * 100;
  assessmentProgressBar.style.width = `${progressPercent}%`;
  assessmentProgressLabel.textContent = `第 ${currentAssessmentStep} / ${totalAssessmentSteps} 题`;

  assessmentPrevBtn.disabled = currentAssessmentStep === 1;
  assessmentPrevBtn.style.opacity = currentAssessmentStep === 1 ? 0.5 : 1;
  assessmentPrevBtn.style.cursor =
    currentAssessmentStep === 1 ? "default" : "pointer";

  if (currentAssessmentStep === totalAssessmentSteps) {
    assessmentNextBtn.textContent = "完成体检";
  } else {
    assessmentNextBtn.textContent = "下一题";
  }
}

if (assessmentPrevBtn && assessmentNextBtn) {
  assessmentPrevBtn.addEventListener("click", () => {
    if (currentAssessmentStep > 1) {
      currentAssessmentStep -= 1;
      updateAssessmentUI();
    }
  });

  assessmentNextBtn.addEventListener("click", () => {
    if (currentAssessmentStep < totalAssessmentSteps) {
      currentAssessmentStep += 1;
      updateAssessmentUI();
    } else {
      handleAssessmentComplete();
    }
  });
}

if (startAssessmentBtn) {
  startAssessmentBtn.addEventListener("click", () => {
    document.getElementById("assessment-card")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
}

// 选中 chip
document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const group = chip.parentElement;
    if (!group) return;
    group.querySelectorAll(".chip").forEach((c) => {
      if (c !== chip) c.classList.remove("chip-selected");
    });
    chip.classList.toggle("chip-selected");
  });
});

// 点击「开始学习之旅」
if (goJourneyBtn) {
  goJourneyBtn.addEventListener("click", () => {
    startJourney();
  });
}

// ------------------------------
// 提示问题区（动态从后端获取）
// ------------------------------

const suggestionList = document.getElementById("suggestion-list");
const stageTabs = Array.from(document.querySelectorAll(".stage-tab"));

// 关键修复：API路径改为 /api/ai/suggestions
async function fetchSuggestions(stage, learningPlan) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ai/suggestions`, {
      // 这里修复了！
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stage: parseInt(stage),
        learningPlan: learningPlan,
        userProfile: lastAssessmentResult?.profile,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `请求失败: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "获取提示问题失败");
    }

    return data.suggestions || [];
  } catch (error) {
    console.error("获取提示问题失败:", error);
    throw error;
  }
}

async function renderSuggestions(stage) {
  if (!suggestionList) {
    console.error("suggestionList 元素未找到");
    return;
  }

  console.log(`开始加载阶段 ${stage} 的提示问题...`);

  suggestionList.innerHTML = '<div class="loading">加载提示问题中...</div>';

  try {
    const suggestions = await fetchSuggestions(
      stage,
      lastAssessmentResult?.plan,
    );

    console.log(`收到 ${suggestions?.length || 0} 个提示问题`, suggestions);

    suggestionList.innerHTML = "";

    if (!suggestions || suggestions.length === 0) {
      console.warn("没有获取到提示问题");
      suggestionList.innerHTML = '<div class="no-data">暂无提示问题</div>';
      return;
    }

    suggestions.forEach((item) => {
      const div = document.createElement("div");
      div.className = "suggestion-item";
      div.innerHTML = `
        <div class="suggestion-item-title">${item.title || "无标题"}</div>
        <div class="suggestion-item-desc">${item.text || "无内容"}</div>
      `;
      div.addEventListener("click", async () => {
        if (promptInput) {
          promptInput.value = item.text || "";
          updatePromptStructureState();
        }
        await sendQuestionToAI(item.text || "");
      });
      suggestionList.appendChild(div);
    });

    console.log("提示问题渲染完成");
  } catch (error) {
    console.error("渲染提示问题失败:", error);
    suggestionList.innerHTML = `<div class="error">加载失败: ${error.message}</div>`;
  }
}

if (stageTabs.length > 0) {
  stageTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const stage = tab.dataset.stage;
      stageTabs.forEach((t) => t.classList.remove("stage-tab-active"));
      tab.classList.add("stage-tab-active");
      renderSuggestions(stage);

      const stageNames = {
        1: "阶段一 · 目标说清楚",
        2: "阶段二 · 背景讲清楚",
        3: "阶段三 · 卡点说具体",
        4: "阶段四 · 小项目实践",
        5: "阶段五 · 企业级应用",
      };
      if (journeyStageLabel) {
        journeyStageLabel.textContent = stageNames[stage] || `阶段${stage}`;
      }
    });
  });

  renderSuggestions("1");
}

// ------------------------------
// 对话功能
// ------------------------------

const chatWindow = document.getElementById("chat-window");

function appendChatBubble(role, text) {
  if (!chatWindow) return;
  const messageDiv = document.createElement("div");
  messageDiv.className = `chat-message ${role}`;
  const avatarLabel = role === "ai" ? "AI" : "你";
  messageDiv.innerHTML = `
    <div class="avatar ${role}">${avatarLabel}</div>
    <div class="bubble">${text}</div>
  `;
  chatWindow.appendChild(messageDiv);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// 真实对话功能
async function sendQuestionToAI(question) {
  if (!question || !question.trim()) return;

  appendChatBubble("user", question);

  const thinkingDiv = document.createElement("div");
  thinkingDiv.className = "chat-message ai thinking";
  thinkingDiv.innerHTML = `
    <div class="avatar ai">AI</div>
    <div class="bubble">
      <div class="thinking-animation">AI正在思考...</div>
    </div>
  `;
  chatWindow.appendChild(thinkingDiv);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  try {
    const response = await fetch(`${API_BASE_URL}/api/ai/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: question,
        stage: getCurrentStage(),
        userProfile: lastAssessmentResult?.profile,
        learningPlan: lastAssessmentResult?.plan,
      }),
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }

    const data = await response.json();
    chatWindow.removeChild(thinkingDiv);

    if (data.success && data.answer) {
      appendChatBubble("ai", data.answer);
    } else {
      appendChatBubble("ai", "抱歉，暂时无法处理您的请求。");
    }
  } catch (error) {
    console.error("AI对话失败:", error);
    if (thinkingDiv.parentNode) {
      chatWindow.removeChild(thinkingDiv);
    }
    appendChatBubble("ai", "抱歉，暂时无法处理您的请求。请稍后重试。");
  }
}

function getCurrentStage() {
  const activeTab = document.querySelector(".stage-tab-active");
  return activeTab ? activeTab.dataset.stage : "1";
}

// ------------------------------
// 提问输入区
// ------------------------------

const promptInput = document.getElementById("prompt-input");
const promptClearBtn = document.getElementById("prompt-clear-btn");
const promptSendBtn = document.getElementById("prompt-send-btn");
const promptCompleteness = document.getElementById("prompt-completeness");
const structureItems = Array.from(document.querySelectorAll(".structure-item"));

function detectModuleCovered(text, key) {
  const normalized = text.trim();
  if (!normalized) return false;

  switch (key) {
    case "goal":
      return /目标|想学|希望学|想要/.test(normalized);
    case "background":
      return /背景|目前|现在在|我有.*基础|上过.*课/.test(normalized);
    case "attempt":
      return /尝试|试过|查过|看过|做过/.test(normalized);
    case "stuck":
      return /卡在|不会|不懂|搞不清楚|困惑|问题在于/.test(normalized);
    case "format":
      return /希望你|请你|用.*方式|分步骤|给出示例|给示例代码|整理成/.test(
        normalized,
      );
    default:
      return false;
  }
}

function updatePromptStructureState() {
  if (!promptInput) return;
  const text = promptInput.value || "";
  let count = 0;

  structureItems.forEach((item) => {
    const key = item.dataset.key;
    if (!key) return;
    const covered = detectModuleCovered(text, key);
    item.classList.toggle("structure-item-active", covered);
    if (covered) count += 1;
  });

  if (promptCompleteness) {
    promptCompleteness.textContent = `提问完整度：${count} / 5`;
  }
}

if (promptInput) {
  promptInput.addEventListener("input", updatePromptStructureState);
}

if (promptClearBtn && promptInput) {
  promptClearBtn.addEventListener("click", () => {
    promptInput.value = "";
    updatePromptStructureState();
    promptInput.focus();
  });
}

// 关键修复：只保留一个发送按钮事件监听器
if (promptSendBtn && promptInput) {
  promptSendBtn.addEventListener("click", async () => {
    const text = promptInput.value.trim();
    if (!text) return;

    await sendQuestionToAI(text);
    promptInput.value = "";
    updatePromptStructureState();
  });
}
