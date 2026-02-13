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
    <div className="login-page-wrapper">
      <div className="login-content">
        <div className="login-logo-section">
          <div className="login-logo-mark">🧧</div>
          <h1 className="login-logo-text">AI 提问教练</h1>
        </div>

        <div className="login-card">
          {error && <div className="alert alert-error show">{error}</div>}
          {success && <div className="alert alert-success show">{success}</div>}
          
          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
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
              <div className="form-group">
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
            )}

            <div className="form-group">
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

            <button type="submit" className="btn btn-primary login-btn">
              {isRegister ? "立即注册" : "登录"}
            </button>
          </form>

          <div className="login-footer">
            {isRegister ? (
              <p>
                已有账号？ <span className="link-text" onClick={() => setIsRegister(false)}>立即登录</span>
              </p>
            ) : (
              <p>
                没有账号？ <span className="link-text" onClick={() => setIsRegister(true)}>立即注册</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
