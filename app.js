// app.js - 主要应用逻辑

// 全局变量
let currentConversationId = null;
let conversations = [];
let apiChannels = [];
let currentChannelId = null;
let isStreaming = false;
let startTime = 0;

// DOM元素
let chatMessages, messageInput, sendBtn, newChatBtn, settingsBtn, apiChannelSelector,
    modelSelector, apiBalance, settingsModal, addChannelModal, addChannelForm, addChannelBtn,
    userStats, assistantStats, timeStats, showSidebarBtn, sidebar, confirmModal, toggleThemeBtn;

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    initializeElements();
    initializeApp();
});

// 获取DOM元素引用
function initializeElements() {
    chatMessages = document.getElementById('chat-messages');
    messageInput = document.getElementById('message-input');
    sendBtn = document.getElementById('send-btn');
    newChatBtn = document.getElementById('new-chat-btn');
    settingsBtn = document.getElementById('settings-btn');
    apiChannelSelector = document.getElementById('api-channel-selector');
    modelSelector = document.getElementById('model-selector');
    apiBalance = document.getElementById('api-balance');
    settingsModal = document.getElementById('settings-modal');
    addChannelModal = document.getElementById('add-channel-modal');
    addChannelForm = document.getElementById('add-channel-form');
    addChannelBtn = document.getElementById('add-channel-btn');
    userStats = document.getElementById('user-stats');
    assistantStats = document.getElementById('assistant-stats');
    timeStats = document.getElementById('time-stats');
    showSidebarBtn = document.getElementById('show-sidebar-btn');
    sidebar = document.querySelector('.sidebar');
    confirmModal = document.getElementById('confirm-modal');
    toggleThemeBtn = document.getElementById('toggle-theme-btn');
}

// 初始化应用
function initializeApp() {
    loadTheme();
    loadApiChannels();
    loadConversations();
    setupEventListeners();
}

// 设置事件监听器
function setupEventListeners() {
    // 发送消息
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // 自动调整文本框高度
    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + 'px';
    });

    // 新建对话
    newChatBtn.addEventListener('click', createNewConversation);

    // 打开设置
    settingsBtn.addEventListener('click', () => {
        renderChannelsList();
        settingsModal.style.display = 'block';
    });

    // 添加新渠道
    addChannelBtn.addEventListener('click', () => {
        // 重置表单
        addChannelForm.reset();
        addChannelForm.dataset.mode = 'add';
        delete addChannelForm.dataset.channelId;
        document.getElementById('channel-modal-title').textContent = '添加API渠道';
        addChannelModal.style.display = 'block';
    });

    // 关闭模态框
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            settingsModal.style.display = 'none';
            addChannelModal.style.display = 'none';
            confirmModal.style.display = 'none';
            
            // 重置表单
            addChannelForm.reset();
            addChannelForm.dataset.mode = 'add';
            delete addChannelForm.dataset.channelId;
        });
    });

    // 点击模态框外部关闭
    window.addEventListener('click', (e) => {
        if (e.target === settingsModal) settingsModal.style.display = 'none';
        if (e.target === addChannelModal) addChannelModal.style.display = 'none';
        if (e.target === confirmModal) confirmModal.style.display = 'none';
    });

    // 表单提交
    addChannelForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('channel-name').value;
        const endpoint = document.getElementById('api-endpoint').value;
        const key = document.getElementById('api-key').value;
        const models = document.getElementById('api-models').value || 'default-model';
        
        if (e.target.dataset.mode === 'edit') {
            // 更新现有渠道
            const channelId = e.target.dataset.channelId;
            updateApiChannel(channelId, name, endpoint, key, models);
        } else {
            // 添加新渠道
            addApiChannel(name, endpoint, key, models);
        }
        
        addChannelForm.reset();
        addChannelForm.dataset.mode = 'add';
        delete addChannelForm.dataset.channelId;
        addChannelModal.style.display = 'none';
    });

    // API渠道选择器变化
    apiChannelSelector.addEventListener('change', () => {
        currentChannelId = apiChannelSelector.value;
        saveCurrentChannel();
        
        // 更新模型选择器
        const channel = apiChannels.find(c => c.id === currentChannelId);
        if (channel) {
            renderModelSelector(channel);
            
            // 更新当前对话的渠道ID
            const currentConversation = conversations.find(c => c.id === currentConversationId);
            if (currentConversation) {
                currentConversation.channelId = currentChannelId;
                // 设置默认模型
                if (channel.models && channel.models.length > 0) {
                    currentConversation.modelId = channel.models[0].id;
                }
                saveConversations();
            }
            
            checkApiBalance();
        }
    });

    // 模型选择器变化
    modelSelector.addEventListener('change', () => {
        const currentConversation = conversations.find(c => c.id === currentConversationId);
        if (currentConversation) {
            currentConversation.modelId = modelSelector.value;
            saveConversations();
        }
    });

    // 切换主题
    toggleThemeBtn.addEventListener('click', toggleTheme);

    // 移动端侧边栏
    showSidebarBtn.addEventListener('click', () => {
        sidebar.classList.add('active');
    });

    // 隐藏侧边栏
    if (toggleSidebarBtn) {
        toggleSidebarBtn.addEventListener('click', () => {
            sidebar.classList.remove('active');
        });
    }

    // 监听密码输入框的切换
    document.querySelectorAll('.toggle-password').forEach(button => {
        button.addEventListener('click', function() {
            const input = this.parentElement.querySelector('input');
            if (input.type === 'password') {
                input.type = 'text';
                this.innerHTML = '<i class="fas fa-eye-slash"></i>';
            } else {
                input.type = 'password';
                this.innerHTML = '<i class="fas fa-eye"></i>';
            }
        });
    });

    // 确认删除按钮
    document.getElementById('confirm-delete').addEventListener('click', () => {
        const type = confirmModal.dataset.type;
        const id = confirmModal.dataset.id;
        
        if (type === 'conversation') {
            deleteConversation(id);
        } else if (type === 'channel') {
            deleteChannel(id);
        }
        
        confirmModal.style.display = 'none';
    });
    
    document.getElementById('confirm-cancel').addEventListener('click', () => {
        confirmModal.style.display = 'none';
    });
}

