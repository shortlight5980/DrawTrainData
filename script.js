// 应用状态
const appState = {
    currentImageSize: { width: 32, height: 32 },
    isDrawing: false,
    currentCanvas: null,
    imageGallery: [],
    cellSize: 0,
    brushSize: 1, // 画笔粗细
    speedAdjust: false, // 是否跟随速度调整画笔粗细
    lastMousePos: null, // 上一次鼠标位置
    lastMouseTime: 0 // 上一次鼠标移动时间
};

// 本地存储键名
const STORAGE_KEY = 'dtd-workspace';

// 初始化函数
function init() {
    // 加载本地存储数据
    loadFromStorage();
    
    // 初始化Canvas
    initCanvas();
    
    // 绑定事件监听器
    bindEventListeners();
    
    // 渲染图片夹
    renderGallery();
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);

// Canvas初始化
function initCanvas() {
    const canvas = document.getElementById('drawingCanvas');
    const ctx = canvas.getContext('2d');
    
    // 设置Canvas大小
    const maxCanvasSize = 600;
    const { width, height } = appState.currentImageSize;
    
    // 计算单元格大小
    appState.cellSize = Math.min(
        Math.floor(maxCanvasSize / width),
        Math.floor(maxCanvasSize / height)
    );
    
    // 设置Canvas实际尺寸
    canvas.width = width * appState.cellSize;
    canvas.height = height * appState.cellSize;
    
    // 绘制网格
    drawGrid(ctx);
    
    // 初始化空白图像数据
    appState.currentCanvas = createEmptyCanvas(width, height);
}

// 事件监听器绑定
function bindEventListeners() {
    // 尺寸选择事件
    document.getElementById('sizeSelect').addEventListener('change', handleSizeChange);
    document.getElementById('applySizeBtn').addEventListener('click', applyCustomSize);
    
    // Canvas事件
    const canvas = document.getElementById('drawingCanvas');
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    
    // 控制按钮事件
    document.getElementById('saveBtn').addEventListener('click', saveToGallery);
    document.getElementById('resetBtn').addEventListener('click', resetCanvas);
    document.getElementById('clearGalleryBtn').addEventListener('click', clearGallery);
    
    // 导出事件
    document.getElementById('exportBtn').addEventListener('click', exportDataset);
    
    // 画笔设置事件
    document.getElementById('brushSize').addEventListener('input', handleBrushSizeChange);
    document.getElementById('speedAdjust').addEventListener('change', handleSpeedAdjustChange);
    
    // 导出格式切换事件
    const exportFormats = document.querySelectorAll('input[name="exportFormat"]');
    exportFormats.forEach(format => {
        format.addEventListener('change', handleExportFormatChange);
    });
}

// 尺寸选择事件处理
function handleSizeChange() {
    const sizeSelect = document.getElementById('sizeSelect');
    const customSize = document.getElementById('customSize');
    
    if (sizeSelect.value === 'custom') {
        customSize.style.display = 'inline-block';
    } else {
        customSize.style.display = 'none';
        
        // 应用预设尺寸
        const [width, height] = sizeSelect.value.split('x').map(Number);
        applyNewSize(width, height);
    }
}

// 应用自定义尺寸
function applyCustomSize() {
    const widthInput = document.getElementById('widthInput');
    const heightInput = document.getElementById('heightInput');
    
    const width = parseInt(widthInput.value);
    const height = parseInt(heightInput.value);
    
    if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
        alert('请输入有效的宽高值');
        return;
    }
    
    applyNewSize(width, height);
}

// 应用新尺寸
function applyNewSize(width, height) {
    // 如果图片夹有图片，弹出确认提示
    if (appState.imageGallery.length > 0) {
        if (!confirm('中途更改图片大小会清空图片夹，是否继续？')) {
            // 恢复原来的选择
            const sizeSelect = document.getElementById('sizeSelect');
            sizeSelect.value = `${appState.currentImageSize.width}x${appState.currentImageSize.height}`;
            handleSizeChange();
            return;
        }
        
        // 清空图片夹
        appState.imageGallery = [];
        saveToStorage();
        renderGallery();
    }
    
    // 更新尺寸并重新初始化Canvas
    appState.currentImageSize = { width, height };
    initCanvas();
    resetCanvas();
}

// 鼠标事件处理
// 画笔大小调整事件处理
function handleBrushSizeChange() {
    appState.brushSize = parseInt(document.getElementById('brushSize').value);
    document.getElementById('brushSizeValue').textContent = appState.brushSize;
}

// 速度调整事件处理
function handleSpeedAdjustChange() {
    appState.speedAdjust = document.getElementById('speedAdjust').checked;
}

