document.addEventListener('DOMContentLoaded', () => {
    // DOM元素
    const fileInput = document.getElementById('file-input');
    const fileCount = document.getElementById('file-count');
    const cardsPerRowInput = document.getElementById('cards-per-row');
    const exportFormatSelect = document.getElementById('export-format');
    const exportScaleInput = document.getElementById('export-scale');
    const exportBtn = document.getElementById('export-btn');
    const previewCanvas = document.getElementById('preview-canvas');
    const previewContainer = document.getElementById('preview-container');
    const emptyState = document.getElementById('empty-state');
    const widthValue = document.getElementById('width-value');
    const heightValue = document.getElementById('height-value');
    const dropArea = document.getElementById('uploadArea');
    // 添加图片网格容器
    const previewGrid = document.getElementById('preview-grid');
    // 添加JPG质量控制元素
    const jpgQualityContainer = document.getElementById('jpg-quality-container');
    const jpgQualityInput = document.getElementById('jpg-quality');
    // 排序选择器和按钮
    const sortSelect = document.getElementById('sort-select');
    const sortBtn = document.getElementById('sort-btn');

    // 主题切换元素
    const themeWhiteBtn = document.getElementById('theme-white');
    const themeBlackBtn = document.getElementById('theme-black');
    const themeDarkGrayBtn = document.getElementById('theme-dark-gray');

    // 全局变量
    let uploadedImages = []; // 存储{name, img, size, time, count}对象
    let cardWidth = 0;
    let cardHeight = 0;
    let draggedIndex = -1; // 拖动项索引
    const ctx = previewCanvas.getContext('2d');

    // 主题切换功能
    function setTheme(theme) {
        // 移除所有主题类
        document.body.classList.remove('theme-white', 'theme-black', 'theme-dark-gray');
        // 添加当前主题类
        document.body.classList.add(`theme-${theme}`);
        // 保存主题到localStorage
        localStorage.setItem('theme', theme);
        // 更新所有需要动态设置的元素
        document.querySelectorAll('input, select').forEach(el => {
            el.style.backgroundColor = 'var(--input-bg)';
            el.style.borderColor = 'var(--border-color)';
            el.style.color = 'var(--text-color)';
        });
        document.querySelectorAll('h2').forEach(el => {
            el.style.color = 'var(--text-color)';
        });
    }

    // 初始化主题
    const savedTheme = localStorage.getItem('theme') || 'dark-gray';
    setTheme(savedTheme);

    // 主题按钮事件监听
    themeWhiteBtn.addEventListener('click', () => setTheme('white'));
    themeBlackBtn.addEventListener('click', () => setTheme('black'));
    themeDarkGrayBtn.addEventListener('click', () => setTheme('dark-gray'));

    // 事件监听
    fileInput.addEventListener('change', handleFileSelect);
    // 将原事件监听
    cardsPerRowInput.addEventListener('input', updatePreview);
    
    // 修改为直接触发两个函数
    cardsPerRowInput.addEventListener('input', () => {
        updatePreview();
        updateExportDimensions(); // 确保无论预览是否更新都计算尺寸
    });
    exportScaleInput.addEventListener('input', updateExportDimensions);
    exportBtn.addEventListener('click', exportImage);
    // 添加导出格式变化监听
    exportFormatSelect.addEventListener('change', function() {
        if (this.value === 'jpg') {
            jpgQualityContainer.classList.remove('hidden');
        } else {
            jpgQualityContainer.classList.add('hidden');
        }
    });
    // 排序按钮事件监听
    sortBtn.addEventListener('click', sortImages);
    
    // 拖放功能
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight() {
        dropArea.classList.add('dragover');
    }
    
    function unhighlight() {
        dropArea.classList.remove('dragover');
    }
    
    dropArea.addEventListener('drop', handleDrop, false);
    
    // 在handleDrop函数后添加
    function handleImageUrl(url) {
        // 检查是否已达到最大上传数量
        if (uploadedImages.length >= 70) {
            alert('最多只能上传70张图片');
            return;
        }
        
        // 创建临时图片对象
        const img = new Image();
        img.crossOrigin = 'anonymous'; // 处理跨域图片
        
        img.onload = function() {
            // 将图片转换为Blob
            canvas.toBlob(function(blob) {
                // 创建File对象
                const file = new File([blob], 'drag-image-' + Date.now() + '.png', {
                    type: 'image/png',
                    lastModified: Date.now()
                });
                
                // 使用现有handleFiles处理
                handleFiles([file]);
            }, 'image/png');
        };
        
        img.onerror = function() {
            alert('无法加载拖放的图片，请确保图片URL有效且允许跨域访问');
        };
        
        img.src = url;
        
        // 创建canvas用于图片转换
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
    }
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        // 处理文件拖放
        if (files.length > 0) {
            handleFiles(files);
        } 
        // 处理URL拖放
        else {
            const url = dt.getData('text/uri-list');
            if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
                handleImageUrl(url);
            }
        }
    }
    
    // 文件选择处理
    function handleFileSelect(e) {
        const files = e.target.files;
        handleFiles(files);
    }
    
    // 文件处理
    function handleFiles(files) {
        if (files.length === 0) return;
        
        // 限制最多70张图片
        const maxFiles = 70;
        const filesToProcess = Array.from(files).slice(0, maxFiles - uploadedImages.length);
        
        if (filesToProcess.length === 0) {
            alert('最多只能上传70张图片');
            return;
        }
        
        // 创建临时数组存储新上传的图片，用于排序
        const newImages = [];
        
        filesToProcess.forEach(file => {
            if (!file.type.match('image.*')) {
                alert('请只上传图片文件');
                return;
            }
            
            const reader = new FileReader();
            
            reader.onload = function(e) {
                const img = new Image();
                img.onload = function() {
                    // 移除图片尺寸一致性检查
                    if (uploadedImages.length === 0 && newImages.length === 0) {
                        cardWidth = img.width;
                        cardHeight = img.height;
                    }
                    
                    // 存储文件名、图片对象、文件大小、上传时间和初始数量
                    newImages.push({ name: file.name, img: img, size: file.size, time: file.lastModified, count: 1 });
                    
                    // 所有新图片加载完成后再添加和排序
                    if (newImages.length === filesToProcess.length) {
                        // 添加新图片并按文件名排序
                        uploadedImages = [...uploadedImages, ...newImages]
                            .sort((a, b) => a.name.localeCompare(b.name));
                        
                        // 修复：基于排序后的第一张图片设置卡牌尺寸
                        if (uploadedImages.length > 0) {
                            cardWidth = uploadedImages[0].img.width;
                            cardHeight = uploadedImages[0].img.height;
                        }
                        
                        updateFileCount();
                        updatePreview();
                        updateExportDimensions();
                        exportBtn.disabled = false;
                        sortBtn.disabled = false;
                    }
                };
                img.src = e.target.result;
            };
            
            reader.readAsDataURL(file);
        });
    }
    
    // 更新文件计数
    function updateFileCount() {
        let totalCount = 0;
        uploadedImages.forEach(item => {
            totalCount += item.count;
        });
        fileCount.textContent = `已选择: ${totalCount}张图片`;
    }
    
    // 更新预览
    function updatePreview() {
        if (uploadedImages.length === 0) {
            previewGrid.classList.add('hidden');
            emptyState.classList.remove('hidden');
            return;
        }
        
        const cardsPerRow = parseInt(cardsPerRowInput.value) || 5;
        // 设置网格列数
        previewGrid.style.gridTemplateColumns = `repeat(${cardsPerRow}, 1fr)`;
        
        // 清空现有内容
        previewGrid.innerHTML = '';
        
        // 创建图片预览项
        let globalIndex = 0;
        uploadedImages.forEach((item, originalIndex) => {
            // 为每个图片创建对应数量的预览项
            for (let i = 0; i < item.count; i++) {
                const img = item.img;
                const previewItem = document.createElement('div');
                previewItem.className = 'preview-item relative cursor-move transition-opacity';
                previewItem.draggable = true;
                
                // 保存原始图片索引和重复计数
                previewItem.dataset.originalIndex = originalIndex;
                previewItem.dataset.duplicateCount = i;
                
                // 添加拖动事件监听
                // 使用闭包捕获当前globalIndex值
                previewItem.addEventListener('dragstart', (function(currentGlobalIndex) {
                    return function(e) {
                        draggedIndex = currentGlobalIndex;
                        previewItem.classList.add('opacity-50');
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', currentGlobalIndex);
                    };
                })(globalIndex));
                
                previewItem.addEventListener('dragend', () => {
                    previewItem.classList.remove('opacity-50');
                    draggedIndex = -1;
                    // 移除所有拖放相关类
                    document.querySelectorAll('.preview-item').forEach(el => {
                        el.classList.remove('drag-over', 'drag-over-before', 'drag-over-after');
                    });
                });
                
                previewItem.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (globalIndex !== draggedIndex) {
                        // 移除其他项的拖放样式
                        document.querySelectorAll('.preview-item').forEach(el => {
                            el.classList.remove('drag-over', 'drag-over-before', 'drag-over-after');
                        });
                        // 添加拖放样式
                        previewItem.classList.add('drag-over');
                    }
                });
                
                previewItem.addEventListener('dragleave', () => {
                    previewItem.classList.remove('drag-over', 'drag-over-before', 'drag-over-after');
                });
                
                previewItem.addEventListener('drop', (e) => {
                    e.preventDefault();
                    if (draggedIndex !== -1 && draggedIndex !== globalIndex) {
                        // 获取拖放的元素
                        const draggedElement = document.querySelector(`[data-global-index="${draggedIndex}"]`);
                        if (draggedElement) {
                            // 获取原始图片索引
                            const draggedOriginalIndex = parseInt(draggedElement.dataset.originalIndex);
                            const targetOriginalIndex = parseInt(previewItem.dataset.originalIndex);
                            
                            // 交换图片顺序
                            const temp = uploadedImages[draggedOriginalIndex];
                            uploadedImages.splice(draggedOriginalIndex, 1);
                            uploadedImages.splice(targetOriginalIndex, 0, temp);
                            
                            updatePreview();
                        }
                    }
                });
                
                // 创建卡片内容容器
                const cardContent = document.createElement('div');
                cardContent.className = 'card-content';
                
                // 添加图片元素
                const imgElement = document.createElement('img');
                imgElement.src = img.src;
                imgElement.className = 'w-full h-auto object-contain';
                cardContent.appendChild(imgElement);
                
                // 创建自适应内容容器
                const adaptiveContent = document.createElement('div');
                adaptiveContent.className = 'adaptive-content';
                
                // 创建文件名容器
                const filenameContainer = document.createElement('div');
                filenameContainer.className = 'filename-container';
                
                // 添加序号显示
                const indexElement = document.createElement('div');
                indexElement.className = 'text-[var(--text-color)] flex items-center justify-center font-bold text-sm w-6 h-6';
                indexElement.textContent = `${globalIndex + 1}`;
                filenameContainer.appendChild(indexElement);
                
                // 添加文件名显示，只在第一个重复项显示
                if (i === 0) {
                    const nameElement = document.createElement('div');
                    nameElement.className = 'truncate text-xs text-[var(--text-color)] px-2';
                    nameElement.textContent = item.name;
                    filenameContainer.appendChild(nameElement);
                    
                    // 添加到自适应内容容器
                    adaptiveContent.appendChild(filenameContainer);
                    
                    // 添加数量控制区域
                    const countContainer = document.createElement('div');
                    countContainer.className = 'count-container';
                    
                    const countLabel = document.createElement('span');
                    // 将字体大小从 text-xs 改为 text-sm 放大标签文字
                    countLabel.className = 'text-sm text-[var(--text-color)] mr-1';
                    countLabel.textContent = '数量:';
                    countContainer.appendChild(countLabel);
                    
                    const countInput = document.createElement('input');
                    countInput.type = 'number';
                    countInput.min = 1;
                    countInput.value = item.count;
                    // 将宽度从 w-10 改为 w-12 放大输入框，字体大小从 text-xs 改为 text-sm 放大文字
                    countInput.className = 'w-12 px-1 py-0.5 bg-[var(--input-bg)] border border-[var(--border-color)] rounded text-[var(--text-color)] text-sm focus:outline-none focus:ring-1 focus:ring-blue-500';
                    countInput.addEventListener('input', (e) => {
                        const newCount = parseInt(e.target.value) || 1;
                        item.count = newCount;
                        updateFileCount();
                        updatePreview();
                        updateExportDimensions();
                    });
                    countContainer.appendChild(countInput);
                    
                    adaptiveContent.appendChild(countContainer);
                } else {
                    // 重复项只显示序号
                    adaptiveContent.appendChild(filenameContainer);
                }
                
                cardContent.appendChild(adaptiveContent);
                previewItem.appendChild(cardContent);
                
                // 只在第一个重复项添加删除按钮
                if (i === 0) {
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'delete-btn';
                    deleteBtn.innerHTML = '<i class="fa fa-trash"></i>';
                    deleteBtn.addEventListener('click', () => {
                        uploadedImages.splice(originalIndex, 1);
                        updateFileCount();
                        updatePreview();
                        updateExportDimensions();
                        if (uploadedImages.length === 0) {
                            exportBtn.disabled = true;
                            sortBtn.disabled = true;
                        }
                    });
                    previewItem.appendChild(deleteBtn);
                }
                
                // 添加全局索引属性
                previewItem.dataset.globalIndex = globalIndex;
                
                previewGrid.appendChild(previewItem);
                globalIndex++;
            }
        });
        
        emptyState.classList.add('hidden');
        previewGrid.classList.remove('hidden');
    }
    
    // 更新导出尺寸显示
    function updateExportDimensions() {
        if (cardWidth === 0 || cardHeight === 0 || uploadedImages.length === 0) {
            widthValue.textContent = '0';
            heightValue.textContent = '0';
            return;
        }
        
        const cardsPerRow = parseInt(cardsPerRowInput.value) || 5;
        const scale = parseInt(exportScaleInput.value) / 100;
        let totalCount = 0;
        uploadedImages.forEach(item => {
            totalCount += item.count;
        });
        // 这里原代码未完成，需要补充完整计算逻辑
    }

    // 原代码中缺少的函数定义
    function sortImages() {
        const sortBy = sortSelect.value;
        switch (sortBy) {
            case 'name-asc':
                uploadedImages.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'name-desc':
                uploadedImages.sort((a, b) => b.name.localeCompare(a.name));
                break;
            case 'size-asc':
                uploadedImages.sort((a, b) => a.size - b.size);
                break;
            case 'size-desc':
                uploadedImages.sort((a, b) => b.size - a.size);
                break;
            case 'time-asc':
                uploadedImages.sort((a, b) => a.time - b.time);
                break;
            case 'time-desc':
                uploadedImages.sort((a, b) => b.time - a.time);
                break;
        }
        updatePreview();
    }

    function exportImage() {
        // 这里需要补充导出图片的具体逻辑
    }
});