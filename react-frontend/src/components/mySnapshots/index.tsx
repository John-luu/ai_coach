import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getSnapshots, deleteSnapshot, Snapshot } from "../../services/api";
import "./index.css";

const MySnapshotsPage: React.FC = () => {
  const navigate = useNavigate();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    fetchSnapshots();
  }, []);

  const fetchSnapshots = async () => {
    setLoading(true);
    try {
      const res = await getSnapshots();
      if (res.success && res.snapshots) {
        setSnapshots(res.snapshots);
      }
    } catch (err) {
      console.error("获取快照失败", err);
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = (id: number) => {
    setConfirmDeleteId(id);
  };

  const cancelDelete = () => {
    setConfirmDeleteId(null);
  };

  const handleDelete = async () => {
    if (confirmDeleteId === null) return;
    const id = confirmDeleteId;
    setDeletingId(id);
    setConfirmDeleteId(null);

    try {
      const res = await deleteSnapshot(id);
      if (res.success) {
        setSnapshots((prev) => prev.filter((s) => s.id !== id));
      } else {
        console.error("删除失败：" + res.message);
      }
    } catch (err) {
      console.error("删除失败", err);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(
      d.getMinutes(),
    ).padStart(2, "0")}`;
  };

  return (
    <div className="snapshots-page">
      <header className="snapshots-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate("/journey")}>
            ← 返回学习
          </button>
        </div>
        <div className="header-center">
          <h1>📸 我的快照</h1>
          <div className="header-tip">在这里查看你存下的每一份灵感</div>
        </div>
        <div className="header-right"></div>
      </header>

      <main className="snapshots-content">
        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>加载灵感中...</p>
          </div>
        ) : snapshots.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📂</div>
            <p>还没有存下任何快照哦</p>
            <button
              className="go-back-btn"
              onClick={() => navigate("/journey")}
            >
              去对话中存一个
            </button>
          </div>
        ) : (
          <div className="snapshots-grid">
            {snapshots.map((s) => (
              <div key={s.id} className="snapshot-card">
                <div className="snapshot-card-header">
                  <span className={`role-badge ${s.role}`}>
                    {s.role === "ai" ? "🤖 AI 教练" : "🧑 我"}
                  </span>
                  <span className="snapshot-time">
                    {formatDate(s.createdAt)}
                  </span>
                </div>
                <div className="snapshot-card-body">
                  <div className="content-wrapper">{s.content}</div>
                </div>
                <div className="snapshot-card-footer">
                  <button
                    className={`delete-snapshot-btn ${deletingId === s.id ? "deleting" : ""}`}
                    onClick={() => confirmDelete(s.id)}
                    disabled={deletingId === s.id}
                  >
                    {deletingId === s.id ? "正在删除..." : "删除"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 高级确认对话框 */}
      {confirmDeleteId !== null && (
        <div className="modal-overlay" onClick={cancelDelete}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-icon">⚠️</span>
              <h3>确认删除</h3>
            </div>
            <p>确定要删除这条快照吗？删除后将无法找回。</p>
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={cancelDelete}>
                取消
              </button>
              <button className="modal-btn confirm" onClick={handleDelete}>
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MySnapshotsPage;
