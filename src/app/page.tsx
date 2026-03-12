"use client";

import { useEffect } from "react";
import "./globals.css";
// 我们将旧版的 app.js 核心逻辑提取到独立文件中，在挂载后执行以保护原有零损耗操作体验
import initPosterApp from "./lib/appLogic";

export default function Home() {
  useEffect(() => {
    // 强制挂载 html2canvas
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
    script.async = true;
    script.onload = () => {
      initPosterApp();
    };
    document.body.appendChild(script);

    // 初始化时，给 body 加上 edit-mode 类，确保编辑栏和悬浮按钮可见
    document.body.classList.add("edit-mode");

    return () => {
      // 这里的清理工作可以简化，刷新页面即重置
    };
  }, []);

  return (
    <>
      {/* 顶部控制栏 */}
      <div className="ctrl-bar">
        <button className="sidebar-toggle" id="sidebarToggle" title="元素面板">☰</button>
        <button className="ctrl-btn primary" id="editToggleBtn">✏️ 编辑模式：开</button>
        <button className="ctrl-btn generate" id="openGeneratorBtn">✨ AI 排版</button>
        <button className="ctrl-btn" id="openThemeBtn" style={{ background: "var(--accent)", color: "black" }}>🎨 配色主题</button>
        <button className="ctrl-btn download" id="downloadAllBtn">📥 下载全部海报</button>
        <span className="ctrl-spacer"></span>
        <span className="ctrl-hint">点选拖动 · 双击改字 · 选元素改配色</span>
      </div>

      {/* 下载进度弹窗 */}
      <div className="download-progress" id="downloadProgress">
        <span id="downloadText">正在生成海报图片...</span>
        <div className="download-progress-bar">
          <div className="download-progress-fill" id="downloadFill"></div>
        </div>
      </div>

      {/* 主题配色弹窗 (Sidebar) */}
      <div className="theme-sidebar" id="themeSidebar">
        <div className="ts-header">
          <span>🎨 配色方案</span>
          <button className="ts-close" id="closeThemeBtn">×</button>
        </div>
        <div className="ts-body" id="themeSwatches"></div>
        <div className="ts-footer">
          <button className="ts-btn" id="applyThemeAllBtn">✨ 应用到所有画板</button>
        </div>
      </div>

      {/* 全屏排版弹窗 */}
      <div id="generatorModal" className="modal">
        <div className="modal-content">
          <div className="modal-header">
            <h2>✨ 自动分页与排版</h2>
            <button className="close-modal" id="closeGenBtn">×</button>
          </div>
          <div className="modal-body">
            {/* 注意：移除硬编码的 API KEY，提示用户在环境变量设置 */}
            <div className="form-group" style={{ display: 'none' }}>
              <label>API Key 已移至后端保护</label>
              <input type="password" id="iptApiKey" defaultValue="env-protected" />
            </div>
            <div className="form-group" style={{ display: 'none' }}>
              <label>Model Endpoint</label>
              <input type="text" id="iptModel" defaultValue="env-protected" />
            </div>

            <div className="form-group">
              <label>您的创作内容（AI自动总结、分页结构化并匹配配色）：</label>
              <textarea id="iptText" rows={10} placeholder="请将您的文章内容粘贴在这里..."></textarea>
            </div>
            <div className="form-group">
              <label>风格与配色要求 (选填)：</label>
              <input type="text" id="iptStyle" placeholder="例如：暗黑科幻风的蓝紫色调、喜庆的红色系..." />
            </div>
            <div className="form-group">
              <label>底部账号名称：</label>
              <input type="text" id="iptAuthor" defaultValue="作者：您的名字" />
            </div>
          </div>
          <div className="modal-footer">
            <button className="ctrl-btn primary" id="btnGenerateNow" style={{ width: "100%", fontSize: "16px", padding: "12px" }}>✅ 一键生成多页海报</button>
          </div>
        </div>
      </div>

      {/* AI 流式思考独立弹窗 */}
      <div id="streamModal" className="modal">
        <div className="modal-content" style={{ maxWidth: "800px", background: "rgba(17,16,32,0.98)", border: "1px solid #7f73ce", boxShadow: "0 0 40px rgba(127,115,206,0.3)" }}>
          <div className="modal-header" style={{ borderBottom: "1px solid rgba(127,115,206,0.2)" }}>
            <h2 style={{ color: "#c0b9e5" }}>⏳ AI 正在规划版式与色彩...</h2>
          </div>
          <div className="modal-body" style={{ padding: "20px" }}>
            <div id="aiStreamOutput" style={{ background: "rgba(0,0,0,0.5)", padding: "16px", borderRadius: "8px", fontFamily: "'Courier New', monospace", fontSize: "13px", color: "#a3eccb", height: "360px", overflowY: "auto", whiteSpace: "pre-wrap", lineHeight: 1.5, border: "1px solid rgba(255,255,255,0.05)" }}></div>
          </div>
        </div>
      </div>

      {/* 对齐参考线 */}
      <div id="guide-x" className="align-guide guide-x"></div>
      <div id="guide-y" className="align-guide guide-y"></div>

      <div className="main-layout">
        {/* 左侧元素面板 */}
        <aside className="elem-sidebar" id="elemSidebar">
          <div className="sidebar-title">🧩 元素库</div>

          <div className="sidebar-category">文字元素</div>
          <div className="elem-item" data-elem-type="display-title" draggable="true">
            <div className="elem-item-icon">🔤</div>
            <div className="elem-item-info">
              <div className="elem-item-name">大标题</div>
              <div className="elem-item-desc">超大号展示标题</div>
            </div>
          </div>
          <div className="elem-item" data-elem-type="h1-title" draggable="true">
            <div className="elem-item-icon">📝</div>
            <div className="elem-item-info">
              <div className="elem-item-name">小标题</div>
              <div className="elem-item-desc">带装饰线的标题</div>
            </div>
          </div>
          <div className="elem-item" data-elem-type="body-text" draggable="true">
            <div className="elem-item-icon">📄</div>
            <div className="elem-item-info">
              <div className="elem-item-name">正文段落</div>
              <div className="elem-item-desc">标准正文文字</div>
            </div>
          </div>

          <div className="sidebar-category">布局组件</div>
          <div className="elem-item" data-elem-type="list-group" draggable="true">
            <div className="elem-item-icon">📋</div>
            <div className="elem-item-info">
              <div className="elem-item-name">列表组</div>
              <div className="elem-item-desc">编号列表 ×3</div>
            </div>
          </div>
          <div className="elem-item" data-elem-type="quote-block" draggable="true">
            <div className="elem-item-icon">💬</div>
            <div className="elem-item-info">
              <div className="elem-item-name">引用块</div>
              <div className="elem-item-desc">金句引用样式</div>
            </div>
          </div>
          <div className="elem-item" data-elem-type="data-block" draggable="true">
            <div className="elem-item-icon">📊</div>
            <div className="elem-item-info">
              <div className="elem-item-name">数据展示</div>
              <div className="elem-item-desc">大数字 + 说明</div>
            </div>
          </div>
          <div className="elem-item" data-elem-type="tip-block" draggable="true">
            <div className="elem-item-icon">💡</div>
            <div className="elem-item-info">
              <div className="elem-item-name">提示块</div>
              <div className="elem-item-desc">高亮提示区域</div>
            </div>
          </div>
          <div className="elem-item" data-elem-type="story-block" draggable="true">
            <div className="elem-item-icon">📖</div>
            <div className="elem-item-info">
              <div className="elem-item-name">故事段落</div>
              <div className="elem-item-desc">带侧边线段落</div>
            </div>
          </div>

          <div className="sidebar-category">装饰元素</div>
          <div className="elem-item" data-elem-type="deco-line" draggable="true">
            <div className="elem-item-icon">➖</div>
            <div className="elem-item-info">
              <div className="elem-item-name">装饰线</div>
              <div className="elem-item-desc">强调色短线</div>
            </div>
          </div>
          <div className="elem-item" data-elem-type="deco-dots" draggable="true">
            <div className="elem-item-icon">⋯</div>
            <div className="elem-item-info">
              <div className="elem-item-name">三点装饰</div>
              <div className="elem-item-desc">三个小圆点</div>
            </div>
          </div>
          <div className="elem-item" data-elem-type="badge" draggable="true">
            <div className="elem-item-icon">🏷️</div>
            <div className="elem-item-info">
              <div className="elem-item-name">徽章</div>
              <div className="elem-item-desc">半透明标签</div>
            </div>
          </div>
          <div className="elem-item" data-elem-type="divider" draggable="true">
            <div className="elem-item-icon">〰️</div>
            <div className="elem-item-info">
              <div className="elem-item-name">分割线</div>
              <div className="elem-item-desc">全宽分隔线</div>
            </div>
          </div>
          <div className="elem-item" data-elem-type="tag" draggable="true">
            <div className="elem-item-icon">#️⃣</div>
            <div className="elem-item-info">
              <div className="elem-item-name">标签</div>
              <div className="elem-item-desc">彩色小标签</div>
            </div>
          </div>
        </aside>

        {/* 右侧：海报画布区域 */}
        <div className="canvas-area" id="canvasArea"></div>
      </div>

      {/* 撤销 Toast */}
      <div id="undo-toast"><span id="undo-msg">已删除元素</span><button className="undo-action" id="undo-btn">撤销</button></div>
    </>
  );
}