// 导出格式切换事件处理
function handleExportFormatChange() {
    const selectedFormat = document.querySelector('input[name="exportFormat"]:checked').value;
    const txtExportOptions = document.getElementById('txtExportOptions');
    txtExportOptions.style.display = selectedFormat === 'txt' ? 'block' : 'none';
}

// 计算绘画速度并返回当前画笔大小
function calculateBrushSize(currentMousePos) {
    if (!appState.speedAdjust || !appState.lastMousePos) {
        return appState.brushSize;
    }
    
    const now = Date.now();
    const timeDiff = now - appState.lastMouseTime;
    if (timeDiff === 0) return appState.brushSize;
    
    const distance = Math.sqrt(
        Math.pow(currentMousePos.x - appState.lastMousePos.x, 2) +
        Math.pow(currentMousePos.y - appState.lastMousePos.y, 2)
    );
    
    // 计算速度 (像素/毫秒)
    const speed = distance / timeDiff;
    
    // 根据速度调整画笔大小
    // 速度越快，画笔越小；速度越慢，画笔越大
    const minSize = 1;
    const maxSize = Math.max(10, appState.brushSize * 2);
    let adjustedSize = maxSize - (speed * 5);
    adjustedSize = Math.max(minSize, Math.min(maxSize, adjustedSize));
    
    return Math.round(adjustedSize);
}

// Canvas事件处理
function handleMouseDown(e) {
    appState.isDrawing = true;
    const rect = document.getElementById('drawingCanvas').getBoundingClientRect();
    appState.lastMousePos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
    appState.lastMouseTime = Date.now();
    drawCell(e);
}

function handleMouseMove(e) {
    if (appState.isDrawing) {
        drawCell(e);
    }
}

function handleMouseUp() {
    appState.isDrawing = false;
    appState.lastMousePos = null;
}

// 绘制单元格
function drawCell(e) {
    const canvas = document.getElementById('drawingCanvas');
    const rect = canvas.getBoundingClientRect();
    const currentMousePos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
    
    // 计算当前画笔大小
    const currentBrushSize = calculateBrushSize(currentMousePos);
    
    // 计算对应的网格坐标
    const gridX = Math.floor(currentMousePos.x / appState.cellSize);
    const gridY = Math.floor(currentMousePos.y / appState.cellSize);
    
    // 绘制圆形区域
    const radius = currentBrushSize / 2;
    
    // 计算需要绘制的网格范围
    const minX = Math.max(0, Math.floor(gridX - radius));
    const maxX = Math.min(appState.currentImageSize.width - 1, Math.ceil(gridX + radius));
    const minY = Math.max(0, Math.floor(gridY - radius));
    const maxY = Math.min(appState.currentImageSize.height - 1, Math.ceil(gridY + radius));
    
    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            // 计算该网格点到圆心的距离
            const distance = Math.sqrt(Math.pow(x - gridX, 2) + Math.pow(y - gridY, 2));
            
            // 如果距离小于等于半径，则填充该网格点
            if (distance <= radius) {
                appState.currentCanvas[y][x] = 1; // 1表示黑色
                drawSingleCell(x, y);
            }
        }
    }
    
    // 更新上一次鼠标位置和时间
    appState.lastMousePos = currentMousePos;
    appState.lastMouseTime = Date.now();
}

// 保存到图片夹
function saveToGallery() {
    // 深拷贝当前Canvas数据
    const imageData = JSON.parse(JSON.stringify(appState.currentCanvas));
    
    // 添加到图片夹
    appState.imageGallery.push({
        id: `img_${Date.now()}`,
        data: imageData,
        width: appState.currentImageSize.width,
        height: appState.currentImageSize.height,
        createdAt: new Date().toISOString()
    });
    
    // 保存到本地存储
    saveToStorage();
    
    // 渲染图片夹
    renderGallery();
    
    // 重置当前Canvas
    resetCanvas();
}

// 重置画板
function resetCanvas() {
    const canvas = document.getElementById('drawingCanvas');
    const ctx = canvas.getContext('2d');
    
    // 清除Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 重新绘制网格
    drawGrid(ctx);
    
    // 重新初始化空白图像数据
    const { width, height } = appState.currentImageSize;
    appState.currentCanvas = createEmptyCanvas(width, height);
}

// 清空图片夹
function clearGallery() {
    if (appState.imageGallery.length === 0) {
        alert('图片夹已经是空的');
        return;
    }
    
    if (confirm('确定要清空图片夹吗？')) {
        appState.imageGallery = [];
        saveToStorage();
        renderGallery();
    }
}

