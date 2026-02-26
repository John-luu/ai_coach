import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getActivityDates } from "../../services/api";
import "./index.css";

const LearningReport: React.FC = () => {
  const navigate = useNavigate();
  const [activeDates, setActiveDates] = useState<string[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "year">("month");

  useEffect(() => {
    const fetchDates = async () => {
      const res = await getActivityDates();
      if (res.success && res.dates) {
        const normalized = res.dates
          .map((d) => (d.length >= 10 ? d.slice(0, 10) : d))
          .map((d) => {
            const [y, m, day] = d.split(/[-/]/);
            const yy = y?.padStart(4, "0") || "";
            const mm = (m || "").padStart(2, "0");
            const dd = (day || "").padStart(2, "0");
            if (yy && mm && dd) return `${yy}-${mm}-${dd}`;
            return d;
          });
        setActiveDates(normalized);
      }
    };
    fetchDates();
  }, []);

  const activeSet = useMemo(() => new Set(activeDates), [activeDates]);

  const daysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const firstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const renderMonthCalendar = (
    year: number,
    month: number,
    showHeader = true,
  ) => {
    const totalDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);
    const days = [];

    // Empty cells
    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    // Days of the month
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
        day,
      ).padStart(2, "0")}`;
      const isActive = activeSet.has(dateStr);
      const isToday = new Date().toISOString().split("T")[0] === dateStr;

      days.push(
        <div
          key={day}
          className={`calendar-day ${isActive ? "active" : ""} ${
            isToday ? "today" : ""
          }`}
        >
          {day}
        </div>,
      );
    }

    return (
      <div className={`month-view ${!showHeader ? "mini" : ""}`}>
        {showHeader && (
          <div className="calendar-grid-header">
            <div>日</div>
            <div>一</div>
            <div>二</div>
            <div>三</div>
            <div>四</div>
            <div>五</div>
            <div>六</div>
          </div>
        )}
        <div className="calendar-grid">{days}</div>
      </div>
    );
  };

  const renderYearView = () => {
    const year = currentDate.getFullYear();
    const months = [];
    for (let m = 0; m < 12; m++) {
      months.push(
        <div key={m} className="year-month-card">
          <h3>{m + 1}月</h3>
          <div className="mini-calendar-header">
            <div>日</div>
            <div>一</div>
            <div>二</div>
            <div>三</div>
            <div>四</div>
            <div>五</div>
            <div>六</div>
          </div>
          {renderMonthCalendar(year, m, false)}
        </div>,
      );
    }
    return <div className="year-grid">{months}</div>;
  };

  const next = () => {
    if (viewMode === "month") {
      setCurrentDate(
        new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1),
      );
    } else {
      setCurrentDate(new Date(currentDate.getFullYear() + 1, 0, 1));
    }
  };

  const prev = () => {
    if (viewMode === "month") {
      setCurrentDate(
        new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1),
      );
    } else {
      setCurrentDate(new Date(currentDate.getFullYear() - 1, 0, 1));
    }
  };

  return (
    <div className="report-container">
      <div className="report-header">
        <button className="back-btn" onClick={() => navigate("/journey")}>
          <span className="back-icon">←</span> 返回学习
        </button>
        <div className="header-title-group">
          <h1>学习报告</h1>
          <div className="view-toggle">
            <button
              className={viewMode === "month" ? "active" : ""}
              onClick={() => setViewMode("month")}
            >
              月度
            </button>
            <button
              className={viewMode === "year" ? "active" : ""}
              onClick={() => setViewMode("year")}
            >
              年度
            </button>
          </div>
        </div>
      </div>

      <div className="report-content">
        <div className="calendar-card main-card">
          <div className="calendar-nav-header">
            <button className="nav-btn" onClick={prev}>
              &lt;
            </button>
            <h2 className="current-date-display">
              {currentDate.getFullYear()}年{" "}
              {viewMode === "month" ? `${currentDate.getMonth() + 1}月` : ""}
            </h2>
            <button className="nav-btn" onClick={next}>
              &gt;
            </button>
          </div>

          {viewMode === "month"
            ? renderMonthCalendar(
                currentDate.getFullYear(),
                currentDate.getMonth(),
              )
            : renderYearView()}

          <div className="calendar-footer">
            <div className="legend-item">
              <span className="dot active"></span>
              <span>有 AI 对话记录</span>
            </div>
            <div className="legend-item">
              <span className="dot today-border"></span>
              <span>今日</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LearningReport;
