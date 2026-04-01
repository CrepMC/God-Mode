(() => {
    const STORAGE_KEY = 'god_mode_edits';
    let restoreTimeout = null;

    function applyEdit(el, data) {
        if (!el) return;
        let type = data.type;
        let val = data.newVal;
        let state = data.canvasState || { x: 0, y: 0, scale: 1 };

        if (type === 'img') {
            el.src = val;
            el.style.setProperty('transform', `translate(${state.x}%, ${state.y}%) scale(${state.scale})`, 'important');
            el.style.setProperty('clip-path', 'inset(0)', 'important');
        }
        else if (type === 'bg' || type === 'added-bg') {
            el.style.setProperty('background-image', 'none', 'important');
            if (window.getComputedStyle(el).position === 'static') {
                el.style.setProperty('position', 'relative', 'important');
            }
            
            // ÉP CÁC PHẦN TỬ CON NỔI LÊN TRÊN ĐỂ KHÔNG BỊ BACKGROUND CHE MẤT
            Array.from(el.children).forEach(child => {
                if (!child.classList.contains('god-mode-bg-layer')) {
                    if (window.getComputedStyle(child).position === 'static') {
                        child.style.setProperty('position', 'relative', 'important');
                    }
                    child.style.setProperty('z-index', '1', 'important');
                }
            });

            let bgLayer = el.querySelector('.god-mode-bg-layer');
            if (!bgLayer) {
                bgLayer = document.createElement('div');
                bgLayer.className = 'god-mode-bg-layer';
                // Đẩy z-index xuống -1 nếu có thể, hoặc 0
                bgLayer.style.cssText = 'position:absolute; top:0; left:0; right:0; bottom:0; z-index:0; pointer-events:none; overflow:hidden; border-radius:inherit;';
                
                let innerImg = document.createElement('div');
                innerImg.className = 'god-mode-bg-inner';
                innerImg.style.cssText = 'width:100%; height:100%; background-position:center; background-size:cover; background-repeat:no-repeat; transform-origin:center;';
                
                bgLayer.appendChild(innerImg);
                if (el.firstChild) el.insertBefore(bgLayer, el.firstChild);
                else el.appendChild(bgLayer);
            }
            let inner = bgLayer.querySelector('.god-mode-bg-inner');
            inner.style.backgroundImage = `url("${val}")`;
            inner.style.transform = `translate(${state.x}%, ${state.y}%) scale(${state.scale})`;
        }
        // ... (Giữ nguyên các type khác như svg, input, text)
        else if (type === 'svg') {
            if (!el.dataset.godModeReplaced) {
                let tempDiv = document.createElement('div'); tempDiv.innerHTML = val.trim();
                if (tempDiv.firstChild && el.parentNode) {
                    tempDiv.firstChild.dataset.godModeReplaced = "true";
                    el.replaceWith(tempDiv.firstChild);
                }
            }
        }
        else if (type === 'input') el.value = val;
        else if (type === 'text') el.innerText = val;
        else if (type === 'added-text') {
            el.innerText = val;
            el.style.setProperty('display', 'flex', 'important');
            el.style.setProperty('align-items', 'center', 'important');
            el.style.setProperty('justify-content', 'center', 'important');
            el.style.setProperty('text-align', 'center', 'important');
        }

        if (data.opacity !== undefined) el.style.setProperty('opacity', data.opacity, 'important');
    }

    function restoreSavedEdits() {
        let savedEdits = JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || {};
        for (let path in savedEdits) {
            try {
                let elements = document.querySelectorAll(path);
                elements.forEach(el => applyEdit(el, savedEdits[path]));
            } catch(e) {}
        }
    }

    // FIX LỖI "DOCUMENT.BODY IS NULL": Chờ DOM load xong hoặc dùng documentElement
    const initRestore = () => {
        restoreSavedEdits();
        
        // Dùng document.documentElement (thẻ <html>) thay vì document.body
        const targetNode = document.documentElement; 
        
        const observer = new MutationObserver((mutations) => {
            let isOwnUI = mutations.every(m => {
                let target = m.target;
                return target.id === 'universal-edit-modal' || 
                       target.id === 'instant-edit-tooltip' || 
                       target.id === 'continuous-edit-style' || 
                       (target.classList && target.classList.contains('god-mode-bg-layer')) ||
                       (target.closest && target.closest('#universal-edit-modal'));
            });
            
            if (isOwnUI) return;

            clearTimeout(restoreTimeout);
            restoreTimeout = setTimeout(() => {
                observer.disconnect(); 
                restoreSavedEdits(); 
                observer.observe(targetNode, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'src'] });
            }, 200);
        });

        observer.observe(targetNode, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'src'] });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initRestore);
    } else {
        initRestore();
    }
})();