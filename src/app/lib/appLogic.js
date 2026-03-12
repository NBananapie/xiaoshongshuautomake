import { jsonrepair } from 'jsonrepair';

export default function initPosterApp() {
  if (window.__posterAppInit) return;
  window.__posterAppInit = true;
  /* ══════════════════════════════════════════════════════
     全局状态与配置
  ══════════════════════════════════════════════════════ */
  let isEditMode = true;
  let focusedEl = null;
  let savedContent = '';
  let deletedEl = null;
  let deletedParent = null;
  let deletedBefore = null;
  let undoTimer = null;
  let elemIdCounter = 1000;

  const MAX_CHARS_PER_PAGE = 180; // 大致每页正文字数上限

  /* =======================================================
     1. 控制面板 & 弹窗逻辑
  ======================================================= */
  const editToggleBtn = document.getElementById('editToggleBtn');
  editToggleBtn.addEventListener('click', () => {
    isEditMode = !isEditMode;
    document.body.classList.toggle('edit-mode', isEditMode);
    editToggleBtn.textContent = isEditMode ? '✏️ 编辑模式：开' : '👁️ 预览模式';
    if (focusedEl) focusedEl.blur();
    document.querySelectorAll('.edit-bar.on').forEach(b => b.classList.remove('on'));
  });

  document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('elemSidebar').classList.toggle('open');
  });

  const modal = document.getElementById('generatorModal');
  document.getElementById('openGeneratorBtn').addEventListener('click', () => {
    modal.classList.add('show');
  });
  document.getElementById('closeGenBtn').addEventListener('click', () => {
    modal.classList.remove('show');
  });

  /* =======================================================
     2. 核心分页排版引擎 (AI 逻辑本地化)
  ======================================================= */
  // AI prompt constant
  const AI_PROMPT = `你是一个专业的小红书海报排版与色彩设计师。
请根据用户的长文本，将其总结提取，设计成一份多页轮播海报。
你需要：
1. 提炼出吸引人的封面主标题（headline）和副标题（sub）。
2. 将正文切分成多页（pages），每页不宜过多文字。对于每页的 elements，按排版类型分类（目前支持：h2, body, alert, quote, data, list）。
3. 结尾页提供诱导互动的话语（cta）。
4. 最重要的是，为你生成的这套海报设计一个视觉主题色（纯色色值或者渐变色 linear-gradient / radial-gradient），放在 bgTheme 字段中。封面、各内容页、尾页可以有相呼应但不完全一样的 bgTheme。

请务必输出极其标准的 JSON 格式：
- 必须且只能是 JSON Object (大括号开头和结尾)
- 不要包含额外的 markdown 包裹（不需要 \`\`\`json 等）
- 所有的字符串值必须严格被英文双引号包裹 (如果内容中需要包含引号，请使用中文引号以避免解析错误)
- 【极其重要】绝对不要在字符串内部直接按回车换行！所有的换行必须写成 \\n 转义符。如果做不到，请删掉所有换行。
- 保证正文中的特殊字符正确转义，防止解析错误
- 【重要排版建议】根据用户提供文本的长短智能决定 page 的数量。如果文本很短（少于100字），1张甚至不需要内容页直接用封面和尾页即可。只有文字很多时，才按逻辑切分多页。永远不要为了切分而切分！
格式示例如下：
{
  "cover": {
    "headline": "主标题",
    "sub": "副标题",
    "bgTheme": "radial-gradient(ellipse at 50% 50%, #fff 0%, #f0f0f0 100%)"
  },
  "pages": [
    {
      "bgTheme": "linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)",
      "elements": [
        { "type": "h2", "content": "小标题" },
        { "type": "body", "content": "正文段落" },
        { "type": "list", "items": [{"title":"一","desc":"细节"},{"title":"二","desc":"细节"}] },
        { "type": "quote", "content": "金句", "author": "某人" },
        { "type": "data", "num": "99%", "label": "数据说明" }
      ]
    }
  ],
  "ending": {
    "cta": "喜欢就点赞收藏吧！",
    "bgTheme": "#cfdef3"
  }
}`;

  document.getElementById('btnGenerateNow').addEventListener('click', async () => {
    const apiKey = document.getElementById('iptApiKey').value.trim();
    const modelEp = document.getElementById('iptModel').value.trim();
    const textRaw = document.getElementById('iptText').value.trim();
    const author = document.getElementById('iptAuthor').value.trim();
    const stylePref = document.getElementById('iptStyle').value.trim();

    if (!textRaw) return alert('请输入正文内容');
    if (!apiKey || !modelEp) return alert('请确保 API Key 和 模型接入点 已填写');

    const btn = document.getElementById('btnGenerateNow');
    const orgText = btn.innerHTML;
    btn.innerHTML = '⏳ 正在请求 AI...';
    btn.disabled = true;

    try {
      const dynamicPrompt = AI_PROMPT + (stylePref ? `\n\n【用户强制定制要求】请务必使整套海报的配色和设计风格贴合以下描述：${stylePref}` : '');

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          textRaw,
          dynamicPrompt
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API 请求失败，状态码：${res.status}\n详细信息：${errText}`);
      }

      document.getElementById('generatorModal').classList.remove('show');
      const streamModal = document.getElementById('streamModal');
      const streamOut = document.getElementById('aiStreamOutput');
      streamModal.classList.add('show');
      streamOut.innerHTML = '';

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let content = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          const t = line.trim();
          if (t.startsWith('data: ') && t !== 'data: [DONE]') {
            try {
              const data = JSON.parse(t.slice(6));
              if (data.choices?.[0]?.delta?.content) {
                const delta = data.choices[0].delta.content;
                content += delta;
                streamOut.innerHTML += delta.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                streamOut.scrollTop = streamOut.scrollHeight;
              }
            } catch (e) {
              // ignore JSON parse errors from partial chunks
            }
          }
        }
      }

      // 清理 markdown 包裹
      content = content.replace(/^```json/im, '').replace(/```$/m, '').trim();

      // 使用 jsonrepair 强力修复由于模型幻觉导致的单双引号混乱、结尾无逗号、多余逗号等情况
      let result;
      try {
        const repaired = jsonrepair(content);
        result = JSON.parse(repaired);
      } catch (parseError) {
        // Fallback: 暴力剔除控制字符再次尝试修理（物理换行符等）
        try {
          const fallbackContent = content.replace(/[\u0000-\u001F]+/g, "");
          const fallbackRepaired = jsonrepair(fallbackContent);
          result = JSON.parse(fallbackRepaired);
        } catch (fallbackError) {
          console.error("AI 原始返回内容:", content);
          throw new Error("模型生成了无法识别的格式（排版格式已损坏）。建议您检查文本中是否有奇怪的特殊字符或表情，并多试一次！\\n(内部错误: " + parseError.message + ")");
        }
      }

      renderAIResult(result, author);
      streamModal.classList.remove('show');
    } catch (err) {
      alert('AI 排版失败：' + err.message);
      console.error(err);
    } finally {
      btn.innerHTML = orgText;
      btn.disabled = false;
    }
  });

  function renderAIResult(aiData, author) {
    const canvas = document.getElementById('canvasArea');
    canvas.innerHTML = '';
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).toUpperCase();
    const postersHTML = [];

    const totalPages = (aiData.pages ? aiData.pages.length : 0) + 2;

    // 1. Cover
    postersHTML.push(`
  <div class="poster" id="poster-1" style="background:${aiData.cover?.bgTheme || 'var(--bg-gradient)'};">
    <div class="draggable" style="top:28px; left:32px; right:32px; display:flex; justify-content:space-between; align-items:center;">
      <i class="del-btn">×</i><i class="drag-handle"></i>
      <div class="pt-dots"><div class="pt-dot"></div><div class="pt-dot"></div><div class="pt-dot"></div></div>
      <span class="t-date editable" contenteditable="true" data-solo="1">${dateStr}</span>
    </div>
    
    <div class="draggable" style="top:32%; left:32px; right:32px;">
      <i class="del-btn">×</i><i class="drag-handle"></i>
      <div class="t-display editable" contenteditable="true">${(aiData.cover?.headline || '大标题').replace(/\n/g, '<br>')}</div>
    </div>
    
    <div class="draggable" style="top:68%; left:32px; right:32px;">
      <i class="del-btn">×</i><i class="drag-handle"></i>
      <div class="t-body editable" contenteditable="true">${aiData.cover?.sub || ''}</div>
    </div>
    
    <div class="draggable" style="bottom:22px; right:32px; display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
      <i class="del-btn">×</i><i class="drag-handle"></i>
      <div class="pt-badge editable" contenteditable="true" data-solo="1">封面</div>
      <span class="t-id editable" contenteditable="true" data-solo="1">${author}</span>
    </div>
    <div class="edit-bar"><div class="eb-keys"><span class="eb-key"><kbd>Enter</kbd> 换行</span><span class="eb-key"><kbd>Esc</kbd> 取消</span></div><button class="eb-cancel">取消更改</button></div>
  </div>
  `);

    // 2. Content Pages
    if (aiData.pages) {
      aiData.pages.forEach((page, idx) => {
        const pageNum = idx + 2;
        let blocksHTML = '';

        (page.elements || []).forEach(el => {
          if (el.type === 'h2') {
            blocksHTML += `<div style="margin-bottom:12px;">
            <div class="deco-line"></div>
            <div class="t-h2 editable" contenteditable="true" style="margin-bottom:6px;">${el.content}</div>
          </div>`;
          } else if (el.type === 'body') {
            blocksHTML += `<div class="story-block" style="border-left-color: var(--accent); margin-bottom:12px;">
            <div class="t-body editable" contenteditable="true">${el.content}</div>
          </div>`;
          } else if (el.type === 'quote') {
            blocksHTML += `<div class="quote-wrap" style="margin-bottom:12px; position:relative; min-height:80px;">
            <div class="quote-mark sub-draggable" style="position:absolute; top:-10px; left:50%; transform:translateX(-50%);">"</div>
            <div class="quote-text editable sub-draggable" contenteditable="true" style="position:relative; z-index:2; margin-top:20px;">${el.content}</div>
            <div class="quote-author editable sub-draggable" contenteditable="true" data-solo="1" style="position:relative; margin-top:10px;">—— ${el.author || '佚名'}</div>
          </div>`;
          } else if (el.type === 'data') {
            blocksHTML += `<div class="data-wrap" style="margin-bottom:12px; position:relative; min-height:60px;">
            <div class="data-item" style="border:none; padding:0; align-items:flex-end;">
              <div class="t-num editable sub-draggable" contenteditable="true" data-solo="1" style="position:relative;">${el.num}</div>
              <div class="data-label editable sub-draggable" contenteditable="true" data-solo="1" style="position:relative; margin-left:8px; margin-bottom:8px;">${el.label}</div>
            </div>
            <div class="divider"></div>
          </div>`;
          } else if (el.type === 'list') {
            let listItems = (el.items || []).map((item, i) => `
            <div class="list-item" style="position:relative; border:none; padding-bottom:8px;">
              <div class="list-num sub-draggable" style="position:relative;">${i + 1}</div>
              <div class="list-content" style="position:relative; padding-left:12px;">
                <div class="list-title editable sub-draggable" contenteditable="true" style="position:relative;">${item.title}</div>
                <div class="list-desc editable sub-draggable" contenteditable="true" style="position:relative;">${item.desc || ''}</div>
              </div>
            </div>`).join('');
            blocksHTML += `<div class="list-wrap" style="margin-bottom:12px;">${listItems}</div>`;
          } else if (el.type === 'alert' || el.type === 'tip') {
            blocksHTML += `<div class="tip-block" style="margin-bottom:12px; position:relative; display:flex;">
            <span class="tip-icon sub-draggable" style="position:relative; margin-right:12px;">💡</span>
            <div class="t-body editable sub-draggable" contenteditable="true" style="position:relative; flex:1;">${el.content}</div>
          </div>`;
          } else {
            blocksHTML += `<div class="t-body editable" contenteditable="true" style="margin-bottom:12px;">${el.content || JSON.stringify(el)}</div>`;
          }
        });

        postersHTML.push(`
      <div class="poster" id="poster-${pageNum}" style="background:${page.bgTheme || 'var(--bg-main)'};">
        <div class="draggable" style="top:28px; left:32px; right:32px; display:flex; justify-content:space-between; align-items:center;">
          <i class="del-btn">×</i><i class="drag-handle"></i>
          <div class="pt-dots"><div class="pt-dot"></div><div class="pt-dot"></div><div class="pt-dot"></div></div>
          <span class="page-num editable" contenteditable="true" data-solo="1">0${pageNum} / 0${totalPages}</span>
        </div>

        <div class="draggable" style="top:15%; left:32px; right:32px;">
          <i class="del-btn">×</i><i class="drag-handle"></i>
          ${blocksHTML}
        </div>

        <div class="draggable" style="bottom:22px; right:32px; display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
          <i class="del-btn">×</i><i class="drag-handle"></i>
          <div class="pt-badge editable" contenteditable="true" data-solo="1">内容</div>
          <span class="t-id editable" contenteditable="true" data-solo="1">${author}</span>
        </div>
        <div class="edit-bar"><div class="eb-keys"><span class="eb-key"><kbd>Enter</kbd> 换行</span><span class="eb-key"><kbd>Esc</kbd> 取消</span></div><button class="eb-cancel">取消更改</button></div>
      </div>
      `);
      });
    }

    // 3. Ending Page
    const cta = aiData.ending?.cta || '喜欢就点个赞吧';
    postersHTML.push(`
  <div class="poster" id="poster-${totalPages}" style="background:${aiData.ending?.bgTheme || 'var(--bg-main)'};">
    <div class="draggable" style="top:28px; left:32px; right:32px; display:flex; justify-content:space-between; align-items:center;">
      <i class="del-btn">×</i><i class="drag-handle"></i>
      <div class="pt-dots"><div class="pt-dot"></div><div class="pt-dot"></div><div class="pt-dot"></div></div>
      <span class="page-num editable" contenteditable="true" data-solo="1">0${totalPages} / 0${totalPages}</span>
    </div>

    <div class="draggable" style="top:30%; left:32px; right:32px; text-align:center;">
      <i class="del-btn">×</i><i class="drag-handle"></i>
      <div class="t-h1 editable" contenteditable="true" style="text-align:center; margin-bottom:14px; font-size:28px;">
        ${cta}
      </div>
      <div class="t-body editable" contenteditable="true" style="text-align:center; opacity:0.6; font-size:11px;">
        海报生成时间：${new Date().toLocaleDateString()}
      </div>
    </div>

    <div class="draggable" style="bottom:54px; left:50%; transform:translateX(-50%); text-align:center; white-space:nowrap; display:flex; flex-direction:column; align-items:center; gap:6px;">
      <i class="del-btn">×</i><i class="drag-handle"></i>
      <div class="pt-badge editable" contenteditable="true" data-solo="1">THANKS</div>
      <span class="t-id editable" contenteditable="true" data-solo="1">${author}</span>
    </div>
    <div class="edit-bar"><div class="eb-keys"><span class="eb-key"><kbd>Enter</kbd> 换行</span><span class="eb-key"><kbd>Esc</kbd> 取消</span></div><button class="eb-cancel">取消更改</button></div>
  </div>
  `);

    canvas.innerHTML = postersHTML.join('');
    bindAll(canvas);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }


  /* =======================================================
     3. 文本编辑逻辑 (PPT 双击编辑式)
  ======================================================= */
  function getEditBar(el) { return el.closest('.poster')?.querySelector('.edit-bar'); }
  function openEditBar(el) {
    const bar = getEditBar(el); if (!bar) return;
    const solo = el.dataset.solo === '1';
    bar.querySelector('.eb-keys').innerHTML = solo ? `<span class="eb-key"><kbd>Enter</kbd> 确认</span><span class="eb-key"><kbd>Esc</kbd> 取消</span>` : `<span class="eb-key"><kbd>Enter</kbd> 换行</span><span class="eb-key"><kbd>Esc</kbd> 取消</span>`;
    bar.classList.add('on');
  }
  function closeEditBar(el) { getEditBar(el)?.classList.remove('on'); }

  function insertLineBreak() {
    const sel = window.getSelection(); if (!sel.rangeCount) return;
    const r = sel.getRangeAt(0); r.deleteContents();
    const br = document.createElement('br'); r.insertNode(br);
    const after = document.createRange(); after.setStartAfter(br); after.collapse(true);
    sel.removeAllRanges(); sel.addRange(after);
  }

  function insertPlainText(text) {
    const sel = window.getSelection(); if (!sel.rangeCount) return;
    const r = sel.getRangeAt(0); r.deleteContents();
    const node = document.createTextNode(text); r.insertNode(node);
    r.setStartAfter(node); r.collapse(true);
    sel.removeAllRanges(); sel.addRange(r);
  }

  function selectAllText(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function bindEditable(el) {
    if (el._editBound) return; el._editBound = true;
    el.contentEditable = "false"; // 默认关闭原生编辑，以防干扰拖拽

    const solo = el.dataset.solo === '1';

    // 双击激活真正的文字编辑
    el.addEventListener('dblclick', function (e) {
      if (!isEditMode) return;
      e.stopPropagation(); // 防止冒泡触发画板双击
      this.contentEditable = "true";
      focusedEl = this;
      savedContent = this.innerHTML;
      openEditBar(this);
      this.focus();
      selectAllText(this);
    });

    el.addEventListener('blur', function () {
      this.contentEditable = "false"; // 退出时恢复只读（可拖拽状态）
      closeEditBar(this);
      focusedEl = null;
    });

    el.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); this.innerHTML = savedContent; this.blur(); return; }
      if (e.key === 'Enter') { e.preventDefault(); solo ? this.blur() : insertLineBreak(); }
    });

    el.addEventListener('paste', function (e) {
      e.preventDefault(); const text = (e.clipboardData || window.clipboardData).getData('text/plain');
      if (solo) { insertPlainText(text.replace(/[\r\n]+/g, ' ')); } else {
        const lines = text.split(/\r?\n/); const frag = document.createDocumentFragment();
        lines.forEach((line, i) => { if (i > 0) frag.appendChild(document.createElement('br')); if (line) frag.appendChild(document.createTextNode(line)); });
        const sel = window.getSelection(); if (!sel.rangeCount) return;
        const r = sel.getRangeAt(0); r.deleteContents(); r.insertNode(frag); r.collapse(false);
        sel.removeAllRanges(); sel.addRange(r);
      }
    });
  }

  document.addEventListener('mousedown', e => {
    if (e.target.classList.contains('eb-cancel')) {
      e.preventDefault(); if (focusedEl) { focusedEl.innerHTML = savedContent; focusedEl.blur(); }
    }
  });


  /* =======================================================
     4. 拖动逻辑 & 磁吸辅助线
  ======================================================= */
  let dragEl = null; let dragOffX = 0; let dragOffY = 0;
  let isSubDrag = false;
  const guideX = document.getElementById('guide-x');
  const guideY = document.getElementById('guide-y');
  const SNAP_THRESHOLD = 6;

  function getXY(e) { return e.touches ? { cx: e.touches[0].clientX, cy: e.touches[0].clientY } : { cx: e.clientX, cy: e.clientY }; }
  function ensureAbsolute(el) {
    const poster = el.closest('.poster'); if (!poster) return;
    const er = el.getBoundingClientRect(); const pr = poster.getBoundingClientRect();
    el.style.position = 'absolute'; el.style.left = (er.left - pr.left) + 'px'; el.style.top = (er.top - pr.top) + 'px';
    el.style.right = 'auto'; el.style.bottom = 'auto';
    if (!el.style.width || el.style.width === 'auto') el.style.width = er.width + 'px';
  }

  function onDragStart(e) {
    if (!isEditMode) return;
    const t = e.target;

    // 处于编辑态时放行原生事件，允许选中文本
    if (t.isContentEditable || t.closest('[contenteditable="true"]')) return;
    if (t.classList.contains('del-btn') || t.closest('.del-btn')) return;

    e.preventDefault();
    e.stopPropagation(); // 阻止冒泡，彻底分离外层组拖拽和内层组件拖拽

    dragEl = e.currentTarget;
    isSubDrag = dragEl.classList.contains('sub-draggable');

    const { cx, cy } = getXY(e);

    if (isSubDrag) {
      if (!dragEl.hasAttribute('data-tx')) {
        dragEl.setAttribute('data-tx', '0');
        dragEl.setAttribute('data-ty', '0');
        const inlineTransform = dragEl.style.transform || '';
        // 记录原本就有的 transform (比如 quote的 translateX(-50%))
        dragEl.setAttribute('data-orig-transform', inlineTransform);
      }
      dragOffX = cx - parseFloat(dragEl.getAttribute('data-tx'));
      dragOffY = cy - parseFloat(dragEl.getAttribute('data-ty'));
    } else {
      ensureAbsolute(dragEl);
      const pr = dragEl.closest('.poster').getBoundingClientRect();
      dragOffX = cx - pr.left - parseFloat(dragEl.style.left);
      dragOffY = cy - pr.top - parseFloat(dragEl.style.top);
    }

    dragEl.classList.add('is-dragging');
  }

  function checkSnap(nx, ny, w, h, posterRect, others) {
    let snapX = nx, snapY = ny;
    let showX = false, showY = false;
    let guideLeft = 0, guideTop = 0;

    const centersX = [posterRect.width / 2];
    const centersY = [posterRect.height / 2];

    others.forEach(o => {
      centersX.push(parseFloat(o.style.left) + o.offsetWidth / 2);
      centersY.push(parseFloat(o.style.top) + o.offsetHeight / 2);
    });

    const myCenterX = nx + w / 2;
    const myCenterY = ny + h / 2;

    // Snap X
    for (let tgtX of centersX) {
      if (Math.abs(myCenterX - tgtX) < SNAP_THRESHOLD) {
        snapX = tgtX - w / 2;
        showX = true; guideLeft = tgtX;
        break;
      }
    }
    // Snap Y
    for (let tgtY of centersY) {
      if (Math.abs(myCenterY - tgtY) < SNAP_THRESHOLD) {
        snapY = tgtY - h / 2;
        showY = true; guideTop = tgtY;
        break;
      }
    }
    return { snapX, snapY, showX, showY, guideLeft, guideTop };
  }

  function onDragMove(e) {
    if (!dragEl) return; if (e.cancelable) e.preventDefault();
    const { cx, cy } = getXY(e);

    if (isSubDrag) {
      // 局部组件仅记录增量并叠加在原始 transform 上
      let nx = cx - dragOffX;
      let ny = cy - dragOffY;
      dragEl.setAttribute('data-tx', nx);
      dragEl.setAttribute('data-ty', ny);
      const orig = dragEl.getAttribute('data-orig-transform') || '';
      dragEl.style.transform = `${orig} translate(${nx}px, ${ny}px)`.trim();
    } else {
      const poster = dragEl.closest('.poster');
      const pr = poster.getBoundingClientRect();
      let nx = cx - pr.left - dragOffX;
      let ny = cy - pr.top - dragOffY;

      // Magnetic Alignment Logic (only for root draggables)
      const others = Array.from(poster.querySelectorAll('.draggable')).filter(el => el !== dragEl);
      const w = dragEl.offsetWidth, h = dragEl.offsetHeight;
      const snap = checkSnap(nx, ny, w, h, pr, others);

      dragEl.style.left = snap.snapX + 'px';
      dragEl.style.top = snap.snapY + 'px';

      if (snap.showX) {
        guideX.style.display = 'block'; guideX.style.left = (pr.left + snap.guideLeft) + 'px';
      } else guideX.style.display = 'none';

      if (snap.showY) {
        guideY.style.display = 'block'; guideY.style.top = (pr.top + snap.guideTop) + 'px';
      } else guideY.style.display = 'none';
    }
  }

  function onDragEnd() {
    if (!dragEl) return;
    dragEl.classList.remove('is-dragging');
    dragEl = null;
    guideX.style.display = 'none';
    guideY.style.display = 'none';
  }

  document.addEventListener('mousemove', onDragMove); document.addEventListener('mouseup', onDragEnd);
  document.addEventListener('touchmove', onDragMove, { passive: false }); document.addEventListener('touchend', onDragEnd);

  function bindDraggable(el) {
    if (el._dragBound) return; el._dragBound = true;
    el.addEventListener('mousedown', onDragStart);
    el.addEventListener('touchstart', onDragStart, { passive: false });
  }

  /* =======================================================
     5. 删除与撤销体验
  ======================================================= */
  const undoToast = document.getElementById('undo-toast'); const undoMsg = document.getElementById('undo-msg');
  function bindDelBtn(el) {
    const btn = el.querySelector(':scope > .del-btn'); if (!btn || btn._delBound) return; btn._delBound = true;
    btn.addEventListener('click', e => {
      e.stopPropagation(); deletedEl = el; deletedParent = el.parentNode; deletedBefore = el.nextSibling;
      el.remove(); undoMsg.textContent = '已删除元素'; undoToast.classList.add('show');
      clearTimeout(undoTimer); undoTimer = setTimeout(() => { undoToast.classList.remove('show'); deletedEl = null; }, 3000);
    });
  }
  document.getElementById('undo-btn').addEventListener('click', () => {
    if (!deletedEl || !deletedParent) return;
    deletedBefore && deletedParent.contains(deletedBefore) ? deletedParent.insertBefore(deletedEl, deletedBefore) : deletedParent.appendChild(deletedEl);
    bindAll(deletedEl); deletedEl = null; undoToast.classList.remove('show'); clearTimeout(undoTimer);
  });

  /* =======================================================
     6. 导出下载逻辑（HTML to Canvas）
  ======================================================= */
  const downloadBtn = document.getElementById('downloadAllBtn'); const dlProgress = document.getElementById('downloadProgress');
  const dlText = document.getElementById('downloadText'); const dlFill = document.getElementById('downloadFill');
  downloadBtn.addEventListener('click', async () => {
    const posters = document.querySelectorAll('.poster'); if (!posters.length) return;
    if (typeof html2canvas === 'undefined') { alert('下载组件加载失败，请刷新并检查网络'); return; }
    downloadBtn.disabled = true; dlProgress.classList.add('show');
    const wasEditMode = isEditMode; if (wasEditMode) document.body.classList.remove('edit-mode');
    try {
      for (let i = 0; i < posters.length; i++) {
        dlText.textContent = `正在生成第 ${i + 1} / ${posters.length} 张...`; dlFill.style.width = ((i + 1) / posters.length * 100) + '%';
        // 获取元素的精确尺寸和位置，避免 html2canvas 截断
        const rect = posters[i].getBoundingClientRect();
        // 渲染时强制页面回到顶部，防止滚动条导致的错位截断
        window.scrollTo(0, 0);

        const canvas = await html2canvas(posters[i], {
          scale: 2,
          useCORS: true,
          backgroundColor: null,
          logging: false,
          width: posters[i].offsetWidth,
          height: posters[i].offsetHeight,
          windowWidth: document.documentElement.offsetWidth,
          windowHeight: document.documentElement.offsetHeight,
          x: 0,
          y: 0,
          scrollY: 0,
          scrollX: 0
        });
        const link = document.createElement('a'); link.download = `poster-${String(i + 1).padStart(2, '0')}.png`; link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        if (i < posters.length - 1) await new Promise(r => setTimeout(r, 600));
      }
      dlText.textContent = '✅ 全部下载完成！'; await new Promise(r => setTimeout(r, 1200));
    } catch (err) { dlText.textContent = '❌ 下载出错：' + err.message; await new Promise(r => setTimeout(r, 2000)); }
    if (wasEditMode) document.body.classList.add('edit-mode');
    dlProgress.classList.remove('show'); dlFill.style.width = '0%'; downloadBtn.disabled = false;
  });

  /* =======================================================
     7. 左侧面板元素拖放出厂逻辑
  ======================================================= */
  function createElemTemplate(type) {
    const id = 'user-elem-' + (++elemIdCounter); let innerHTML = '';
    switch (type) {
      case 'display-title': innerHTML = `<div class="t-display editable" contenteditable="false">新标题</div>`; break;
      case 'h1-title': innerHTML = `<div class="deco-line"></div><div class="t-h1 editable" contenteditable="false">小标题</div>`; break;
      case 'body-text': innerHTML = `<div class="t-body editable" contenteditable="false">在这里输入正文内容，可以换行编辑。</div>`; break;
      case 'list-group':
        innerHTML = `<div class="list-wrap"><div class="list-item" style="position:relative; border:none; padding-bottom:8px;"><div class="list-num sub-draggable" style="position:relative;">1</div><div class="list-content" style="position:relative; padding-left:12px;"><div class="list-title editable sub-draggable" contenteditable="false" style="position:relative;">项目一</div><div class="list-desc editable sub-draggable" contenteditable="false" style="position:relative;">描述文字</div></div></div><div class="list-item" style="position:relative; border:none; padding-bottom:8px;"><div class="list-num sub-draggable" style="position:relative;">2</div><div class="list-content" style="position:relative; padding-left:12px;"><div class="list-title editable sub-draggable" contenteditable="false" style="position:relative;">项目二</div><div class="list-desc editable sub-draggable" contenteditable="false" style="position:relative;">描述文字</div></div></div></div>`;
        break;
      case 'quote-block':
        innerHTML = `<div class="quote-wrap" style="position:relative; min-height:80px;"><div class="quote-mark sub-draggable" style="position:absolute; top:-10px; left:50%; transform:translateX(-50%);">"</div><div class="quote-text editable sub-draggable" contenteditable="false" style="position:relative; z-index:2; margin-top:20px;">在这里写金句</div><div class="quote-author editable sub-draggable" contenteditable="false" data-solo="1" style="position:relative; margin-top:10px;">—— 来源</div></div>`;
        break;
      case 'data-block':
        innerHTML = `<div class="data-wrap" style="position:relative; min-height:60px;"><div class="data-item" style="border:none; padding:0; align-items:flex-end;"><div class="t-num editable sub-draggable" contenteditable="false" data-solo="1" style="position:relative;">99%</div><div class="data-label editable sub-draggable" contenteditable="false" data-solo="1" style="position:relative; margin-left:8px; margin-bottom:8px;">数据说明</div></div><div class="divider"></div></div>`;
        break;
      case 'tip-block':
        innerHTML = `<div class="tip-block" style="position:relative; display:flex;"><span class="tip-icon sub-draggable" style="position:relative; margin-right:12px;">💡</span><div class="t-body editable sub-draggable" contenteditable="false" style="position:relative; flex:1;">提示内容写在这里</div></div>`;
        break;
      case 'story-block':
        innerHTML = `<div class="t-h2 editable sub-draggable" contenteditable="false" style="margin-bottom:10px; position:relative;">小标题</div><div class="story-block"><div class="t-body editable sub-draggable" contenteditable="false" style="position:relative;">段落文字写在这里</div></div>`;
        break;
      case 'deco-line': innerHTML = `<div class="deco-line" style="width:60px;"></div>`; break;
      case 'deco-dots': innerHTML = `<div class="pt-dots"><div class="pt-dot"></div><div class="pt-dot"></div><div class="pt-dot"></div></div>`; break;
      case 'badge': innerHTML = `<div class="pt-badge editable" contenteditable="false" data-solo="1">标签文字</div>`; break;
      case 'divider': innerHTML = `<div class="divider" style="width:100%;"></div>`; break;
      case 'tag': innerHTML = `<span class="tag editable" contenteditable="false" data-solo="1">#标签</span>`; break;
      default: innerHTML = `<div class="t-body editable" contenteditable="false">新元素</div>`;
    }
    const wrapper = document.createElement('div'); wrapper.className = 'draggable'; wrapper.id = id;
    wrapper.innerHTML = `<i class="del-btn">×</i><i class="drag-handle"></i>${innerHTML}`; return wrapper;
  }

  function enablePosterDrop(poster) {
    if (poster._dropBound) return; poster._dropBound = true;
    poster.addEventListener('dragover', e => {
      if (!isEditMode) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; poster.classList.add('drop-hover');
    });
    poster.addEventListener('dragleave', () => poster.classList.remove('drop-hover'));
    poster.addEventListener('drop', e => {
      e.preventDefault(); poster.classList.remove('drop-hover'); if (!isEditMode) return;
      const type = e.dataTransfer.getData('application/elem-type'); if (!type) return;
      const rect = poster.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top;
      const newEl = createElemTemplate(type);
      newEl.style.position = 'absolute'; newEl.style.left = Math.max(16, Math.min(x - 40, rect.width - 80)) + 'px'; newEl.style.top = Math.max(16, Math.min(y - 20, rect.height - 60)) + 'px'; newEl.style.width = (rect.width - 64) + 'px';
      const bar = poster.querySelector('.edit-bar'); bar ? poster.insertBefore(newEl, bar) : poster.appendChild(newEl);
      bindAll(newEl);
    });
  }

  document.querySelectorAll('.elem-item').forEach(item => {
    item.addEventListener('dragstart', e => {
      e.dataTransfer.setData('application/elem-type', item.dataset.elemType); e.dataTransfer.effectAllowed = 'copy';
      const ghost = item.cloneNode(true); ghost.style.opacity = '0.7'; ghost.style.position = 'absolute'; ghost.style.top = '-9999px';
      document.body.appendChild(ghost); e.dataTransfer.setDragImage(ghost, 40, 20); setTimeout(() => ghost.remove(), 0);
    });
  });

  /* =======================================================
     8. 统一定向绑定总控
  ======================================================= */
  function bindAll(root) {
    (root.classList.contains('editable') ? [root] : []).concat([...root.querySelectorAll('.editable')]).forEach(bindEditable);
    (root.classList.contains('draggable') ? [root] : []).concat([...root.querySelectorAll('.draggable')]).forEach(el => { bindDraggable(el); bindDelBtn(el); });
    (root.classList.contains('sub-draggable') ? [root] : []).concat([...root.querySelectorAll('.sub-draggable')]).forEach(el => { bindDraggable(el); });
    (root.classList.contains('poster') ? [root] : []).concat([...root.querySelectorAll('.poster')]).forEach(enablePosterDrop);
  }

  // 页面加载最初始化
  bindAll(document.body);
  // 监控后续注入（尤其是拖放新组件时）
  new MutationObserver(m => m.forEach(x => x.addedNodes.forEach(node => { if (node.nodeType === Node.ELEMENT_NODE) bindAll(node); }))).observe(document.body, { childList: true, subtree: true });

  /* =======================================================
     10. 主题配色更换逻辑
  ======================================================= */
  const THEMES = [
    'radial-gradient(ellipse at 50% 50%, #fff 0%, #f0f0f0 100%)',
    'linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)',
    'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)',
    'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
    'linear-gradient(to top, #fff1eb 0%, #ace0f9 100%)',
    'linear-gradient(120deg, #f6d365 0%, #fda085 100%)',
    'linear-gradient(120deg, #d4fc79 0%, #96e6a1 100%)',
    'linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)',
    'linear-gradient(120deg, #fccb90 0%, #d57eeb 100%)',
    'linear-gradient(to right, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(to right, #fa709a 0%, #fee140 100%)',
    'linear-gradient(to top, #ff0844 0%, #ffb199 100%)',
    '#ffffff',
    '#f4f4f4',
    '#1a1a1a'
  ];

  let activePosterForTheme = null;

  function initThemeSidebar() {
    const sidebar = document.getElementById('themeSidebar');
    const btnOpen = document.getElementById('openThemeBtn');
    const btnClose = document.getElementById('closeThemeBtn');
    const swatchesContainer = document.getElementById('themeSwatches');
    const btnApplyAll = document.getElementById('applyThemeAllBtn');

    // 渲染色块
    THEMES.forEach(theme => {
      const div = document.createElement('div');
      div.className = 'theme-swatch';
      div.style.background = theme;
      div.onclick = () => {
        document.querySelectorAll('.theme-swatch').forEach(el => el.classList.remove('active'));
        div.classList.add('active');
        if (activePosterForTheme) {
          activePosterForTheme.style.background = theme;
        } else {
          // 如果没有选中的，默认加给第一张
          const first = document.querySelector('.poster');
          if (first) first.style.background = theme;
        }
      };
      swatchesContainer.appendChild(div);
    });

    // 控制侧边栏显隐
    btnOpen.onclick = () => sidebar.classList.add('open');
    btnClose.onclick = () => sidebar.classList.remove('open');

    // 全局应用
    btnApplyAll.onclick = () => {
      const activeSwatch = document.querySelector('.theme-swatch.active');
      if (!activeSwatch) { alert('请先选择一个配色方案'); return; }
      const bg = activeSwatch.style.background;
      document.querySelectorAll('.poster').forEach(p => p.style.background = bg);
    };
  }

  // 监听画板点击事件，记录哪个画板是最后被操作的，用于配色目标
  document.addEventListener('mousedown', e => {
    const poster = e.target.closest('.poster');
    if (poster) {
      activePosterForTheme = poster;
      document.querySelectorAll('.poster').forEach(p => p.style.outline = 'none');
      poster.style.outline = '2px solid var(--accent)';
    } else if (!e.target.closest('.theme-sidebar') && !e.target.closest('#openThemeBtn')) {
      activePosterForTheme = null;
      document.querySelectorAll('.poster').forEach(p => p.style.outline = 'none');
    }
  });

  // 初始化
  initThemeSidebar();

};
