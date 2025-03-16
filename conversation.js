/**
 * 对话管理功能
 */

// 加载对话
function loadConversations() {
    try {
        const saved = localStorage.getItem('conversations');
        if (saved) {
            conversations = JSON.parse(saved);
        }
        
        // 加载当前对话ID
        currentConversationId = localStorage.getItem('currentConversationId');
        
        renderConversationsList();
        
        // 如果有当前对话，显示它
        if (currentConversationId) {
            const conversation = conversations.find(c => c.id === currentConversationId);
            if (conversation) {
                selectConversation(currentConversationId);
            } else {
                currentConversationId = null;
                localStorage.removeItem('currentConversationId');
            }
        }
    } catch (error) {
        console.error('加载对话失败:', error);
        conversations = [];
    }
}

// 渲染对话列表
function renderConversationsList() {
    const list = elements.conversationsList;
    list.innerHTML = '';
    
    if (conversations.length === 0) {
        list.innerHTML = '<div class="empty-list">无历史对话</div>';
        return;
    }
    
    // 按最后修改时间排序
    const sortedConversations = [...conversations].sort((a, b) => {
        const aTime = a.messages.length > 0 ? a.messages[a.messages.length - 1].timestamp : a.createdAt;
        const bTime = b.messages.length > 0 ? b.messages[b.messages.length - 1].timestamp : b.createdAt;
        return bTime - aTime;
    });
    
    sortedConversations.forEach(conversation => {
        const item = document.createElement('div');
        item.className = 'conversation-item';
        item.dataset.id = conversation.id;
        
        if (conversation.id === currentConversationId) {
            item.classList.add('active');
        }
        
        item.innerHTML = `
            <div class="conversation-icon"><i class="fas fa-comment"></i></div>
            <div class="conversation-title">${conversation.title}</div>
            <div class="conversation-menu"><i class="fas fa-ellipsis-v"></i></div>
        `;
        
        // 点击选择对话
        item.addEventListener('click', () => selectConversation(conversation.id));
        
        // 上下文菜单
        const menuIcon = item.querySelector('.conversation-menu');
        menuIcon.addEventListener('click', e => {
            e.stopPropagation();
            showConversationMenu(e, conversation.id);
        });
        
        list.appendChild(item);
    });
}

// 创建新对话
function createNewConversation() {
    const newConversation = {
        id: generateId(),
        title: '新对话',
        createdAt: Date.now(),
        messages: [],
        channelId: currentChannelId,
        modelId: null
    };
    
    if (currentChannelId) {
        const channel = apiChannels.find(c => c.id === currentChannelId);
        if (channel && channel.models && channel.models.length > 0) {
            newConversation.modelId = channel.models[0].id;
        }
    }
    
    conversations.unshift(newConversation);
    saveConversations();
    
    selectConversation(newConversation.id);
    renderConversationsList();
}

// 选择对话
function selectConversation(conversationId) {
    currentConversationId = conversationId;
    localStorage.setItem('currentConversationId', conversationId);
    
    // 更新UI
    document.querySelectorAll('.conversation-item').forEach(item => {
        if (item.dataset.id === conversationId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    const conversation = conversations.find(c => c.id === conversationId);
    if (!conversation) return;
    
    // 更新对话标题
    elements.currentChatTitle.textContent = conversation.title;
    
    // 渲染消息
    renderChatMessages(conversation);
    
    // 设置API渠道和模型
    if (conversation.channelId) {
        currentChannelId = conversation.channelId;
        elements.apiSelector.value = currentChannelId;
        
        const channel = apiChannels.find(c => c.id === currentChannelId);
        if (channel) {
            renderModelSelector(channel);
            elements.modelSelector.value = conversation.modelId || '';
            checkAndUpdateBalance();
        }
    }
    
    // 关闭侧边栏(移动设备)
    elements.sidebar.classList.remove('active');
}

// 渲染对话消息
function renderChatMessages(conversation) {
    const chatMessages = elements.chatMessages;
    chatMessages.innerHTML = '';
    
    if (!conversation || conversation.messages.length === 0) {
        chatMessages.innerHTML = `
            <div class="welcome-screen">
                <div class="welcome-logo"><i class="fas fa-robot"></i></div>
                <h2>欢迎使用AI聊天助手</h2>
                <p>开始新的对话，在下方输入框输入您的问题</p>
            </div>
        `;
        return;
    }
    
    conversation.messages.forEach(message => {
        renderMessage(message);
    });
    
    scrollToBottom();
    
    // 更新统计
    if (conversation.messages.length > 0) {
        const lastUserMessage = [...conversation.messages].reverse().find(m => m.role === 'user');
        const lastAssistantMessage = [...conversation.messages].reverse().find(m => m.role === 'assistant');
        
        if (lastUserMessage) {
            updateUserStats(lastUserMessage.content);
        }
        
        if (lastAssistantMessage) {
            updateAssistantStats(lastAssistantMessage.content);
        }
    }
}

// 渲染单条消息
function renderMessage(message) {
    const chatMessages = elements.chatMessages;
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.role}`;
    messageElement.dataset.id = message.id;
    
    const formattedContent = formatMessageContent(message.content);
    
    messageElement.innerHTML = `
        <div class="message-avatar">
            <i class="fas ${message.role === 'user' ? 'fa-user' : 'fa-robot'}"></i>
        </div>
        <div class="message-body">
            <div class="message-content">${formattedContent}</div>
            <div class="message-time">${formatTime(message.timestamp)}</div>
        </div>
    `;
    
    chatMessages.appendChild(messageElement);
    scrollToBottom();
    
    return messageElement;
}

// 删除对话
function deleteConversation(conversationId) {
    const index = conversations.findIndex(c => c.id === conversationId);
    if (index === -1) return;
    
    conversations.splice(index, 1);
    saveConversations();
    
    // 如果删除的是当前对话，选择新的对话
    if (currentConversationId === conversationId) {
        if (conversations.length > 0) {
            selectConversation(conversations[0].id);
        } else {
            currentConversationId = null;
            localStorage.removeItem('currentConversationId');
            elements.chatMessages.innerHTML = `
                <div class="welcome-screen">
                    <div class="welcome-logo"><i class="fas fa-robot"></i></div>
                    <h2>欢迎使用AI聊天助手</h2>
                    <p>开始新的对话，点击左上角的"新对话"按钮</p>
                </div>
            `;
        }
    }
    
    renderConversationsList();
}

// 重命名对话
function renameConversation(conversationId, newTitle) {
    const conversation = conversations.find(c => c.id === conversationId);
    if (!conversation) return;
    
    conversation.title = newTitle;
    saveConversations();
    
    renderConversationsList();
    
    if (currentConversationId === conversationId) {
        elements.currentChatTitle.textContent = newTitle;
    }
}

// 保存对话
function saveConversations() {
    localStorage.setItem('conversations', JSON.stringify(conversations));
}
