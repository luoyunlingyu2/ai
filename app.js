/**
 * 应用主入口 - 初始化和核心功能
 */

// 全局变量
let currentConversationId = null;
let currentChannelId = null;
let conversations = [];
let apiChannels = [];
let isStreaming = false;
let startTime = 0;
let targetConversationId = null;

// DOM元素缓存
const elements = {};

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    // 缓存DOM元素
    cacheElements();
    
    // 初始化各模块
    initTheme();
    loadData();
    setupEventListeners();
});

// 缓存常用DOM元素
function cacheElements() {
    // 主要元素
    elements.sidebar = document.querySelector('.sidebar');
    elements.conversationsList = document.getElementById('conversations-list');
    elements.chatMessages = document.getElementById('chat-messages');
    elements.messageInput = document.getElementById('message-input');
    elements.sendBtn = document.getElementById('send-btn');
    elements.apiSelector = document.getElementById('api-selector');
    elements.modelSelector = document.getElementById('model-selector');
    elements.apiBalance = document.getElementById('api-balance');
    elements.currentChatTitle = document.getElementById('current-chat-title');
    
    // 按钮
    elements.newChatBtn = document.getElementById('new-chat-btn');
    elements.settingsBtn = document.getElementById('settings-btn');
    elements.themeToggleBtn = document.getElementById('theme-toggle-btn');
    elements.sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    elements.sidebarCloseBtn = document.getElementById('sidebar-close-btn');
    elements.addChannelBtn = document.getElementById('add-channel-btn');
    
    // 模态框
    elements.settingsModal = document.getElementById('settings-modal');
    elements.channelModal = document.getElementById('channel-modal');
    elements.confirmModal = document.getElementById('confirm-modal');
    elements.renameModal = document.getElementById('rename-modal');
    
    // 表单
    elements.channelForm = document.getElementById('channel-form');
    elements.apiChannelsList = document.getElementById('api-channels-list');
    
    // 统计
    elements.userStats = document.getElementById('user-stats');
    elements.assistantStats = document.getElementById('assistant-stats');
    elements.timeStats = document.getElementById('time-stats');
    
    // 上下文菜单
    elements.conversationMenu = document.getElementById('conversation-menu');
}

// 加载数据
function loadData() {
    loadApiChannels();
    loadConversations();
}

// 设置关键事件监听器
function setupEventListeners() {
    // 发送消息
    elements.sendBtn.addEventListener('click', sendMessage);
    elements.messageInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // 新建对话
    elements.newChatBtn.addEventListener('click', createNewConversation);
    
    // 打开设置
    elements.settingsBtn.addEventListener('click', openSettings);
    
    // 更多事件监听器在eventHandlers.js中设置
    setupUIEventListeners();
}

// 发送消息主函数
async function sendMessage() {
    if (isStreaming) return;
    
    const userInput = elements.messageInput.value.trim();
    if (!userInput) return;
    
    // 检查是否有当前对话和API渠道
    if (!currentConversationId) {
        createNewConversation();
    }
    
    if (!currentChannelId) {
        showErrorMessage('请先选择API渠道');
        return;
    }
    
    const conversation = conversations.find(c => c.id === currentConversationId);
    const channel = apiChannels.find(c => c.id === currentChannelId);
    
    if (!conversation || !channel) {
        showErrorMessage('无效的对话或API渠道');
        return;
    }
    
    // 清空输入框并调整高度
    elements.messageInput.value = '';
    elements.messageInput.style.height = 'auto';
    elements.sendBtn.disabled = true;
    
    // 添加用户消息
    const userMessage = {
        id: generateId(),
        role: 'user',
        content: userInput,
        timestamp: Date.now()
    };
    
    conversation.messages.push(userMessage);
    renderMessage(userMessage);
    updateUserStats(userInput);
    
    // 添加助手消息占位
    const assistantMessage = {
        id: generateId(),
        role: 'assistant',
        content: '',
        timestamp: Date.now()
    };
    
    conversation.messages.push(assistantMessage);
    const assistantElement = renderMessage(assistantMessage);
    
    // 保存对话
    saveConversations();
    
    // 开始计时
    startTime = Date.now();
    isStreaming = true;
    updateResponseTime();
    const timeInterval = setInterval(() => {
        if (isStreaming) {
            updateResponseTime();
        } else {
            clearInterval(timeInterval);
        }
    }, 100);
    
    try {
        // 调用API
        const response = await callAIAPI(channel, conversation, userMessage);
        
        // 处理流式响应
        await handleStreamResponse(
            response,
            (textDelta, fullText) => {
                // 更新UI
                assistantMessage.content = fullText;
                assistantElement.querySelector('.message-content').innerHTML = formatMessageContent(fullText);
                updateAssistantStats(fullText);
                scrollToBottom();
            },
            (finalText) => {
                // 完成
                isStreaming = false;
                saveConversations();
            }
        );
    } catch (error) {
        // 处理错误
        isStreaming = false;
        assistantMessage.content = `错误: ${error.message}`;
        assistantElement.querySelector('.message-content').innerHTML = 
            `<div class="error-message">${error.message}</div>`;
        saveConversations();
    }
}