// 确认删除
function confirmDelete(type, id, name) {
    const confirmMessage = document.getElementById('confirm-message');
    confirmMessage.textContent = `您确定要删除"${name}"吗？此操作不可撤销。`;
    
    confirmModal.dataset.type = type;
    confirmModal.dataset.id = id;
    confirmModal.style.display = 'block';
}

// 加载主题
function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        toggleThemeBtn.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
        document.body.removeAttribute('data-theme');
        toggleThemeBtn.innerHTML = '<i class="fas fa-moon"></i>';
    }
}

// 切换主题
function toggleTheme() {
    if (document.body.getAttribute('data-theme') === 'dark') {
        document.body.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        toggleThemeBtn.innerHTML = '<i class="fas fa-moon"></i>';
    } else {
        document.body.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        toggleThemeBtn.innerHTML = '<i class="fas fa-sun"></i>';
    }
}

// 发送消息
async function sendMessage() {
    const messageText = messageInput.value.trim();
    if (!messageText || isStreaming) return;
    
    // 检查API渠道
    if (apiChannels.length === 0) {
        alert('请先添加API渠道');
        return;
    }
    
    // 获取当前对话
    const conversation = conversations.find(c => c.id === currentConversationId);
    if (!conversation) {
        alert('请先创建一个对话');
        return;
    }
    
    // 添加用户消息
    const userMessage = {
        id: generateId(),
        role: 'user',
        content: messageText,
        timestamp: Date.now()
    };
    conversation.messages.push(userMessage);
    
    // 添加助手消息（初始为思考中）
    const assistantMessage = {
        id: generateId(),
        role: 'assistant',
        content: '思考中...',
        timestamp: Date.now()
    };
    conversation.messages.push(assistantMessage);
    
    // 更新UI
    renderMessages(conversation.messages);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // 清空输入框
    messageInput.value = '';
    messageInput.style.height = 'auto';
    
    // 保存对话
    saveConversations();
    
    // 自动重命名未命名对话
    if (conversation.title === '新对话' && conversation.messages.length <= 2) {
        // 使用用户的第一条消息作为对话标题
        const title = messageText.length > 18 ? messageText.substring(0, 18) + '...' : messageText;
        conversation.title = title;
        saveConversations();
        renderConversationsList();
        
        // 更新当前对话标题
        document.getElementById('current-chat-title').textContent = title;
    }
    
    // 准备API调用
    const channel = apiChannels.find(c => c.id === conversation.channelId);
    if (!channel) {
        assistantMessage.content = '错误: 未找到API渠道';
        renderMessages(conversation.messages);
        saveConversations();
        return;
    }
    
    // 统计用户消息
    const userTokens = estimateTokens(messageText);
    userStats.innerHTML = `<i class="fas fa-user"></i> ${messageText.length}字符 (${userTokens} tokens)`;
    
    // 开始计时
    startTime = Date.now();
    isStreaming = true;
    
    try {
        // 格式化消息
        const messages = conversation.messages
            .filter(m => m.id !== assistantMessage.id)
            .map(m => ({
                role: m.role,
                content: m.content
            }));
        
        // 调用API
        const response = await callAIAPI(channel, messages, assistantMessage);
        
        // 更新助手回复内容
        assistantMessage.content = response.content;
        
        // 统计助手回复
        const assistantTokens = response.tokens;
        assistantStats.innerHTML = `<i class="fas fa-robot"></i> ${response.content.length}字符 (${assistantTokens} tokens)`;
    } catch (error) {
        console.error('API调用失败:', error);
        assistantMessage.content = `错误: ${error.message}`;
    } finally {
        // 停止计时
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        timeStats.innerHTML = `<i class="fas fa-clock"></i> ${elapsed}s`;
        
        isStreaming = false;
        
        // 更新UI和保存对话
        renderMessages(conversation.messages);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        saveConversations();
    }
}

