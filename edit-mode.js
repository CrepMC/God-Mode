(() => {
    if (document.getElementById('universal-edit-modal')) return;

    const STORAGE_KEY = 'god_mode_edits';
    let savedEdits = JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || {};

    let mouseX = 0, mouseY = 0;
    let elementsStack = [];
    let currentLayerIndex = 0;
    let currentTarget = null; 
    let currentEditData = {};
    let isModalOpen = false;
    let highlightedEl = null;

    // Biến cho tính năng Canva
    let canvasState = { x: 0, y: 0, scale: 1 };
    let isDraggingCanvas = false;
    let dragStartX = 0, dragStartY = 0;

    function getCssPath(el) {
        if (!(el instanceof Element)) return '';
        let path = [];
        while (el.nodeType === Node.ELEMENT_NODE) {
          let selector = el.nodeName.toLowerCase();
          if (selector === 'body' || selector === 'html') { path.unshift(selector); break; }
          
          if (el.id && !/\d/.test(el.id)) { 
              selector += '#' + el.id; path.unshift(selector); break; 
          } else {
              let sib = el, nth = 1;
              while (sib = sib.previousElementSibling) { if (sib.nodeName.toLowerCase() === selector) nth++; }
              if (nth !== 1) selector += ":nth-of-type(" + nth + ")";
          }
          path.unshift(selector); el = el.parentNode;
        }
        return path.join(" > ");
    }

    document.querySelectorAll('#continuous-edit-style, #instant-edit-tooltip, #universal-edit-modal').forEach(e => e.remove());

    const style = document.createElement('style');
    style.id = 'continuous-edit-style';
    style.innerHTML = `.god-mode-highlight { outline: 3px dashed #ff9f43 !important; background-color: rgba(255, 159, 67, 0.2) !important; cursor: crosshair !important; }`;
    document.head.appendChild(style);

    const tooltip = document.createElement('div');
    tooltip.id = 'instant-edit-tooltip';
    tooltip.style.cssText = 'position:fixed; z-index:9999999; background:rgba(0,0,0,0.85); color:#fff; padding:6px 12px; border-radius:6px; font-size:13px; font-family:sans-serif; pointer-events:none; display:none; white-space:nowrap; transform: translate(15px, 15px); box-shadow: 0 4px 6px rgba(0,0,0,0.3); font-weight: bold;';
    document.body.appendChild(tooltip);

    const modal = document.createElement('div');
    modal.id = 'universal-edit-modal';
    modal.style.cssText = 'display:none; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:10000000; background:#fff; padding:20px; border-radius:12px; box-shadow:0 15px 50px rgba(0,0,0,0.6); font-family:sans-serif; min-width:400px; max-width:90vw; color:#333;';
    
    modal.innerHTML = `
        <h3 id="uem-title" style="margin:0 0 15px 0; font-size:18px; border-bottom:1px solid #eee; padding-bottom:10px;">Chỉnh sửa phần tử</h3>
        
        <div id="uem-empty-options" style="display:none; margin-bottom: 15px; padding: 12px; background: #f1f2f6; border-radius: 6px; border: 1px dashed #a4b0be;">
            <p style="margin:0 0 8px 0; font-size:13px; font-weight:bold; color:#2f3542;">Vùng này đang trống. Bạn muốn chèn gì?</p>
            <label style="margin-right: 15px; cursor:pointer;"><input type="radio" name="uem-empty-type" value="added-text" checked> 📝 Chữ</label>
            <label style="cursor:pointer;"><input type="radio" name="uem-empty-type" value="added-bg"> 🖼️ Ảnh Nền</label>
        </div>

        <div id="uem-preview-container" style="display:none; position:relative; overflow:hidden; margin:0 auto 15px auto; background:#f1f2f6; border-radius:8px; border: 2px dashed #a4b0be; width:100%; cursor:grab; box-shadow: inset 0 0 10px rgba(0,0,0,0.1);">
            <div id="uem-preview-inner" style="width:100%; height:100%; background-position:center; background-size:cover; background-repeat:no-repeat; transform-origin:center; transition: transform 0.05s linear;"></div>
            <div style="position:absolute; bottom:5px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.6); color:#fff; font-size:11px; padding:3px 8px; border-radius:10px; pointer-events:none;">Lăn chuột: Zoom | Kéo thả: Di chuyển</div>
        </div>
        
        <textarea id="uem-input" placeholder="Nhập Text hoặc dán Link URL ảnh vào đây..." style="width:100%; height:80px; padding:10px; margin-bottom:15px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box; font-size:14px; font-family:inherit; resize:vertical;"></textarea>
        
        <div style="margin-bottom: 20px;">
            <label style="font-size:13px; font-weight:bold; display:block; margin-bottom:5px; color:#2f3542;">Độ mờ (Opacity): <span id="uem-opacity-val">100%</span></label>
            <input type="range" id="uem-opacity" min="0" max="1" step="0.05" value="1" style="width:100%; cursor:pointer;">
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center;">
          <button id="uem-undo" style="display:none; padding:8px 16px; cursor:pointer; background:#e74c3c; color:white; border:none; border-radius:6px; font-weight:bold;">↺ Hoàn tác</button>
          <div style="margin-left:auto;">
            <button id="uem-cancel" style="padding:8px 16px; margin-right:10px; cursor:pointer; background:#e0e0e0; color:#333; border:none; border-radius:6px; font-weight:bold;">Hủy</button>
            <button id="uem-save" style="padding:8px 16px; cursor:pointer; background:#9b59b6; color:white; border:none; border-radius:6px; font-weight:bold;">Lưu & Áp dụng</button>
          </div>
        </div>
    `;
    document.body.appendChild(modal);

    /* --- LOGIC PREVIEW & CANVA --- */
    const pCont = document.getElementById('uem-preview-container');
    const pInner = document.getElementById('uem-preview-inner');
    const inputField = document.getElementById('uem-input');

    function applyPreviewTransform() {
        pInner.style.transform = `translate(${canvasState.x}%, ${canvasState.y}%) scale(${canvasState.scale})`;
    }

    // Real-time Update ảnh khi gõ Link
    inputField.addEventListener('input', (e) => {
        let type = currentEditData.type === 'empty' ? document.querySelector('input[name="uem-empty-type"]:checked').value : currentEditData.type;
        if (type === 'img' || type === 'bg' || type === 'added-bg') {
            pInner.style.backgroundImage = `url("${e.target.value}")`;
        }
    });

    // Bật tắt Preview khi bấm Radio ở Vùng trống
    document.querySelectorAll('input[name="uem-empty-type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'added-bg') {
                pCont.style.display = 'block';
                setupCanvasRatio();
                pInner.style.backgroundImage = `url("${inputField.value}")`;
            } else { pCont.style.display = 'none'; }
        });
    });

    // Tính toán Tỷ lệ khung Preview chuẩn 100% với Web
    function setupCanvasRatio() {
        if (!currentTarget) return;
        let rect = currentTarget.getBoundingClientRect();
        let ratio = rect.width / (rect.height || 1);
        pCont.style.aspectRatio = `${ratio}`;
        pCont.style.maxHeight = '220px'; // Giới hạn chiều cao cho bảng gọn gàng
        applyPreviewTransform();
    }

    pCont.addEventListener('mousedown', (e) => {
        isDraggingCanvas = true; dragStartX = e.clientX; dragStartY = e.clientY;
        pCont.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDraggingCanvas) return;
        let dx = e.clientX - dragStartX; let dy = e.clientY - dragStartY;
        // Chuyển đổi Pixel chuột sang % theo kích thước khung
        canvasState.x += (dx / pCont.offsetWidth) * 100;
        canvasState.y += (dy / pCont.offsetHeight) * 100;
        dragStartX = e.clientX; dragStartY = e.clientY;
        applyPreviewTransform();
    });

    window.addEventListener('mouseup', () => { isDraggingCanvas = false; pCont.style.cursor = 'grab'; });

    pCont.addEventListener('wheel', (e) => {
        e.preventDefault();
        let zoomSpeed = 0.05;
        canvasState.scale += e.deltaY < 0 ? zoomSpeed : -zoomSpeed;
        if (canvasState.scale < 0.1) canvasState.scale = 0.1;
        applyPreviewTransform();
    });

    // Cập nhật Opacity Realtime
    document.getElementById('uem-opacity').addEventListener('input', function(e) {
        document.getElementById('uem-opacity-val').innerText = Math.round(e.target.value * 100) + '%';
        if (currentTarget) currentTarget.style.opacity = e.target.value;
    });

    /* --- MAIN LOGIC --- */
    function getElementType(el) {
        if (el.tagName === 'IMG') return 'img';
        if (el.tagName === 'svg' || el.closest('svg')) return 'svg';
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return 'input';
        
        let bg = window.getComputedStyle(el).backgroundImage;
        if (bg && bg !== 'none' && bg.includes('url(')) {
            let m = bg.match(/url\(['"]?(.*?)['"]?\)/);
            if (m && !m[1].startsWith('data:image/svg')) return 'bg';
        }
        let hasDirectText = Array.from(el.childNodes).some(node => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() !== '');
        if (hasDirectText) return 'text';
        return 'empty';
    }

    function setHighlight(el) {
        if (highlightedEl && highlightedEl !== el) highlightedEl.classList.remove('god-mode-highlight');
        if (el) { el.classList.add('god-mode-highlight'); highlightedEl = el; }
    }

    function updateHighlightAndTooltip() {
        let target = elementsStack[currentLayerIndex];
        if (!target) return;
        setHighlight(target);
        
        let type = getElementType(target);
        let path = getCssPath(target);
        let isEdited = savedEdits[path];
        
        let label = (type === 'img' || type === 'bg') ? 'Sửa Ảnh' : (type === 'svg' ? 'Sửa Icon' : (type === 'input' ? 'Sửa Ô Nhập' : (type === 'text' ? 'Sửa Chữ' : 'Vùng Trống')));
        tooltip.innerText = `${isEdited ? '✨ ' : ''}[Lớp ${currentLayerIndex + 1}/${elementsStack.length}] ${label}`;
        tooltip.style.background = isEdited ? '#27ae60' : (type === 'empty' ? '#e67e22' : '#0984e3');
        tooltip.style.left = (mouseX + 15) + 'px'; tooltip.style.top = (mouseY + 15) + 'px'; tooltip.style.display = 'block';
    }

    const handleMouseMove = function(e) {
        if (isModalOpen) return;
        mouseX = e.clientX; mouseY = e.clientY;
        let currentEls = document.elementsFromPoint(mouseX, mouseY).filter(el => el.id !== 'instant-edit-tooltip' && !modal.contains(el));
        currentEls = [...new Set(currentEls.map(el => el.closest('svg') || el))];

        if (!elementsStack.length || currentEls[0] !== elementsStack[0]) { elementsStack = currentEls; currentLayerIndex = 0; } 
        else { elementsStack = currentEls; }
        updateHighlightAndTooltip();
    };

    function applyEdit(el, type, val, opacityVal, state) {
        if (!el) return;
        if (type === 'img') {
            el.src = val;
            el.style.setProperty('transform', `translate(${state.x}%, ${state.y}%) scale(${state.scale})`, 'important');
            el.style.setProperty('clip-path', 'inset(0)', 'important');
        }
        else if (type === 'bg' || type === 'added-bg') {
            el.style.setProperty('background-image', 'none', 'important');
            if (window.getComputedStyle(el).position === 'static') el.style.setProperty('position', 'relative', 'important');
            let bgLayer = el.querySelector('.god-mode-bg-layer');
            if (!bgLayer) {
                bgLayer = document.createElement('div');
                bgLayer.className = 'god-mode-bg-layer';
                bgLayer.style.cssText = 'position:absolute; top:0; left:0; right:0; bottom:0; z-index:0; pointer-events:none; overflow:hidden; border-radius:inherit;';
                let innerImg = document.createElement('div'); innerImg.className = 'god-mode-bg-inner';
                innerImg.style.cssText = 'width:100%; height:100%; background-position:center; background-size:cover; background-repeat:no-repeat; transform-origin:center;';
                bgLayer.appendChild(innerImg);
                if (el.firstChild) el.insertBefore(bgLayer, el.firstChild); else el.appendChild(bgLayer);
            }
            let inner = bgLayer.querySelector('.god-mode-bg-inner');
            inner.style.backgroundImage = `url("${val}")`;
            inner.style.transform = `translate(${state.x}%, ${state.y}%) scale(${state.scale})`;
        }
        else if (type === 'svg') {
            let tempDiv = document.createElement('div'); tempDiv.innerHTML = val.trim();
            if (tempDiv.firstChild && el.parentNode) { tempDiv.firstChild.dataset.godModeReplaced = "true"; el.replaceWith(tempDiv.firstChild); }
        }
        else if (type === 'input') el.value = val;
        else if (type === 'text') el.innerText = val;
        else if (type === 'added-text') {
            el.innerText = val; el.style.setProperty('display', 'flex', 'important'); el.style.setProperty('align-items', 'center', 'important'); el.style.setProperty('justify-content', 'center', 'important'); el.style.setProperty('text-align', 'center', 'important');
        }
        if (opacityVal !== undefined) el.style.setProperty('opacity', opacityVal, 'important');
    }

    const closeAndResume = function() {
        if (currentEditData.originalOpacity !== undefined && currentTarget && !savedEdits[currentEditData.path]) { currentTarget.style.opacity = currentEditData.originalOpacity; }
        isModalOpen = false; modal.style.display = 'none'; pCont.style.display = 'none'; pInner.style.backgroundImage = '';
        updateHighlightAndTooltip();
    };

    document.getElementById('uem-cancel').onclick = closeAndResume;

    document.getElementById('uem-undo').onclick = function() {
        let path = currentEditData.path;
        if (savedEdits[path]) {
            let orig = savedEdits[path].original;
            let origStyles = savedEdits[path].originalStyles || {};
            
            // Xóa Canvas Layer được nhúng
            let injectedBg = currentTarget.querySelector('.god-mode-bg-layer');
            if (injectedBg) injectedBg.remove();
            
            // Phục hồi Inline style
            currentTarget.style.display = origStyles.display || '';
            currentTarget.style.alignItems = origStyles.alignItems || '';
            currentTarget.style.justifyContent = origStyles.justifyContent || '';
            currentTarget.style.textAlign = origStyles.textAlign || '';
            currentTarget.style.opacity = origStyles.opacity || '';
            currentTarget.style.transform = origStyles.transform || '';
            currentTarget.style.clipPath = origStyles.clipPath || '';
            
            let oldType = savedEdits[path].oldType;
            if (oldType === 'img') currentTarget.src = orig;
            else if (oldType === 'bg') currentTarget.style.backgroundImage = orig;
            else if (oldType === 'svg') { applyEdit(currentTarget, 'svg', orig, origStyles.opacity); }
            else if (oldType === 'input') currentTarget.value = orig;
            else currentTarget.innerText = orig;

            delete savedEdits[path];
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(savedEdits));
        }
        closeAndResume();
    };

    document.getElementById('uem-save').onclick = function() {
        let newVal = inputField.value;
        let path = currentEditData.path;
        let typeToSave = currentEditData.type === 'empty' ? document.querySelector('input[name="uem-empty-type"]:checked').value : currentEditData.type;
        let opacityVal = document.getElementById('uem-opacity').value;

        savedEdits[path] = { 
            type: typeToSave, 
            oldType: currentEditData.type,
            original: currentEditData.original, 
            newVal: newVal,
            opacity: opacityVal,
            canvasState: { ...canvasState },
            originalStyles: {
                display: currentTarget.style.display, alignItems: currentTarget.style.alignItems,
                justifyContent: currentTarget.style.justifyContent, textAlign: currentTarget.style.textAlign,
                opacity: currentEditData.originalOpacity, transform: currentTarget.style.transform, clipPath: currentTarget.style.clipPath
            }
        };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(savedEdits));
        applyEdit(currentTarget, typeToSave, newVal, opacityVal, canvasState);
        isModalOpen = false; closeAndResume();
    };

    const handleClick = function(e) {
        if(isModalOpen || modal.contains(e.target)) return; 
        e.preventDefault(); e.stopPropagation();

        currentTarget = elementsStack[currentLayerIndex];
        if (!currentTarget) return;

        isModalOpen = true;
        currentEditData.path = getCssPath(currentTarget);
        let existingSave = savedEdits[currentEditData.path];
        let detectedType = getElementType(currentTarget);
        
        if (detectedType === 'empty') {
            document.getElementById('uem-empty-options').style.display = 'block'; currentEditData.type = 'empty';
        } else {
            document.getElementById('uem-empty-options').style.display = 'none'; currentEditData.type = detectedType;
        }

        currentEditData.originalOpacity = window.getComputedStyle(currentTarget).opacity;
        let currentOpacity = existingSave && existingSave.opacity !== undefined ? existingSave.opacity : currentEditData.originalOpacity;
        document.getElementById('uem-opacity').value = currentOpacity;
        document.getElementById('uem-opacity-val').innerText = Math.round(currentOpacity * 100) + '%';

        if (existingSave) { 
            currentEditData.original = existingSave.original; 
            document.getElementById('uem-undo').style.display = 'inline-block'; 
            if (detectedType === 'empty') document.getElementById('uem-empty-options').style.display = 'none'; 
        } else {
            document.getElementById('uem-undo').style.display = 'none';
            if (detectedType === 'img') currentEditData.original = currentTarget.src;
            else if (detectedType === 'bg') currentEditData.original = currentTarget.style.backgroundImage;
            else if (detectedType === 'svg') currentEditData.original = currentTarget.outerHTML;
            else if (detectedType === 'input') currentEditData.original = currentTarget.value;
            else if (detectedType === 'text') currentEditData.original = currentTarget.innerText;
            else currentEditData.original = '';
        }

        let currentVal = existingSave ? existingSave.newVal : currentEditData.original;
        if (detectedType === 'bg' && !existingSave) { let m = currentVal.match(/url\(['"]?(.*?)['"]?\)/); currentVal = m ? m[1] : ''; }
        
        inputField.value = currentVal;
        document.getElementById('uem-title').innerText = existingSave ? '✨ Bạn muốn Sửa tiếp hay Khôi phục?' : 'Chỉnh sửa Layer';

        // Xử lý Render Canvas
        if (detectedType === 'img' || detectedType === 'bg' || existingSave?.type === 'added-bg') {
            pCont.style.display = 'block';
            pInner.style.backgroundImage = `url("${currentVal}")`;
            canvasState = (existingSave && existingSave.canvasState) ? { ...existingSave.canvasState } : { x: 0, y: 0, scale: 1 };
            setupCanvasRatio();
        } else {
            pCont.style.display = 'none';
        }

        tooltip.style.display = 'none'; modal.style.display = 'block'; inputField.focus();
    };

    const handleKey = function(e) {
        if (e.key === 'Escape') {
            if (isModalOpen) { closeAndResume(); return; }
            if (highlightedEl) highlightedEl.classList.remove('god-mode-highlight');
            document.querySelectorAll('#continuous-edit-style, #instant-edit-tooltip, #universal-edit-modal').forEach(el=>el.remove());
            document.removeEventListener('click', handleClick, true); document.removeEventListener('mousemove', handleMouseMove, true); document.removeEventListener('keydown', handleKey, true);
            return;
        }
        if (!isModalOpen) {
            if (e.key === 'ArrowUp') { e.preventDefault(); if (currentLayerIndex < elementsStack.length - 1) { currentLayerIndex++; updateHighlightAndTooltip(); } } 
            else if (e.key === 'ArrowDown') { e.preventDefault(); if (currentLayerIndex > 0) { currentLayerIndex--; updateHighlightAndTooltip(); } }
        }
    };

    document.addEventListener('click', handleClick, true); document.addEventListener('mousemove', handleMouseMove, true); document.addEventListener('keydown', handleKey, true);
    console.log("🛠️ GOD MODE V3: Bật tính năng Kéo thả/Zoom Real-time (Mini Canva)!");

})();