import React, { useState } from "react";
import "./index.css";
import { login as apiLogin, register as apiRegister } from "../../services/api";
import { saveAuth } from "../../modules/auth";

export default function LoginPage(): React.JSX.Element {
  const [isRegister, setIsRegister] = useState<boolean>(false);
  const [form, setForm] = useState<{
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
  }>({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setForm((f) => ({ ...f, [id]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      if (isRegister) {
        if (
          !form.username ||
          !form.email ||
          !form.password ||
          !form.confirmPassword
        ) {
          setError("请填写所有字段");
          return;
        }
        if (form.password !== form.confirmPassword) {
          setError("两次输入的密码不一致");
          return;
        }
        const data = await apiRegister(
          form.username,
          form.email,
          form.password,
        );
        if (data.success) {
          if (data.token && data.user) {
            saveAuth(data.token, data.user);
            setSuccess("注册成功！正在进入系统...");
            setTimeout(() => (window.location.href = "/"), 1000);
          } else {
            setSuccess("注册成功！正在跳转到登录页...");
            setTimeout(() => setIsRegister(false), 1500);
          }
        } else {
          setError(data.message || "注册失败");
        }
      } else {
        if (!form.username || !form.password) {
          setError("请填写用户名和密码");
          return;
        }
        const data = await apiLogin(form.username, form.password);
        if (data.success) {
          if (data.token && data.user) {
            saveAuth(data.token, data.user);
          }
          window.location.href = "/";
        } else {
          setError(data.message || "登录失败");
        }
      }
    } catch (err) {
      setError("网络错误，请稍后重试");
      console.error(err);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <header className="app-header">
        <div className="logo-area">
          <div className="logo-mark">Q</div>
          <div className="logo-text">
            <div className="logo-title">AI 提问教练</div>
            <div className="logo-subtitle">让 AI 成为你的学习搭档</div>
          </div>
        </div>
      </header>
      <div className="login-container">
        <div className="login-illustration">
          <div className="illustration-content">
            <h2>阳光企业级学习体验</h2>
            <p>以专业、明快的设计语言，助力你的持续成长。</p>
            <br />
            <p>✨ 个性化学习路径</p>
            <p>🎯 实时学习反馈</p>
            <p>📈 进度追踪与优化</p>
          </div>
        </div>
        <div className="login-form-wrapper">
          <div className="login-form-header" id="form-header">
            <h1>{isRegister ? "创建账户" : "登录账户"}</h1>
            <p>
              {isRegister ? "开启你的智慧学习之旅" : "开启你的专属学习之旅"}
            </p>
          </div>
          {error && <div className="alert alert-error show">{error}</div>}
          {success && <div className="alert alert-success show">{success}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="username">
                用户名
              </label>
              <input
                type="text"
                id="username"
                className="form-input"
                placeholder="请输入用户名"
                value={form.username}
                onChange={onChange}
                required
              />
            </div>
            {isRegister && (
              <>
                <div className="form-group">
                  <label className="form-label" htmlFor="email">
                    邮箱
                  </label>
                  <input
                    type="email"
                    id="email"
                    className="form-input"
                    placeholder="请输入邮箱"
                    value={form.email}
                    onChange={onChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="display-name">
                    昵称
                  </label>
                  <input
                    type="text"
                    id="display-name"
                    className="form-input"
                    placeholder="请输入昵称（可选）"
                    onChange={() => {}}
                  />
                </div>
              </>
            )}
            <div className="form-group">
              <label className="form-label" htmlFor="password">
                密码
              </label>
              <input
                type="password"
                id="password"
                className="form-input"
                placeholder="请输入密码"
                value={form.password}
                onChange={onChange}
                required
              />
            </div>
            {isRegister && (
              <div className="form-group">
                <label className="form-label" htmlFor="confirmPassword">
                  确认密码
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  className="form-input"
                  placeholder="请再次输入密码"
                  value={form.confirmPassword}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, confirmPassword: e.target.value }))
                  }
                  required
                />
              </div>
            )}
            {!isRegister && (
              <div className="form-options" id="login-options">
                <label className="remember-me">
                  <input type="checkbox" id="remember" />
                  <span>记住我</span>
                </label>
                <a href="#" className="forgot-password">
                  忘记密码？
                </a>
              </div>
            )}
            <button type="submit" className="btn btn-primary">
              {isRegister ? "注册" : "登录"}
            </button>
            {isRegister ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsRegister(false)}
              >
                返回登录
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsRegister(true)}
              >
                注册新账号
              </button>
            )}
            <div className="login-footer" id="login-footer">
              {isRegister ? (
                <>
                  已有账号？
                  <a
                    href="#"
                    className="register-link"
                    onClick={() => setIsRegister(false)}
                  >
                    返回登录
                  </a>
                </>
              ) : (
                <>
                  还没有账号？
                  <a
                    href="#"
                    className="register-link"
                    onClick={() => setIsRegister(true)}
                  >
                    立即注册
                  </a>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