// 添加API渠道
function addApiChannel(name, endpoint, key, models) {
    // 将模型列表转换为数组对象
    const modelsList = models.split('\n')
        .map(model => model.trim())
        .filter(model => model !== '')
        .map(model => ({
            id: generateId(),
            name: model
        }));
    
    // 如果没有提供模型，添加一个默认值
    if (modelsList.length === 0) {
        modelsList.push({
            id: generateId(),
            name: 'default-model'
        });
    }
    
    const newChannel = {
        id: generateId(),
        name,
        endpoint,
        key,
        models: modelsList
    };
    
    apiChannels.push(newChannel);
    saveApiChannels();
    renderChannelsList();
    
    // 设置为当前渠道
    currentChannelId = newChannel.id;
    
    // 更新选择器
    renderApiChannelSelector();
    apiChannelSelector.value = currentChannelId;
    saveCurrentChannel();
    
    // 更新模型选择器
    renderModelSelector(newChannel);
    
    // 检查API余额
    checkApiBalance();
}

// 更新API渠道
function updateApiChannel(channelId, name, endpoint, key, models) {
    const channelIndex = apiChannels.findIndex(c => c.id === channelId);
    if (channelIndex === -1) return;
    
    // 将模型列表转换为数组对象
    const modelsList = models.split('\n')
        .map(model => model.trim())
        .filter(model => model !== '')
        .map(model => {
            // 尝试保留现有模型的ID
            const existingModel = apiChannels[channelIndex].models.find(m => m.name === model);
            return existingModel || {
                id: generateId(),
                name: model
            };
        });
    
    // 如果没有提供模型，添加一个默认值
    if (modelsList.length === 0) {
        modelsList.push({
            id: generateId(),
            name: 'default-model'
        });
    }
    
    // 更新渠道
    apiChannels[channelIndex] = {
        ...apiChannels[channelIndex],
        name,
        endpoint,
        key,
        models: modelsList
    };
    
    saveApiChannels();
    renderChannelsList();
    
    // 如果是当前选择的渠道，更新模型选择器
    if (currentChannelId === channelId) {
        renderApiChannelSelector();
        apiChannelSelector.value = currentChannelId;
        renderModelSelector(apiChannels[channelIndex]);
    }
    
    checkApiBalance();
}

// 编辑API渠道
function editChannel(channelId) {
    const channel = apiChannels.find(c => c.id === channelId);
    if (!channel) return;
    
    // 将现有模型列表转换为文本格式
    const modelsText = channel.models.map(m => m.name).join('\n');
    
    // 填充表单
    document.getElementById('channel-name').value = channel.name;
    document.getElementById('api-endpoint').value = channel.endpoint;
    document.getElementById('api-key').value = channel.key;
    document.getElementById('api-models').value = modelsText;
    
    // 修改提交处理以更新而非添加
    const form = document.getElementById('add-channel-form');
    form.dataset.mode = 'edit';
    form.dataset.channelId = channelId;
    
    // 更新标题
    document.getElementById('channel-modal-title').textContent = '编辑API渠道';
    
    // 显示模态框
    document.getElementById('add-channel-modal').style.display = 'block';
}

