import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./index.css";
import { evaluateAssessment, AssessmentResult } from "../../services/api";
import { logout as doLogout } from "../../modules/auth";

export default function IndexPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ username?: string; displayName?: string }>(
    { username: "用户" },
  );

  const [currentStep, setCurrentStep] = useState(1);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // 表单状态
  const [answers, setAnswers] = useState({
    wantToDo: "",
    goal: "",
    currentLevel: "",
    preferredStyle: "",
    dailyTime: "",
  });

  useEffect(() => {
    const stored = localStorage.getItem("current_user");
    if (stored) {
      try {
        const userData = JSON.parse(stored);
        setUser(userData);

        // 如果后端返回已做过体检，则跳转
        if (userData.hasAssessment === 1) {
          navigate("/journey");
          return;
        }
      } catch {
        setUser({ username: "用户" });
      }
    }
  }, []);

  const handleLogout = () => {
    doLogout();
    window.location.href = "/login";
  };

  const handleNextStep = async () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    } else {
      // 提交评估
      if (!answers.wantToDo) {
        alert("请先填写：你现在最想用 AI 帮你学什么？");
        setCurrentStep(1);
        return;
      }
      if (!answers.goal) {
        alert("请先选择：当前阶段你的核心学习目标处理。");
        setCurrentStep(2);
        return;
      }

      setIsEvaluating(true);
      try {
        const res = await evaluateAssessment(answers);
        localStorage.setItem("assessment_result", JSON.stringify(res));

        // 更新本地用户状态为已体检
        const stored = localStorage.getItem("current_user");
        if (stored) {
          const userData = JSON.parse(stored);
          userData.hasAssessment = 1;
          localStorage.setItem("current_user", JSON.stringify(userData));
        }

        navigate("/journey");
      } catch (err) {
        console.error(err);
        alert("生成学习画像失败，请稍后重试。");
      } finally {
        setIsEvaluating(false);
      }
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const initial = (user?.displayName || user?.username || "U")[0].toUpperCase();

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

      <main className="app-main" style={{ gridTemplateColumns: "1fr" }}>
        <section
          className="main-content"
          style={{ maxWidth: "800px", margin: "0 auto", width: "100%" }}
        >
          <section className="card" id="assessment-card">
            <div className="assessment-header">
              <h2 className="card-title">学习能力体检（Demo）</h2>
              <div className="assessment-progress">
                <div className="progress-track small">
                  <div
                    className="progress-bar"
                    style={{ width: `${(currentStep / 5) * 100}%` }}
                  ></div>
                </div>
                <span className="progress-label">第 {currentStep} / 5 题</span>
              </div>
            </div>

            <div className="assessment-body">
              {currentStep === 1 && (
                <div className="assessment-step active">
                  <div className="step-label">问题 1 / 5</div>
                  <h3 className="step-title">你现在最想用 AI 帮你学什么？</h3>
                  <p className="step-desc">
                    比如「Python
                    基础」「算法刷题」「写毕业设计」「做数据分析」等等。
                  </p>
                  <textarea
                    className="input textarea"
                    rows={3}
                    placeholder="示例：我想系统学 Python，用来做数据分析和自动化脚本。"
                    value={answers.wantToDo}
                    onChange={(e) =>
                      setAnswers({ ...answers, wantToDo: e.target.value })
                    }
                  ></textarea>
                </div>
              )}

              {currentStep === 2 && (
                <div className="assessment-step active">
                  <div className="step-label">问题 2 / 5</div>
                  <h3 className="step-title">
                    当前阶段你的核心学习目标是什么？
                  </h3>
                  <div className="option-group">
                    {[
                      "转行 / 找工作",
                      "完成项目 / 课程作业",
                      "补基础 / 理清知识体系",
                      "兴趣学习 / 拓展视野",
                    ].map((opt) => (
                      <button
                        key={opt}
                        className={`chip ${answers.goal === opt ? "chip-selected" : ""}`}
                        onClick={() => setAnswers({ ...answers, goal: opt })}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="assessment-step active">
                  <div className="step-label">问题 3 / 5</div>
                  <h3 className="step-title">
                    你对 它 的掌握程度，更接近哪一种？
                  </h3>
                  <div className="option-group">
                    {[
                      "从零开始",
                      "学过一点，能看懂基础示例",
                      "能完成小作业，遇到较难问题无法解决",
                      "能够完成较难问题",
                    ].map((opt) => (
                      <button
                        key={opt}
                        className={`chip ${answers.currentLevel === opt ? "chip-selected" : ""}`}
                        onClick={() =>
                          setAnswers({ ...answers, currentLevel: opt })
                        }
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div className="assessment-step active">
                  <div className="step-label">问题 4 / 5</div>
                  <h3 className="step-title">你更喜欢 AI 如何帮你学习？</h3>
                  <div className="option-group">
                    {[
                      "像老师一样一步步引导我，帮我拆解任务",
                      "直接给我答案和代码模板",
                      "先自己尝试，遇到卡点再让 AI 帮我",
                      "希望 AI 像教练一样提问，逼我多思考",
                    ].map((opt) => (
                      <button
                        key={opt}
                        className={`chip ${answers.preferredStyle === opt ? "chip-selected" : ""}`}
                        onClick={() =>
                          setAnswers({ ...answers, preferredStyle: opt })
                        }
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {currentStep === 5 && (
                <div className="assessment-step active">
                  <div className="step-label">问题 5 / 5</div>
                  <h3 className="step-title">
                    你计划中，每天能拿出多久用于专注学习？
                  </h3>
                  <div className="input-with-unit">
                    <input
                      className="input"
                      type="number"
                      placeholder="例如：60"
                      value={answers.dailyTime}
                      onChange={(e) =>
                        setAnswers({ ...answers, dailyTime: e.target.value })
                      }
                    />
                    <span className="unit-label">分钟</span>
                  </div>
                </div>
              )}
            </div>

            <div className="assessment-actions">
              <button
                className="btn btn-secondary"
                onClick={handlePrevStep}
                disabled={currentStep === 1 || isEvaluating}
              >
                上一步
              </button>
              <button
                className="btn btn-primary"
                onClick={handleNextStep}
                disabled={isEvaluating}
              >
                {isEvaluating
                  ? "正在生成画像..."
                  : currentStep === 5
                    ? "开启学习之旅"
                    : "下一步"}
              </button>
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
