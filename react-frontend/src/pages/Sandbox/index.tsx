import React, { useState } from "react";
import "./index.css";

const LANGUAGES = [
  { id: "python", name: "Python", icon: "🐍", defaultCode: 'print("Hello, World!")' },
  { id: "javascript", name: "JavaScript", icon: "js", defaultCode: 'console.log("Hello, World!");' },
  { id: "go", name: "Go", icon: "🐹", defaultCode: 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}' },
  { id: "cpp", name: "C++", icon: "C++", defaultCode: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}' },
];

export default function SandboxPage() {
  const [lang, setLang] = useState(LANGUAGES[0]);
  const [code, setCode] = useState(lang.defaultCode);
  const [output, setOutput] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const handleRun = () => {
    setIsRunning(true);
    setOutput("正在运行...\n");
    
    // 模拟运行效果
    setTimeout(() => {
      setOutput(`[${lang.name} 运行结果]\nHello, World!\n\n(提示：这是一个模拟沙箱，实际后端执行功能正在开发中)`);
      setIsRunning(false);
    }, 1000);
  };

  const handleLangChange = (newLang: typeof LANGUAGES[0]) => {
    setLang(newLang);
    setCode(newLang.defaultCode);
    setOutput("");
  };

  return (
    <div className="sandbox-container">
      <header className="sandbox-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => window.history.back()}>← 返回</button>
          <h1>代码沙箱</h1>
        </div>
        <div className="lang-selector">
          {LANGUAGES.map((l) => (
            <button
              key={l.id}
              className={`lang-btn ${lang.id === l.id ? "active" : ""}`}
              onClick={() => handleLangChange(l)}
            >
              <span className="lang-icon">{l.icon}</span>
              {l.name}
            </button>
          ))}
        </div>
        <button 
          className={`run-btn ${isRunning ? "running" : ""}`} 
          onClick={handleRun}
          disabled={isRunning}
        >
          {isRunning ? "运行中..." : "▶ 运行代码"}
        </button>
      </header>

      <main className="sandbox-main">
        <div className="editor-section">
          <div className="section-label">代码编辑器</div>
          <textarea
            className="code-editor"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
          />
        </div>
        <div className="output-section">
          <div className="section-label">运行输出</div>
          <pre className="output-console">
            {output || "等待代码运行..."}
          </pre>
        </div>
      </main>
    </div>
  );
}