// 删除API渠道
function deleteChannel(channelId) {
    const index = apiChannels.findIndex(c => c.id === channelId);
    if (index === -1) return;
    
    apiChannels.splice(index, 1);
    saveApiChannels();
    renderChannelsList();
    
    // 如果删除的是当前渠道，选择第一个可用渠道
    if (currentChannelId === channelId) {
        if (apiChannels.length > 0) {
            currentChannelId = apiChannels[0].id;
            saveCurrentChannel();
            
            // 更新选择器
            renderApiChannelSelector();
            
            // 检查API余额
            checkApiBalance();
        } else {
            currentChannelId = null;
            saveCurrentChannel();
            renderApiChannelSelector();
            apiBalance.textContent = '未设置API';
        }
    }
}

// 渲染API渠道列表
function renderChannelsList() {
    const channelsList = document.getElementById('channels-list');
    channelsList.innerHTML = '';
    
    if (apiChannels.length === 0) {
        channelsList.innerHTML = '<div class="empty-list">未添加API渠道</div>';
        return;
    }
    
    apiChannels.forEach(channel => {
        const channelItem = document.createElement('div');
        channelItem.className = 'channel-item';
        
        // 渠道信息
        const channelInfo = document.createElement('div');
        channelInfo.className = 'channel-info';
        
        const channelName = document.createElement('div');
        channelName.className = 'channel-name';
        channelName.textContent = channel.name;
        
        const endpointText = document.createElement('div');
        endpointText.className = 'channel-endpoint';
        endpointText.textContent = channel.endpoint;
        
        const modelsList = document.createElement('div');
        modelsList.className = 'channel-models';
        modelsList.textContent = `模型: ${channel.models.map(m => m.name).join(', ')}`;
        
        channelInfo.appendChild(channelName);
        channelInfo.appendChild(endpointText);
        channelInfo.appendChild(modelsList);
        
        // 渠道操作
        const channelActions = document.createElement('div');
        channelActions.className = 'channel-actions';
        
        const editBtn = document.createElement('button');
        editBtn.className = 'secondary-btn';
        editBtn.innerHTML = '<i class="fas fa-edit"></i> 编辑';
        editBtn.addEventListener('click', () => editChannel(channel.id));
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'danger-btn';
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i> 删除';
        deleteBtn.addEventListener('click', () => confirmDelete('channel', channel.id, channel.name));
        
        channelActions.appendChild(editBtn);
        channelActions.appendChild(deleteBtn);
        
        channelItem.appendChild(channelInfo);
        channelItem.appendChild(channelActions);
        
        channelsList.appendChild(channelItem);
    });
}

// 渲染API渠道选择器
function renderApiChannelSelector() {
    apiChannelSelector.innerHTML = '';
    
    if (apiChannels.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '请添加API渠道';
        apiChannelSelector.appendChild(option);
        return;
    }
    
    apiChannels.forEach(channel => {
        const option = document.createElement('option');
        option.value = channel.id;
        option.textContent = channel.name;
        apiChannelSelector.appendChild(option);
    });
}

// 渲染模型选择器
function renderModelSelector(channel) {
    modelSelector.innerHTML = '';
    
    if (!channel || !channel.models || channel.models.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '无可用模型';
        modelSelector.appendChild(option);
        return;
    }
    
    channel.models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name;
        modelSelector.appendChild(option);
    });
    
    // 如果当前对话有设置模型，则选中该模型
    const currentConversation = conversations.find(c => c.id === currentConversationId);
    if (currentConversation && currentConversation.modelId) {
        // 检查所选模型是否在当前渠道的模型列表中
        const modelExists = channel.models.some(m => m.id === currentConversation.modelId);
        if (modelExists) {
            modelSelector.value = currentConversation.modelId;
        } else if (channel.models.length > 0) {
            // 否则选择第一个可用模型
            modelSelector.value = channel.models[0].id;
            currentConversation.modelId = channel.models[0].id;
            saveConversations();
        }
    } else if (channel.models.length > 0) {
        // 如果未设置模型，选择第一个
        if (currentConversation) {
            currentConversation.modelId = channel.models[0].id;
            saveConversations();
        }
        modelSelector.value = channel.models[0].id;
    }
}

