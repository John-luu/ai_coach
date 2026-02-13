import React, { useState, useCallback } from "react";
import "./index.css";

export type CrossStageQuestion = {
  id: string;
  question: string;
  type: "short" | "choice";
  options?: string[];
};

export type CrossStageTestProps = {
  currentStage: number;
  unlockedStage: number;
  learningPlan?: unknown;
  userProfile?: unknown;
  onPass: (newStage: number) => void;
  generateQuestions: (
    stage: number,
    plan?: unknown,
    profile?: unknown,
  ) => Promise<CrossStageQuestion[]>;
  submitTest: (
    stage: number,
    questions: CrossStageQuestion[],
    answers: Record<string, string>,
  ) => Promise<{ score: number; passed: boolean }>;
};

const PASS_THRESHOLD = 85;

export default function CrossStageTest({
  currentStage,
  unlockedStage,
  learningPlan,
  userProfile,
  onPass,
  generateQuestions,
  submitTest,
}: CrossStageTestProps) {
  const [visible, setVisible] = useState(false);
  const [questions, setQuestions] = useState<CrossStageQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    passed: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nextStage = currentStage + 1;
  const canTakeTest = unlockedStage === currentStage && currentStage < 3;

  const handleOpen = useCallback(async () => {
    if (!canTakeTest) {
      if (currentStage >= 3) {
        alert("你已完成所有阶段的学习！");
      } else if (unlockedStage > currentStage) {
        alert("你已经通过了本阶段的测试。");
      }
      return;
    }
    setVisible(true);
    setQuestions([]);
    setAnswers({});
    setResult(null);
    setError(null);
    setLoading(true);
    try {
      const qs = await generateQuestions(
        currentStage,
        learningPlan,
        userProfile,
      );
      setQuestions(qs);
    } catch (e) {
      setError("加载测试题失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, [canTakeTest, currentStage, learningPlan, userProfile, generateQuestions]);

  const handleClose = useCallback(() => {
    setVisible(false);
    setResult(null);
  }, []);

  const handleAnswerChange = useCallback((id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
    const filled = questions.every((q) => (answers[q.id] || "").trim());
    if (!filled) {
      setError("请完成所有题目后再提交");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await submitTest(currentStage, questions, answers);
      setResult(res);
      if (res.passed) {
        onPass(nextStage);
      }
    } catch (e) {
      setError("提交失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }, [questions, answers, currentStage, submitTest, onPass, nextStage]);

  return (
    <>
      {/* 社区悬浮球 */}
      <a
        href="https://memos.3geyue.com"
        target="_blank"
        rel="noopener noreferrer"
        className="fab-item community-fab"
        style={{ top: "calc(50% - 140px)" }}
      >
        <span className="fab-icon">🏮</span>
        <div className="fab-tooltip">社区交流</div>
      </a>

      {/* 跨阶测试悬浮球 */}
      <div
        className={`fab-item cross-stage-fab ${!canTakeTest ? "fab-disabled" : ""}`}
        onClick={handleOpen}
        style={{ top: "calc(50% - 70px)" }}
      >
        <span className="fab-icon">🧧</span>
        <div className="fab-tooltip">
          {currentStage >= 3
            ? "学成归来"
            : unlockedStage > currentStage
              ? "挑战成功"
              : `开启 ${nextStage} 阶挑战`}
        </div>
      </div>

      {/* 沙箱悬浮球 */}
      <div
        className="fab-item sandbox-fab"
        onClick={() => window.open("/sandbox", "_blank")}
        style={{ top: "50%" }}
      >
        <span className="fab-icon">🧨</span>
        <div className="fab-tooltip">代码实验室</div>
      </div>

      {visible && (
        <div className="cross-stage-overlay" onClick={handleClose}>
          <div
            className="cross-stage-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cross-stage-modal-header">
              <h3>
                跨阶测试 · 阶段
                {currentStage === 1 ? "一" : currentStage === 2 ? "二" : "三"} →
                阶段{currentStage === 1 ? "二" : "三"}
              </h3>
              <button
                type="button"
                className="cross-stage-close"
                onClick={handleClose}
                aria-label="关闭"
              >
                ×
              </button>
            </div>
            <div className="cross-stage-modal-body">
              {loading ? (
                <div className="cross-stage-loading">正在生成测试题...</div>
              ) : result ? (
                <div
                  className={`cross-stage-result ${result.passed ? "passed" : "failed"}`}
                >
                  <div className="cross-stage-score">
                    得分：<strong>{result.score}</strong> 分
                  </div>
                  <div className="cross-stage-message">
                    {result.passed
                      ? `恭喜！你已通过跨阶测试，可以进入阶段${currentStage === 1 ? "二" : "三"}的学习了。`
                      : `很遗憾，未达到 ${PASS_THRESHOLD} 分。继续加油，掌握本阶段内容后再来挑战吧！`}
                  </div>
                </div>
              ) : (
                <>
                  <p className="cross-stage-desc">
                    根据你当前阶段的学习内容，完成以下测试。得分 ≥{" "}
                    {PASS_THRESHOLD} 分即可进入下一阶段。
                  </p>
                  {error && <div className="cross-stage-error">{error}</div>}
                  <div className="cross-stage-questions">
                    {questions.map((q, i) => (
                      <div key={q.id} className="cross-stage-question">
                        <label>
                          {i + 1}. {q.question}
                        </label>
                        {q.type === "choice" && q.options ? (
                          <div className="cross-stage-options">
                            {q.options.map((opt, j) => (
                              <label key={j} className="cross-stage-option">
                                <input
                                  type="radio"
                                  name={q.id}
                                  value={opt}
                                  checked={answers[q.id] === opt}
                                  onChange={() => handleAnswerChange(q.id, opt)}
                                />
                                {opt}
                              </label>
                            ))}
                          </div>
                        ) : (
                          <textarea
                            className="input textarea cross-stage-answer"
                            placeholder="请输入你的答案"
                            value={answers[q.id] || ""}
                            onChange={(e) =>
                              handleAnswerChange(q.id, e.target.value)
                            }
                            rows={3}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            {!loading && !result && questions.length > 0 && (
              <div className="cross-stage-modal-footer">
                <button
                  type="button"
                  className="btn primary"
                  disabled={submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? "评卷中..." : "提交测试"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
