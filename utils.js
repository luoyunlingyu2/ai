/**
 * 工具函数
 */

// 主题初始化和切换
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = elements.themeToggleBtn.querySelector('i');
    if (theme === 'dark') {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    } else {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
    }
}

// 格式化消息内容（支持Markdown）
function formatMessageContent(content) {
    if (!content) return '';
    
    // 简单的Markdown解析
    let formatted = escapeHtml(content);
    
    // 代码块
    formatted = formatted.replace(/```(.+?)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
    formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
    // 内联代码
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // 粗体
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // 斜体
    formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
    
    // 链接
    formatted = formatted.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    // 换行
    formatted = formatted.replace(/\n/g, '<br>');
    
    return formatted;
}

// HTML转义
function escapeHtml(text) {
    if (!text) return '';
    
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// 生成唯一ID
function generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// 格式化时间
function formatTime(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    if (isToday) {
        return `今天 ${hours}:${minutes}`;
    } else {
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${month}-${day} ${hours}:${minutes}`;
    }
}

// 估算tokens数量
function estimateTokens(text) {
    if (!text) return 0;
    
    // 粗略估算: 英文约4字符/token，中文约2字符/token
    const englishChars = text.replace(/[\u4e00-\u9fa5]/g, '').length;
    const chineseChars = text.length - englishChars;
    return Math.ceil(englishChars / 4 + chineseChars / 2);
}

// 更新用户消息统计
function updateUserStats(text) {
    const charCount = text.length;
    const tokenCount = estimateTokens(text);
    elements.userStats.innerHTML = `<i class="fas fa-user"></i> ${charCount}字符 (${tokenCount} tokens)`;
}

// 更新助手消息统计
function updateAssistantStats(text) {
    const charCount = text.length;
    const tokenCount = estimateTokens(text);
    elements.assistantStats.innerHTML = `<i class="fas fa-robot"></i> ${charCount}字符 (${tokenCount} tokens)`;
}

// 从字符串截取第一句话作为对话标题
function extractTitle(text, maxLength = 30) {
    if (!text) return '新对话';
    
    // 尝试获取第一个句子
    let title = text.split(/[。.!?！？]/)[0].trim();
    
    // 如果为空或太短，取前面部分
    if (!title || title.length < 5) {
        title = text.trim();
    }
    
    // 限制长度
    if (title.length > maxLength) {
        title = title.substring(0, maxLength) + '...';
    }
    
    return title;
}

// 检测是否移动设备
function isMobileDevice() {
    return window.innerWidth <= 768;
}

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// 复制文本到剪贴板
function copyToClipboard(text) {
    // 创建临时元素
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    
    // 选择并复制
    textArea.select();
    let success = false;
    try {
        success = document.execCommand('copy');
    } catch (err) {
        console.error('复制失败:', err);
    }
    
    // 移除临时元素
    document.body.removeChild(textArea);
    return success;
}