// 创建新对话
function createNewConversation() {
    // 确保有API渠道可用
    if (apiChannels.length === 0) {
        alert('请先添加API渠道');
        return;
    }
    
    // 获取当前选择的API渠道
    if (!currentChannelId) {
        currentChannelId = apiChannels[0].id;
        apiChannelSelector.value = currentChannelId;
        saveCurrentChannel();
    }
    
    // 获取当前渠道的第一个模型
    const channel = apiChannels.find(c => c.id === currentChannelId);
    let modelId = null;
    if (channel && channel.models && channel.models.length > 0) {
        modelId = channel.models[0].id;
    }
    
    // 创建新对话
    const newConversation = {
        id: generateId(),
        title: '新对话',
        channelId: currentChannelId,
        modelId: modelId,
        messages: []
    };
    
    conversations.unshift(newConversation);
    saveConversations();
    
    // 渲染对话列表
    renderConversationsList();
    
    // 选择新对话
    selectConversation(newConversation.id);
    
    // 聚焦输入框
    messageInput.focus();
    
    // 如果是移动设备，隐藏侧边栏
    if (window.innerWidth <= 768) {
        sidebar.classList.remove('active');
    }
}

// 渲染对话列表
function renderConversationsList() {
    const conversationsList = document.getElementById('conversations-list');
    conversationsList.innerHTML = '';
    
    if (conversations.length === 0) {
        conversationsList.innerHTML = '<div class="empty-list">没有聊天记录</div>';
        return;
    }
    
    conversations.forEach(conversation => {
        const conversationItem = document.createElement('div');
        conversationItem.className = 'conversation-item';
        if (conversation.id === currentConversationId) {
            conversationItem.classList.add('active');
        }
        conversationItem.dataset.id = conversation.id;
        
        // 对话标题
        const titleElement = document.createElement('div');
        titleElement.className = 'conversation-title';
        titleElement.textContent = conversation.title || '新对话';
        
        // 最后一条消息和时间戳
        const lastMessage = conversation.messages.length > 0 
            ? conversation.messages[conversation.messages.length - 1] 
            : null;
        
        let infoText = '未开始对话';
        if (lastMessage) {
            const timestamp = formatTime(lastMessage.timestamp);
            infoText = timestamp;
        }
        
        const infoElement = document.createElement('div');
        infoElement.className = 'conversation-info';
        infoElement.textContent = infoText;
        
        // 添加标题和信息
        conversationItem.appendChild(titleElement);
        conversationItem.appendChild(infoElement);
        
        // 添加删除按钮
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-conversation icon-btn';
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.title = '删除对话';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            confirmDelete('conversation', conversation.id, conversation.title);
        });
        
        conversationItem.appendChild(deleteBtn);
        
        // 添加点击事件
        conversationItem.addEventListener('click', () => {
            selectConversation(conversation.id);
        });
        
        conversationsList.appendChild(conversationItem);
    });
}