// 渲染图片夹
function renderGallery() {
    const container = document.getElementById('galleryContainer');
    const count = document.getElementById('imageCount');
    
    // 更新图片数量
    count.textContent = appState.imageGallery.length;
    
    // 清空容器
    container.innerHTML = '';
    
    // 渲染每个图片
    appState.imageGallery.forEach((image, index) => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        
        // 创建缩略图画布
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = 60;
        thumbCanvas.height = 60;
        const thumbCtx = thumbCanvas.getContext('2d');
        
        // 绘制缩略图
        const thumbCellSize = Math.min(thumbCanvas.width / image.width, thumbCanvas.height / image.height);
        image.data.forEach((row, y) => {
            row.forEach((cell, x) => {
                if (cell === 1) {
                    thumbCtx.fillStyle = 'black';
                    thumbCtx.fillRect(
                        x * thumbCellSize,
                        y * thumbCellSize,
                        thumbCellSize,
                        thumbCellSize
                    );
                }
            });
        });
        
        item.appendChild(thumbCanvas);
        container.appendChild(item);
    });
}

// 本地存储实现
function saveToStorage() {
    const data = {
        imageGallery: appState.imageGallery,
        currentImageSize: appState.currentImageSize,
        lastModified: new Date().toISOString()
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadFromStorage() {
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (storedData) {
        const data = JSON.parse(storedData);
        appState.imageGallery = data.imageGallery || [];
        appState.currentImageSize = data.currentImageSize || { width: 32, height: 32 };
    }
}

// 导出数据集
async function exportDataset() {
    const format = document.querySelector('input[name="exportFormat"]:checked').value;
    const zip = new JSZip();
    
    if (appState.imageGallery.length === 0) {
        alert('图片夹为空，请先绘制图片！');
        return;
    }
    
    if (format === 'bmp') {
        // 导出为BMP
        for (let i = 0; i < appState.imageGallery.length; i++) {
            const image = appState.imageGallery[i];
            const bmpData = await convertToBMP(image);
            zip.file(`image_${i}.bmp`, bmpData);
        }
    } else {
        // 导出为TXT
        const txtExportType = document.querySelector('input[name="txtExportType"]:checked').value;
        
        if (txtExportType === 'multiple') {
            // 保存为多个TXT文件
            for (let i = 0; i < appState.imageGallery.length; i++) {
                const image = appState.imageGallery[i];
                const txtContent = JSON.stringify(image.data);
                zip.file(`image_${i}.txt`, txtContent);
            }
        } else {
            // 保存为一个TXT文件，使用三维数组
            const allImagesData = [];
            for (const image of appState.imageGallery) {
                allImagesData.push(image.data);
            }
            const txtContent = JSON.stringify(allImagesData);
            zip.file('dataset.txt', txtContent);
        }
    }
    
    // 生成ZIP文件并下载
    const zipContent = await zip.generateAsync({ type: 'blob' });
    const timestamp = new Date().getTime();
    saveAs(zipContent, `dtd-dataset-${timestamp}.zip`);
}

// 辅助函数

// 创建空白画布数据
function createEmptyCanvas(width, height) {
    const canvas = [];
    for (let y = 0; y < height; y++) {
        canvas[y] = [];
        for (let x = 0; x < width; x++) {
            canvas[y][x] = 0; // 0表示白色
        }
    }
    return canvas;
}

// 绘制网格
function drawGrid(ctx) {
    const { width, height } = appState.currentImageSize;
    const cellSize = appState.cellSize;
    
    ctx.strokeStyle = '#eee';
    ctx.lineWidth = 0.5;
    
    // 绘制垂直线
    for (let x = 0; x <= width; x++) {
        ctx.beginPath();
        ctx.moveTo(x * cellSize, 0);
        ctx.lineTo(x * cellSize, height * cellSize);
        ctx.stroke();
    }
    
    // 绘制水平线
    for (let y = 0; y <= height; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * cellSize);
        ctx.lineTo(width * cellSize, y * cellSize);
        ctx.stroke();
    }
}

// 绘制单个单元格
function drawSingleCell(x, y) {
    const canvas = document.getElementById('drawingCanvas');
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = 'black';
    ctx.fillRect(
        x * appState.cellSize,
        y * appState.cellSize,
        appState.cellSize,
        appState.cellSize
    );
    
    // 重绘单元格边框
    ctx.strokeStyle = '#eee';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(
        x * appState.cellSize,
        y * appState.cellSize,
        appState.cellSize,
        appState.cellSize
    );
}

// 转换为BMP格式
async function convertToBMP(image) {
    // 创建临时Canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = image.width;
    tempCanvas.height = image.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    // 绘制像素
    for (let y = 0; y < image.height; y++) {
        for (let x = 0; x < image.width; x++) {
            const color = image.data[y][x] === 1 ? '#000000' : '#FFFFFF';
            tempCtx.fillStyle = color;
            tempCtx.fillRect(x, y, 1, 1);
        }
    }
    
    // 转换为BMP
    return new Promise((resolve) => {
        tempCanvas.toBlob((blob) => {
            resolve(blob);
        }, 'image/bmp');
    });
}