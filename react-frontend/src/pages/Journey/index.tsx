import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./index.css";
import {
  getSuggestions,
  chat,
  AssessmentResult,
  getLatestAssessment,
} from "../../services/api";
import { logout as doLogout } from "../../modules/auth";

export default function JourneyPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<{
    username?: string;
    displayName?: string;
    hasAssessment?: number;
  }>({ username: "用户" });

  const [assessmentResult, setAssessmentResult] =
    useState<AssessmentResult | null>(null);

  const [chatMessages, setChatMessages] = useState<
    { role: "user" | "ai"; content: string }[]
  >([]);
  const [promptValue, setPromptValue] = useState("");
  const [stage, setStage] = useState(1);
  const [suggestions, setSuggestions] = useState<
    { title: string; text: string }[]
  >([]);
  const [usedSuggestions, setUsedSuggestions] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadUserData = async () => {
      const stored = localStorage.getItem("current_user");
      if (!stored) {
        console.warn("未找到用户信息，跳转到登录");
        navigate("/login");
        return;
      }

      try {
        const userData = JSON.parse(stored);
        setUser(userData);

        // 检查是否已完成体检
        if (userData.hasAssessment !== 1) {
          console.warn("用户未完成体检，跳转到首页");
          navigate("/");
          return;
        }

        // 获取体检结果
        try {
          const res = await getLatestAssessment();
          if (res.success && res.result) {
            setAssessmentResult(res.result);
          } else {
            console.error("获取体检结果失败", res.error);
            // 清除 hasAssessment 标记，防止死循环
            const updatedUser = { ...userData, hasAssessment: 0 };
            localStorage.setItem("current_user", JSON.stringify(updatedUser));
            navigate("/");
          }
        } catch (err) {
          console.error("获取体检结果请求失败", err);
          // 清除 hasAssessment 标记，防止死循环
          const updatedUser = { ...userData, hasAssessment: 0 };
          localStorage.setItem("current_user", JSON.stringify(updatedUser));
          navigate("/");
        }
      } catch (e) {
        console.error("解析用户信息失败", e);
        navigate("/login");
      }
    };

    loadUserData();
    // 仅在挂载时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (assessmentResult) {
      getSuggestions(
        stage,
        assessmentResult.plan,
        assessmentResult.profile,
        usedSuggestions,
      )
        .then((res) => {
          if (res.success) setSuggestions(res.suggestions || []);
        })
        .catch(console.error);
    }
  }, [stage, assessmentResult, usedSuggestions]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleLogout = () => {
    doLogout();
    window.location.href = "/login";
  };

  const handleSend = async (
    text: string = promptValue,
    isSuggestion: boolean = false,
  ) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    // 如果是点击建议问题，则进行额外处理
    if (isSuggestion) {
      // 添加到已使用的建议
      setUsedSuggestions((prev) => [...prev, trimmed]);

      // 从当前建议中移除
      setSuggestions((prev) => prev.filter((s) => s.text !== trimmed));
    }

    setChatMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setPromptValue("");
    setIsSending(true);

    try {
      const res = await chat({
        question: trimmed,
        stage: stage,
        preferredStyle: assessmentResult?.profile?.preferredStyle,
        userProfile: assessmentResult?.profile,
        learningPlan: assessmentResult?.plan,
      });
      if (res.success && res.answer) {
        setChatMessages((prev) => [
          ...prev,
          { role: "ai", content: res.answer! },
        ]);
      } else {
        setChatMessages((prev) => [
          ...prev,
          { role: "ai", content: res.message || "请求失败，请稍后重试。" },
        ]);
      }
    } catch (err) {
      console.error(err);
      setChatMessages((prev) => [
        ...prev,
        { role: "ai", content: "网络错误，请稍后重试。" },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const detectModuleCovered = (text: string, key: string) => {
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
  };

  const coveredCount = [
    "goal",
    "background",
    "attempt",
    "stuck",
    "format",
  ].filter((k) => detectModuleCovered(promptValue, k)).length;

  const initial = (user?.displayName || user?.username || "U")[0].toUpperCase();

  // 如果体检结果还未加载，返回空界面（会很快被 navigate 导出或加载完成）
  if (
    !assessmentResult ||
    !assessmentResult.plan ||
    !assessmentResult.profile
  ) {
    return null;
  }

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="logo-area">
          <div className="logo-mark">Q</div>
          <div className="logo-text">
            <div className="logo-title">AI 提问教练</div>
            <div className="logo-subtitle">让 AI 成为你的学习搭档</div>
          </div>
        </div>
        <div className="user-info">
          <div className="user-avatar">
            <span>{initial}</span>
          </div>
          <div className="user-details">
            <div className="user-name">
              {user.displayName || user.username || "用户"}
            </div>
            <button className="user-action" onClick={handleLogout}>
              退出
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <aside className="sidebar">
          <section className="card" id="assessment-summary-card">
            <h2 className="card-title">你的 AI 学习画像</h2>
            <div className="profile-badge">
              <div className="profile-level">
                {assessmentResult.profile?.level}
              </div>
              <div className="profile-tag-row">
                {assessmentResult.profile?.tags?.map((t, i) => (
                  <span key={`tag-${i}`} className="tag">
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="profile-section">
              <div className="section-label">当前技能判断</div>
              <p className="section-content">
                {assessmentResult.profile?.abilitySummary}
              </p>
            </div>
            <div className="profile-section">
              <div className="section-label">最需要补的知识类型</div>
              <ul className="section-list">
                {assessmentResult.profile?.knowledgeGaps?.map((g, i) => (
                  <li key={`gap-${i}`}>{g}</li>
                ))}
              </ul>
            </div>
          </section>

          {assessmentResult.plan && (
            <section className="card" id="plan-card">
              <h2 className="card-title">你的专属学习计划</h2>
              <div className="plan-time">
                <span className="section-label">每日学习时间</span>
                <div className="plan-time-value">
                  {assessmentResult.plan.dailyTime}
                </div>
              </div>
              <div className="plan-phases">
                <div className="phase-header">
                  <span className="section-label">当前学习阶段</span>
                  <span className="phase-current-label">
                    {assessmentResult.plan.phases?.[0]?.title || "阶段一"}
                  </span>
                </div>
                <ol className="phase-list">
                  {assessmentResult.plan.phases?.map((p, i) => (
                    <li
                      key={`phase-${i}`}
                      className={`phase-item ${i === 0 ? "phase-item-active" : ""}`}
                    >
                      <div className="phase-title">{p.title}</div>
                      <div className="phase-desc">
                        {p.desc || p.description}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          )}
        </aside>

        <section className="main-content">
          <section className="card" id="journey-card">
            <div className="journey-header">
              <div>
                <h2 className="card-title">学习之旅 · AI 提问教练</h2>
              </div>
              <div className="journey-stage-pill">
                当前阶段：
                <span>{assessmentResult.plan?.phases?.[0]?.title}</span>
              </div>
            </div>

            <div className="journey-layout">
              <div className="journey-panel conversation-panel">
                <div className="chat-window">
                  {chatMessages.map((msg, i) => (
                    <div
                      key={`msg-${i}`}
                      className={`chat-message ${msg.role === "ai" ? "ai" : "user"}`}
                    >
                      <div className={`avatar ${msg.role}`}>
                        {msg.role === "ai" ? "AI" : initial}
                      </div>
                      <div className="bubble">{msg.content}</div>
                    </div>
                  ))}
                  {isSending && (
                    <div className="chat-message ai">
                      <div className="avatar ai">AI</div>
                      <div className="bubble">
                        <div className="thinking-animation">AI 正在思考</div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </div>

              <div className="journey-panel suggestion-panel">
                <div className="panel-header">
                  <div className="panel-title">提示问题区</div>
                  <div className="panel-subtitle">
                    根据您的学习画像和当前阶段，AI为您推荐的相关问题。点击即可发送。
                  </div>
                </div>

                <div className="suggestion-stage-switch">
                  <span className="section-label">当前学习阶段</span>
                  <div className="stage-tabs">
                    {[1, 2, 3].map((s) => (
                      <button
                        key={s}
                        className={`stage-tab ${stage === s ? "stage-tab-active" : ""}`}
                        onClick={() => setStage(s)}
                      >
                        阶段{s === 1 ? "一" : s === 2 ? "二" : "三"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="suggestion-list">
                  {suggestions.map((item, i) => (
                    <div
                      key={`suggest-${i}`}
                      className="suggestion-item"
                      onClick={() => handleSend(item.text, true)}
                    >
                      <div className="suggestion-item-title">{item.title}</div>
                      <div className="suggestion-item-desc">{item.text}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="journey-panel input-panel">
                <div className="prompt-structure">
                  <span
                    className={`structure-item structure-tag ${
                      detectModuleCovered(promptValue, "goal")
                        ? "structure-item-active"
                        : ""
                    }`}
                  >
                    明确目标
                  </span>
                  <span
                    className={`structure-item structure-tag ${
                      detectModuleCovered(promptValue, "background")
                        ? "structure-item-active"
                        : ""
                    }`}
                  >
                    提供背景
                  </span>
                  <span
                    className={`structure-item structure-tag ${
                      detectModuleCovered(promptValue, "attempt")
                        ? "structure-item-active"
                        : ""
                    }`}
                  >
                    描述尝试
                  </span>
                  <span
                    className={`structure-item structure-tag ${
                      detectModuleCovered(promptValue, "stuck")
                        ? "structure-item-active"
                        : ""
                    }`}
                  >
                    明确卡点
                  </span>
                  <span
                    className={`structure-item structure-tag ${
                      detectModuleCovered(promptValue, "format")
                        ? "structure-item-active"
                        : ""
                    }`}
                  >
                    规定格式
                  </span>
                </div>
                <div className="prompt-input-area">
                  <textarea
                    className="input textarea"
                    placeholder="输入你的问题...（建议包含：目标、背景、你已有的尝试和具体的卡点）"
                    value={promptValue}
                    onChange={(e) => setPromptValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                  ></textarea>
                </div>
                <div className="prompt-footer">
                  <div className="prompt-actions">
                    <button
                      className="btn primary"
                      disabled={isSending}
                      onClick={() => handleSend()}
                    >
                      {isSending ? "发送中..." : "提问 AI 教练"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