// 渲染消息
function renderMessages(messages) {
    // 清空聊天区域
    chatMessages.innerHTML = '';
    
    // 如果没有消息，显示欢迎屏幕
    if (messages.length === 0) {
        chatMessages.innerHTML = `
            <div class="welcome-screen">
                <div class="welcome-logo">
                    <i class="fas fa-robot"></i>
                </div>
                <h2>欢迎使用AI聊天助手</h2>
                <p>请开始您的对话</p>
            </div>
        `;
        return;
    }
    
    // 按时间顺序渲染消息
    let currentRole = null;
    let currentGroup = null;
    
    messages.forEach(message => {
        // 如果角色改变，创建新的消息组
        if (message.role !== currentRole) {
            currentRole = message.role;
            currentGroup = document.createElement('div');
            currentGroup.className = `message-group ${message.role}-group`;
            chatMessages.appendChild(currentGroup);
        }
        
        // 创建消息元素
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.role}-message`;
        
        // 消息内容
        const contentElement = document.createElement('div');
        contentElement.className = 'message-content';
        contentElement.innerHTML = formatMessageContent(message.content);
        
        // 消息时间
        const timeElement = document.createElement('div');
        timeElement.className = 'message-time';
        timeElement.textContent = formatTime(message.timestamp);
        
        messageElement.appendChild(contentElement);
        messageElement.appendChild(timeElement);
        
        currentGroup.appendChild(messageElement);
    });
    
    // 滚动到底部
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 选择对话
function selectConversation(conversationId) {
    currentConversationId = conversationId;
    const conversation = conversations.find(c => c.id === conversationId);
    
    // 高亮当前对话
    document.querySelectorAll('.conversation-item').forEach(item => {
        if (item.dataset.id === conversationId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // 更新当前对话标题
    const titleElement = document.getElementById('current-chat-title');
    if (conversation) {
        titleElement.textContent = conversation.title || '新对话';
    } else {
        titleElement.textContent = '当前对话';
    }
    
    // 渲染消息
    if (conversation) {
        renderMessages(conversation.messages);
        
        // 如果对话指定了渠道，则切换到该渠道
        if (conversation.channelId) {
            const channelExists = apiChannels.some(c => c.id === conversation.channelId);
            if (channelExists) {
                currentChannelId = conversation.channelId;
                apiChannelSelector.value = currentChannelId;
                saveCurrentChannel();
                
                // 更新模型选择器
                const channel = apiChannels.find(c => c.id === currentChannelId);
                renderModelSelector(channel);
            }
        }
    } else {
        renderMessages([]);
    }
    
    // 隐藏移动端侧边栏
    if (window.innerWidth <= 768) {
        sidebar.classList.remove('active');
    }
    
    // 保存当前对话ID
    localStorage.setItem('currentConversationId', currentConversationId);
}

// 删除对话
function deleteConversation(conversationId) {
    const index = conversations.findIndex(c => c.id === conversationId);
    if (index === -1) return;
    
    conversations.splice(index, 1);
    saveConversations();
    
    // 如果删除的是当前对话，选择另一个
    if (currentConversationId === conversationId) {
        if (conversations.length > 0) {
            selectConversation(conversations[0].id);
        } else {
            createNewConversation();
        }
    } else {
        renderConversationsList();
    }
}

// 加载API渠道
function loadApiChannels() {
    const saved = localStorage.getItem('apiChannels');
    if (saved) {
        apiChannels = JSON.parse(saved);
        renderApiChannelSelector();
        
        // 加载当前渠道
        const savedChannel = localStorage.getItem('currentChannelId');
        if (savedChannel && apiChannels.some(c => c.id === savedChannel)) {
            currentChannelId = savedChannel;
            apiChannelSelector.value = currentChannelId;
            
            // 更新模型选择器
            const channel = apiChannels.find(c => c.id === currentChannelId);
            renderModelSelector(channel);
            
            checkApiBalance();
        }
    } else {
        apiChannelSelector.innerHTML = '<option value="">请添加API渠道</option>';
    }
}

// 加载对话
function loadConversations() {
    const saved = localStorage.getItem('conversations');
    if (saved) {
        conversations = JSON.parse(saved);
        
        // 确保所有对话都有channelId和modelId属性
        conversations.forEach(conversation => {
            if (!conversation.channelId && apiChannels.length > 0) {
                conversation.channelId = apiChannels[0].id;
            }
            
            if (!conversation.modelId && conversation.channelId) {
                const channel = apiChannels.find(c => c.id === conversation.channelId);
                if (channel && channel.models && channel.models.length > 0) {
                    conversation.modelId = channel.models[0].id;
                }
            }
        });
        
        renderConversationsList();
        
        // 加载当前对话
        const savedConversation = localStorage.getItem('currentConversationId');
        if (savedConversation && conversations.some(c => c.id === savedConversation)) {
            selectConversation(savedConversation);
        } else if (conversations.length > 0) {
            selectConversation(conversations[0].id);
        } else {
            createNewConversation();
        }
    } else {
        createNewConversation();
    }
}

// 保存对话
function saveConversations() {
    localStorage.setItem('conversations', JSON.stringify(conversations));
}

// 保存API渠道
function saveApiChannels() {
    localStorage.setItem('apiChannels', JSON.stringify(apiChannels));
}

// 保存当前渠道
function saveCurrentChannel() {
    localStorage.setItem('currentChannelId', currentChannelId);
}

// 生成唯一ID
function generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// 格式化时间
function formatTime(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const today = new Date();
    const isToday = date.getDate() === today.getDate() && 
                     date.getMonth() === today.getMonth() && 
                     date.getFullYear() === today.getFullYear();
    
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
// 渲染API渠道列表（添加到app.js）
function renderChannelsList() {
    const channelsList = document.getElementById('channels-list');
    channelsList.innerHTML = '';
    
    if (apiChannels.length === 0) {
        channelsList.innerHTML = '<div class="empty-list">暂无API渠道，请添加</div>';
        return;
    }
    
    apiChannels.forEach(channel => {
        const channelItem = document.createElement('div');
        channelItem.classList.add('channel-item');
        
        const channelInfo = document.createElement('div');
        channelInfo.classList.add('channel-info');
        
        const channelName = document.createElement('div');
        channelName.classList.add('channel-name');
        channelName.textContent = channel.name;
        
        const channelEndpoint = document.createElement('div');
        channelEndpoint.classList.add('channel-endpoint');
        channelEndpoint.textContent = channel.endpoint;
        
        const modelCount = document.createElement('div');
        modelCount.classList.add('model-count');
        modelCount.textContent = `${channel.models.length} 个模型`;
        
        channelInfo.appendChild(channelName);
        channelInfo.appendChild(channelEndpoint);
        channelInfo.appendChild(modelCount);
        
        const channelActions = document.createElement('div');
        channelActions.classList.add('channel-actions');
        
        const editBtn = document.createElement('button');
        editBtn.classList.add('secondary-btn');
        editBtn.innerHTML = '<i class="fas fa-edit"></i> 编辑';
        editBtn.addEventListener('click', () => editChannel(channel.id));
        
        const deleteBtn = document.createElement('button');
        deleteBtn.classList.add('danger-btn');
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i> 删除';
        deleteBtn.addEventListener('click', () => confirmDeleteChannel(channel.id));
        
        channelActions.appendChild(editBtn);
        channelActions.appendChild(deleteBtn);
        
        channelItem.appendChild(channelInfo);
        channelItem.appendChild(channelActions);
        
        channelsList.appendChild(channelItem);
    });
}

// 确认删除API渠道
function confirmDeleteChannel(channelId) {
    const channel = apiChannels.find(c => c.id === channelId);
    if (!channel) return;
    
    const confirmMessage = document.getElementById('confirm-message');
    confirmMessage.textContent = `确定要删除「${channel.name}」渠道吗？`;
    
    const confirmDelete = document.getElementById('confirm-delete');
    const confirmCancel = document.getElementById('confirm-cancel');
    
    // 设置确认按钮
    confirmDelete.onclick = () => {
        deleteChannel(channelId);
        confirmModal.style.display = 'none';
    };
    
    // 设置取消按钮
    confirmCancel.onclick = () => {
        confirmModal.style.display = 'none';
    };
    
    confirmModal.style.display = 'block';
}

// 编辑API渠道
function editChannel(channelId) {
    const channel = apiChannels.find(c => c.id === channelId);
    if (!channel) return;
    
    // 设置标题
    document.getElementById('channel-modal-title').textContent = '编辑API渠道';
    
    // 将现有模型列表转换为文本格式
    const modelsText = channel.models.map(m => m.name).join('\n');
    
    // 填充表单
    document.getElementById('channel-name').value = channel.name;
    document.getElementById('api-endpoint').value = channel.endpoint;
    document.getElementById('api-key').value = channel.key;
    document.getElementById('api-models').value = modelsText;
    
    // 修改提交处理以更新而非添加
    addChannelForm.dataset.mode = 'edit';
    addChannelForm.dataset.channelId = channelId;
    
    // 显示模态框
    addChannelModal.style.display = 'block';
}
// 添加密码显示/隐藏功能（在setupEventListeners中添加）
document.querySelector('.toggle-password').addEventListener('click', function() {
    const passwordInput = document.getElementById('api-key');
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    
    // 切换图标
    const icon = this.querySelector('i');
    if (type === 'text') {
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
});
// 加载主题设置
function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    
    // 更新按钮图标
    updateThemeIcon(savedTheme);
    
    // 设置主题切换监听
    toggleThemeBtn.addEventListener('click', toggleTheme);
}

// 切换主题
function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    updateThemeIcon(newTheme);
}

// 更新主题图标
function updateThemeIcon(theme) {
    const icon = toggleThemeBtn.querySelector('i');
    if (theme === 'dark') {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    } else {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
    }
}
