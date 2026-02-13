import React, { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import "./index.css";
import {
  getSuggestions,
  chat,
  AssessmentResult,
  getLatestAssessment,
  crossStageGenerateQuestions,
  crossStageSubmitTest,
  CrossStageQuestion,
  ChatSession,
  ChatMessage,
  getSessions,
  createSession,
  getSessionMessages,
  getGreeting,
} from "../../services/api";
import { logout as doLogout } from "../../modules/auth";
import CrossStageTest from "../../components/CrossStageTest";

export default function JourneyPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<{
    username?: string;
    displayName?: string;
    hasAssessment?: number;
    stage?: number;
  }>({ username: "用户" });

  const [assessmentResult, setAssessmentResult] =
    useState<AssessmentResult | null>(null);

  const [chatMessages, setChatMessages] = useState<
    { role: "user" | "ai"; content: string; createdAt?: string }[]
  >([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSessionsLoading, setIsSessionsLoading] = useState(false);

  const [promptValue, setPromptValue] = useState("");
  const [stage, setStage] = useState(1);
  const [unlockedStage, setUnlockedStage] = useState(1);
  const [suggestions, setSuggestions] = useState<
    { title: string; text: string }[]
  >([]);
  const [usedSuggestions, setUsedSuggestions] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [suggestionPopoverOpen, setSuggestionPopoverOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeSidebarCard, setActiveSidebarCard] = useState<
    "profile" | "plan" | "history"
  >("profile");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const suggestionTriggerRef = useRef<HTMLDivElement>(null);
  const [popoverPosition, setPopoverPosition] = useState<{
    bottom: number;
    right: number | string;
    left: number | string;
  }>({
    bottom: 0,
    right: 0,
    left: "auto",
  });
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [greeting, setGreeting] = useState("今天学什么？一起吧");

  const fetchSessions = useCallback(async () => {
    setIsSessionsLoading(true);
    try {
      const res = await getSessions();
      if (res.success && res.sessions) {
        setSessions(res.sessions);
        // If no current session, and there are sessions, select the first one
        if (!currentSessionId && res.sessions.length > 0) {
          handleSwitchSession(res.sessions[0].id);
        }
      }
    } catch (err) {
      console.error("获取会话列表失败", err);
    } finally {
      setIsSessionsLoading(false);
    }
  }, [currentSessionId]);

  useEffect(() => {
    getGreeting().then((res) => {
      if (res.success && res.greeting) {
        setGreeting(res.greeting);
      }
    });
  }, []);

  const handleSwitchSession = async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    try {
      const res = await getSessionMessages(sessionId);
      if (res.success && res.messages) {
        setChatMessages(
          res.messages.map((m) => ({
            role: m.role,
            content: m.content,
            createdAt: m.createdAt,
          })),
        );
      }
    } catch (err) {
      console.error("获取消息失败", err);
    }
  };

  const handleNewChat = async () => {
    try {
      const res = await createSession();
      if (res.success && res.session) {
        setSessions((prev) => [res.session!, ...prev]);
        setCurrentSessionId(res.session.id);
        setChatMessages([]);
        setActiveSidebarCard("history");
      }
    } catch (err) {
      console.error("创建新会话失败", err);
    }
  };

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
        if (userData.stage) {
          setStage(userData.stage);
          setUnlockedStage(userData.stage);
        }

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
          return;
        }

        // Fetch sessions after user is loaded
        fetchSessions();
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
  }, [chatMessages, isSending]);

  const updatePopoverPosition = useCallback(() => {
    const el = suggestionTriggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (isSidebarCollapsed) {
      setPopoverPosition({
        bottom: window.innerHeight - rect.bottom,
        left: rect.right + 12,
        right: "auto",
      });
    } else {
      setPopoverPosition({
        bottom: window.innerHeight - rect.bottom,
        right: window.innerWidth - rect.left + 12,
        left: "auto",
      });
    }
  }, [isSidebarCollapsed]);

  const closeSuggestionPopover = useCallback(() => {
    setSuggestionPopoverOpen(false);
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      // Handle suggestion popover
      if (suggestionPopoverOpen) {
        const wrapper = suggestionTriggerRef.current;
        const popover = document.querySelector(".suggestion-popover");
        if (
          wrapper &&
          !wrapper.contains(e.target as Node) &&
          popover &&
          !popover.contains(e.target as Node)
        ) {
          closeSuggestionPopover();
        }
      }

      // Handle user menu
      if (isUserMenuOpen) {
        if (
          userMenuRef.current &&
          !userMenuRef.current.contains(e.target as Node)
        ) {
          setIsUserMenuOpen(false);
        }
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [
    suggestionPopoverOpen,
    closeSuggestionPopover,
    isUserMenuOpen,
    setIsUserMenuOpen,
  ]);

  const handleLogout = () => {
    doLogout();
    window.location.href = "/login";
  };

  const handleCrossStagePass = useCallback((newStage: number) => {
    setStage(newStage);
    setUnlockedStage(newStage);
    // 更新本地存储中的用户信息
    const stored = localStorage.getItem("current_user");
    if (stored) {
      const userData = JSON.parse(stored);
      userData.stage = newStage;
      localStorage.setItem("current_user", JSON.stringify(userData));
      setUser(userData);
    }
  }, []);

  const generateQuestions = useCallback(
    async (
      s: number,
      plan?: unknown,
      profile?: unknown,
    ): Promise<CrossStageQuestion[]> => {
      const res = await crossStageGenerateQuestions(s, plan, profile);
      if (!res.success || !res.questions)
        throw new Error(res.message || "生成题目失败");
      return res.questions;
    },
    [],
  );

  const submitTest = useCallback(
    async (
      s: number,
      questions: CrossStageQuestion[],
      answers: Record<string, string>,
    ): Promise<{ score: number; passed: boolean }> => {
      const res = await crossStageSubmitTest(s, questions, answers);
      if (!res.success) throw new Error(res.message || "提交失败");
      return { score: res.score ?? 0, passed: res.passed ?? false };
    },
    [],
  );

  const handleSend = async (
    text: string = promptValue,
    isSuggestion: boolean = false,
  ) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    let sessionId = currentSessionId;
    if (!sessionId) {
      try {
        const res = await createSession();
        if (res.success && res.session) {
          sessionId = res.session.id;
          setCurrentSessionId(sessionId);
          setSessions((prev) => [res.session!, ...prev]);
        } else {
          alert("创建会话失败，请稍后重试");
          return;
        }
      } catch (err) {
        console.error("创建会话失败", err);
        return;
      }
    }

    // 如果是点击建议问题，则进行额外处理
    if (isSuggestion) {
      // 添加到已使用的建议
      setUsedSuggestions((prev) => [...prev, trimmed]);

      // 从当前建议中移除
      setSuggestions((prev) => prev.filter((s) => s.text !== trimmed));
    }

    const now = new Date().toISOString();
    setChatMessages((prev) => [
      ...prev,
      { role: "user", content: trimmed, createdAt: now },
    ]);
    setPromptValue("");
    setIsSending(true);

    try {
      const res = await chat({
        question: trimmed,
        sessionId: sessionId!,
        stage: stage,
        preferredStyle: assessmentResult?.profile?.preferredStyle,
        userProfile: assessmentResult?.profile,
        learningPlan: assessmentResult?.plan,
      });
      if (res.success && res.answer) {
        setChatMessages((prev) => [
          ...prev,
          {
            role: "ai",
            content: res.answer!,
            createdAt: new Date().toISOString(),
          },
        ]);

        // 如果是该会话的第一条消息（当前消息列表中只有刚刚发送的一条），刷新会话列表以更新标题
        if (chatMessages.length === 0) {
          setTimeout(async () => {
            const sessionsRes = await getSessions();
            if (sessionsRes.success && sessionsRes.sessions) {
              setSessions(sessionsRes.sessions);
            }
          }, 500); // 稍微延迟一下，确保后端已完成更新
        }
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

  const formatAIMessage = (content: string) => {
    return content.split("\n\n").map((para, i) => (
      <p key={i}>
        {para.split(/(\*\*.*?\*\*)/g).map((part, j) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={j}>{part.slice(2, -2)}</strong>;
          }
          return part;
        })}
      </p>
    ));
  };

  const coveredCount = [
    "goal",
    "background",
    "attempt",
    "stuck",
    "format",
  ].filter((k) => detectModuleCovered(promptValue, k)).length;

  const formatTime = (currentDateStr?: string, prevDateStr?: string) => {
    if (!currentDateStr) return "";
    const current = new Date(currentDateStr);
    if (isNaN(current.getTime())) return "";

    if (!prevDateStr) {
      return current.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    const prev = new Date(prevDateStr);
    if (isNaN(prev.getTime())) {
      return current.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    const diffMs = current.getTime() - prev.getTime();
    if (diffMs > 60000) {
      return current.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else {
      const seconds = Math.floor(diffMs / 1000);
      return `${seconds > 0 ? seconds : 1}秒后`;
    }
  };

  const initial = (user?.displayName || user?.username || "U")[0].toUpperCase();

  // 如果体检结果还未加载，返回加载状态
  if (
    !assessmentResult ||
    !assessmentResult.plan ||
    !assessmentResult.profile
  ) {
    return (
      <div className="app-root">
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
            fontSize: "18px",
            color: "var(--color-text-muted)",
          }}
        >
          正在加载你的学习之旅...
        </div>
      </div>
    );
  }

  return (
    <div className="app-root">
      <main
        className={`app-main ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}
      >
        <aside className={`sidebar ${isSidebarCollapsed ? "collapsed" : ""}`}>
          <div className="sidebar-top">
            <div className="sidebar-header">
              {!isSidebarCollapsed && (
                <button className="new-chat-btn" onClick={handleNewChat}>
                  <span className="plus-icon">+</span> 开启新对话
                </button>
              )}
              <button
                className="sidebar-toggle"
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                title={isSidebarCollapsed ? "展开边栏" : "折叠边栏"}
              >
                {isSidebarCollapsed ? "»" : "«"}
              </button>
            </div>

            {!isSidebarCollapsed && (
              <div className="sidebar-scrollable">
                <div className="sidebar-content">
                  <section
                    className={`card accordion-card ${activeSidebarCard === "profile" ? "active" : ""}`}
                  >
                    <div
                      className="accordion-header"
                      onClick={() => setActiveSidebarCard("profile")}
                    >
                      <h2 className="card-title">你的 AI 学习画像</h2>
                      <span className="accordion-icon">
                        {activeSidebarCard === "profile" ? "−" : "+"}
                      </span>
                    </div>
                    <div className="accordion-content">
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
                          {assessmentResult.profile?.knowledgeGaps?.map(
                            (g, i) => (
                              <li key={`gap-${i}`}>{g}</li>
                            ),
                          )}
                        </ul>
                      </div>
                    </div>
                  </section>

                  {assessmentResult.plan && (
                    <section
                      className={`card accordion-card ${activeSidebarCard === "plan" ? "active" : ""}`}
                    >
                      <div
                        className="accordion-header"
                        onClick={() => setActiveSidebarCard("plan")}
                      >
                        <h2 className="card-title">你的专属学习计划</h2>
                        <span className="accordion-icon">
                          {activeSidebarCard === "plan" ? "−" : "+"}
                        </span>
                      </div>
                      <div className="accordion-content">
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
                              {assessmentResult.plan.phases?.[stage - 1]
                                ?.title ||
                                `阶段${stage === 1 ? "一" : stage === 2 ? "二" : "三"}`}
                            </span>
                          </div>
                          <ol className="phase-list">
                            {assessmentResult.plan.phases?.map((p, i) => (
                              <li
                                key={`phase-${i}`}
                                className={`phase-item ${i === stage - 1 ? "phase-item-active" : ""}`}
                              >
                                <div className="phase-title">{p.title}</div>
                                <div className="phase-desc">
                                  {p.desc || p.description}
                                </div>
                              </li>
                            ))}
                          </ol>
                        </div>
                      </div>
                    </section>
                  )}

                  <section
                    className={`card accordion-card ${activeSidebarCard === "history" ? "active" : ""}`}
                  >
                    <div
                      className="accordion-header"
                      onClick={() => setActiveSidebarCard("history")}
                    >
                      <h2 className="card-title">历史对话记录</h2>
                      <span className="accordion-icon">
                        {activeSidebarCard === "history" ? "−" : "+"}
                      </span>
                    </div>
                    <div className="accordion-content">
                      {isSessionsLoading ? (
                        <div className="history-loading">加载中...</div>
                      ) : sessions.length === 0 ? (
                        <div className="history-empty">暂无对话记录</div>
                      ) : (
                        <div className="history-list">
                          {sessions.map((s) => (
                            <div
                              key={s.id}
                              className={`history-item ${currentSessionId === s.id ? "active" : ""}`}
                              onClick={() => handleSwitchSession(s.id)}
                            >
                              <span className="history-item-title">
                                {s.title}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            )}
          </div>

          <div className="sidebar-footer">
            {!isSidebarCollapsed && (
              <div className="journey-stage-container">
                <div className="journey-stage-pill">
                  当前阶段：
                  <span>
                    {assessmentResult.plan?.phases?.[stage - 1]?.title ??
                      `阶段${stage === 1 ? "一" : stage === 2 ? "二" : "三"}`}
                  </span>
                </div>
                <div className="stage-progress-bar">
                  <div
                    className="stage-progress-fill"
                    style={{ width: `${(stage / 3) * 100}%` }}
                  ></div>
                </div>
                <div className="stage-progress-text">
                  已完成 {Math.round((stage / 3) * 100)}%
                </div>
              </div>
            )}
            <div className="user-info" ref={userMenuRef}>
              <div className="user-avatar">
                <span>{initial}</span>
              </div>
              <div className="user-details">
                <div className="user-name">
                  {user.displayName || user.username || "用户"}
                </div>
                <div className="user-menu-wrapper">
                  <button
                    className="user-action"
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  >
                    管理账户
                  </button>
                  {isUserMenuOpen && (
                    <div className="user-dropdown-menu">
                      <div className="menu-item">账户设置</div>
                      <div
                        className="menu-item"
                        onClick={() => navigate("/learning-report")}
                      >
                        学习报告
                      </div>
                      <div className="menu-item">帮助与反馈</div>
                      <div className="menu-item logout" onClick={handleLogout}>
                        退出登录
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </aside>

        <section className="main-content">
          <section
            className={`journey-container ${chatMessages.length === 0 ? "no-chat" : ""}`}
          >
            <div className="journey-layout">
              {chatMessages.length > 0 && (
                <div className="journey-panel conversation-panel">
                  <div className="chat-window">
                    {chatMessages.map((msg, i) => (
                      <div
                        key={`msg-${i}`}
                        className={`chat-message ${msg.role === "ai" ? "ai" : "user"}`}
                      >
                        <div className={`avatar ${msg.role}`}>
                          {msg.role === "ai" ? "🤖" : "🧑"}
                        </div>
                        <div className="message-container">
                          <div className="message-header">
                            <span className="message-role">
                              {msg.role === "ai"
                                ? "AI 教练"
                                : user.displayName || user.username}
                            </span>
                            <span className="message-time">
                              {formatTime(
                                msg.createdAt,
                                chatMessages[i - 1]?.createdAt,
                              )}
                            </span>
                          </div>
                          <div className="bubble">
                            {msg.role === "ai" ? (
                              <div className="markdown-body">
                                {formatAIMessage(msg.content || "")}
                              </div>
                            ) : (
                              msg.content
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {isSending && (
                      <div className="chat-message ai">
                        <div className="avatar ai">🤖</div>
                        <div className="bubble">
                          <div className="thinking-animation">AI 正在思考</div>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                </div>
              )}

              {chatMessages.length === 0 && (
                <div className="welcome-section">
                  {/* <div className="welcome-logo">Q</div> */}
                  <h1 className="welcome-title">{greeting}</h1>
                </div>
              )}

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
                  <div
                    ref={suggestionTriggerRef}
                    className="suggestion-trigger-wrapper"
                  >
                    <button
                      type="button"
                      className={`suggestion-trigger-box ${suggestionPopoverOpen ? "suggestion-trigger-active" : ""}`}
                      onClick={() => {
                        if (!suggestionPopoverOpen) updatePopoverPosition();
                        setSuggestionPopoverOpen((v) => !v);
                      }}
                    >
                      <span className="suggestion-trigger-icon">✨</span>
                      <span>推荐问题</span>
                      {suggestions.length > 0 && (
                        <span className="suggestion-trigger-badge">
                          {suggestions.length}
                        </span>
                      )}
                    </button>
                    {suggestionPopoverOpen &&
                      createPortal(
                        <div
                          className="suggestion-popover suggestion-popover-fixed"
                          style={{
                            bottom: popoverPosition.bottom,
                            right: popoverPosition.right,
                            left: popoverPosition.left,
                          }}
                        >
                          <div className="suggestion-popover-header">
                            <span className="suggestion-popover-title">
                              AI 推荐问题
                            </span>
                          </div>
                          <div className="suggestion-popover-list">
                            {suggestions.length > 0 ? (
                              suggestions.map((item, i) => (
                                <div
                                  key={`suggest-${i}`}
                                  className="suggestion-popover-item"
                                  onClick={() => {
                                    handleSend(item.text, true);
                                    closeSuggestionPopover();
                                  }}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      handleSend(item.text, true);
                                      closeSuggestionPopover();
                                    }
                                  }}
                                >
                                  <span className="suggestion-popover-item-title">
                                    {item.title}
                                  </span>
                                  <span className="suggestion-popover-item-desc">
                                    {item.text}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <div className="suggestion-popover-empty">
                                正在加载推荐问题…
                              </div>
                            )}
                          </div>
                        </div>,
                        document.body,
                      )}
                  </div>
                  <div className="prompt-actions">
                    <button
                      className="btn primary"
                      disabled={isSending || !promptValue.trim()}
                      onClick={() => handleSend()}
                    >
                      {isSending ? "发送中..." : "提问"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </section>
      </main>

      <CrossStageTest
        currentStage={stage}
        unlockedStage={unlockedStage}
        learningPlan={assessmentResult.plan}
        userProfile={assessmentResult.profile}
        onPass={handleCrossStagePass}
        generateQuestions={generateQuestions}
        submitTest={submitTest}
      />
    </div>
  );
}
