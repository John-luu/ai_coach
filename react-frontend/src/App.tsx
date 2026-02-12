import React, { useEffect } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import IndexPage from "./pages/Index";
import LoginPage from "./pages/Login";
import JourneyPage from "./pages/Journey";

export default function App(): React.JSX.Element {
  const navigate = useNavigate();
  const location = useLocation(); // ✅ 获取当前路径

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    const publicPaths = ["/login"];

    if (!token && !publicPaths.includes(location.pathname)) {
      navigate("/login");
    }

    // 如果已登录且访问登录页，跳转到首页
    // if (token && location.pathname === "/login") {
    //   navigate("/");
    // }
  }, [location.pathname]); // ✅ 依赖路径变化

  return (
    <Routes>
      <Route path="/" element={<IndexPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/journey" element={<JourneyPage />} />
    </Routes>
  );
}
