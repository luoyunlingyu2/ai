// 全局变量
let currentConversationId = null;
let conversations = [];
let apiChannels = [];
let currentChannelId = null;
let isStreaming = false;
let startTime = 0;

// DOM元素
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // 获取DOM元素引用
    const chatMessages = document.getElementById('chat-messages');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const newChatBtn = document.getElementById('new-chat-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const apiChannelSelector = document.getElementById('api-channel-selector');
    const modelSelector = document.getElementById('model-selector');
    const apiBalance = document.getElementById('api-balance');
    const settingsModal = document.getElementById('settings-modal');
    const addChannelModal = document.getElementById('add-channel-modal');
    const addChannelForm = document.getElementById('add-channel-form');
    const addChannelBtn = document.getElementById('add-channel-btn');
    const userStats = document.getElementById('user-stats');
    const assistantStats = document.getElementById('assistant-stats');
    const timeStats = document.getElementById('time-stats');
    const showSidebarBtn = document.getElementById('show-sidebar-btn');
    const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
    const sidebar = document.querySelector('.sidebar');

    // 初始化数据
    loadApiChannels();
    loadConversations();
    setupEventListeners();

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
            addChannelModal.style.display = 'block';
        });

        // 关闭模态框
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                settingsModal.style.display = 'none';
                addChannelModal.style.display = 'none';
                
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
            const selectedChannel = apiChannels.find(c => c.id === currentChannelId);
            renderModelSelector(selectedChannel);
            
            checkApiBalance();
        });

        // 模型选择器变化
        modelSelector.addEventListener('change', () => {
            const currentConversation = conversations.find(c => c.id === currentConversationId);
            if (currentConversation) {
                currentConversation.modelId = modelSelector.value;
                saveConversations();
            }
        });

        // 移动端侧边栏控制
        if (showSidebarBtn) {
            showSidebarBtn.addEventListener('click', () => {
                sidebar.classList.add('active');
            });
        }

        if (toggleSidebarBtn) {
            toggleSidebarBtn.addEventListener('click', () => {
                sidebar.classList.remove('active');
            });
        }

        // 点击聊天区域隐藏侧边栏(移动端)
        chatMessages.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('active');
            }
        });
    }

    // 加载API渠道
    function loadApiChannels() {
        const saved = localStorage.getItem('apiChannels');
        if (saved) {
            apiChannels = JSON.parse(saved);
            renderApiChannelSelector();
            
            // 加载上次使用的渠道
            const lastChannel = localStorage.getItem('currentChannelId');
            if (lastChannel && apiChannels.some(c => c.id === lastChannel)) {
                currentChannelId = lastChannel;
                apiChannelSelector.value = currentChannelId;
                
                // 加载该渠道的模型列表
                const channel = apiChannels.find(c => c.id === currentChannelId);
                renderModelSelector(channel);
                
                checkApiBalance();
            } else if (apiChannels.length > 0) {
                currentChannelId = apiChannels[0].id;
                apiChannelSelector.value = currentChannelId;
                
                // 加载该渠道的模型列表
                renderModelSelector(apiChannels[0]);
                
                checkApiBalance();
            }
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
            
            // 如果已有对话，选择第一个
            if (conversations.length > 0) {
                selectConversation(conversations[0].id);
            } else {
                createNewConversation();
            }
        } else {
            createNewConversation();
        }
    }

    // 保存API渠道
    function saveApiChannels() {
        localStorage.setItem('apiChannels', JSON.stringify(apiChannels));
    }

    // 保存当前选择的渠道
    function saveCurrentChannel() {
        localStorage.setItem('currentChannelId', currentChannelId);
    }

    // 保存对话
    function saveConversations() {
        localStorage.setItem('conversations', JSON.stringify(conversations));
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
            modelSelector.value = channel.models[0].id;
            if (currentConversation) {
                currentConversation.modelId = channel.models[0].id;
                saveConversations();
            }
        }
    }

    // 渲染对话列表
    function renderConversationsList() {
        const conversationsList = document.querySelector('.conversations-list');
        conversationsList.innerHTML = '';
        
        if (conversations.length === 0) {
            conversationsList.innerHTML = '<p class="empty-list">没有对话</p>';
            return;
        }
        
        conversations.forEach(conversation => {
            const item = document.createElement('div');
            item.className = 'conversation-item';
            if (conversation.id === currentConversationId) {
                item.classList.add('active');
            }
            
            item.innerHTML = `
                <div class="conversation-title">${escapeHtml(conversation.title || '新对话')}</div>
                <button class="delete-conversation" data-id="${conversation.id}">
                    <i class="fas fa-trash"></i>
                </button>
            `;
            
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.delete-conversation')) {
                    selectConversation(conversation.id);
                }
            });
            
            conversationsList.appendChild(item);
        });
        
        // 删除对话
        document.querySelectorAll('.delete-conversation').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const conversationId = e.currentTarget.dataset.id;
                deleteConversation(conversationId);
            });
        });
    }

    // 渲染消息
    function renderMessages(messages) {
        chatMessages.innerHTML = '';
        
        if (messages.length === 0) {
            return;
        }
        
        let lastRole = null;
        let messageGroup = null;
        
        messages.forEach((message, index) => {
            // 如果角色变了或者是第一条消息，创建新的消息组
            if (message.role !== lastRole) {
                lastRole = message.role;
                
                messageGroup = document.createElement('div');
                messageGroup.className = `message-group ${message.role}`;
                chatMessages.appendChild(messageGroup);
            }
            
            // 创建消息内容
            const messageContent = document.createElement('div');
            messageContent.className = 'message-content';
            messageContent.innerHTML = formatMessageContent(message.content);
            messageGroup.appendChild(messageContent);
            
            // 添加时间戳（只给每组最后一条消息添加）
            if (index === messages.length - 1 || messages[index + 1].role !== message.role) {
                const messageTime = document.createElement('div');
                messageTime.className = 'message-time';
                messageTime.textContent = formatTime(message.timestamp);
                messageGroup.appendChild(messageTime);
            }
        });
        
        // 滚动到底部
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // 更新统计
        updateStats(messages);
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
        renderApiChannelSelector();
        
        // 设置为当前渠道
        currentChannelId = newChannel.id;
        apiChannelSelector.value = currentChannelId;
        saveCurrentChannel();
        
        // 更新模型选择器
        renderModelSelector(newChannel);
        
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
        renderApiChannelSelector();
        
        // 如果是当前选择的渠道，更新模型选择器
        if (currentChannelId === channelId) {
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
        
        // 显示模态框
        document.getElementById('add-channel-modal').style.display = 'block';
    }

    // 删除API渠道
        // 删除API渠道
    function deleteChannel(channelId) {
        if (!confirm('确定要删除此API渠道吗？')) return;
        
        const index = apiChannels.findIndex(c => c.id === channelId);
        if (index === -1) return;
        
        apiChannels.splice(index, 1);
        saveApiChannels();
        
        // 如果删除的是当前渠道，选择第一个可用渠道
        if (currentChannelId === channelId) {
            if (apiChannels.length > 0) {
                currentChannelId = apiChannels[0].id;
                apiChannelSelector.value = currentChannelId;
                renderModelSelector(apiChannels[0]);
            } else {
                currentChannelId = null;
                apiChannelSelector.innerHTML = '<option value="">请添加API渠道</option>';
                modelSelector.innerHTML = '<option value="">无可用模型</option>';
            }
            saveCurrentChannel();
        }
        
        renderChannelsList();
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
        
        // 如果有保存的当前渠道，则选择它
        const savedChannel = localStorage.getItem('currentChannelId');
        if (savedChannel && apiChannels.some(c => c.id === savedChannel)) {
            currentChannelId = savedChannel;
            apiChannelSelector.value = currentChannelId;
        } else if (apiChannels.length > 0) {
            // 否则选择第一个渠道
            currentChannelId = apiChannels[0].id;
            apiChannelSelector.value = currentChannelId;
        }
        
        // 渲染模型选择器
        if (currentChannelId) {
            const channel = apiChannels.find(c => c.id === currentChannelId);
            if (channel) {
                renderModelSelector(channel);
            }
        }
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
            modelSelector.value = channel.models[0].id;
            if (currentConversation) {
                currentConversation.modelId = channel.models[0].id;
                saveConversations();
            }
        }
    }

    // 渲染API渠道列表
    function renderChannelsList() {
        const channelsList = document.querySelector('.channels-list');
        channelsList.innerHTML = '';
        
        if (apiChannels.length === 0) {
            channelsList.innerHTML = '<p class="empty-list">没有API渠道，请添加一个</p>';
            return;
        }
        
        apiChannels.forEach(channel => {
            const modelNames = channel.models.map(m => m.name).join(', ');
            
            const channelItem = document.createElement('div');
            channelItem.className = 'channel-item';
            channelItem.innerHTML = `
                <div class="channel-info">
                    <div class="channel-name">${escapeHtml(channel.name)}</div>
                    <div class="channel-endpoint">${escapeHtml(channel.endpoint)}</div>
                    <div class="channel-models">模型: ${escapeHtml(modelNames)}</div>
                </div>
                <div class="channel-actions">
                    <button class="edit-channel" data-id="${channel.id}"><i class="fas fa-edit"></i></button>
                    <button class="delete-channel" data-id="${channel.id}"><i class="fas fa-trash"></i></button>
                </div>
            `;
            channelsList.appendChild(channelItem);
        });
        
        // 添加编辑和删除事件
        document.querySelectorAll('.edit-channel').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const channelId = e.currentTarget.dataset.id;
                editChannel(channelId);
            });
        });
        
        document.querySelectorAll('.delete-channel').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const channelId = e.currentTarget.dataset.id;
                deleteChannel(channelId);
            });
        });
    }

    // 检查API余额
    async function checkApiBalance() {
        if (!currentChannelId) {
            apiBalance.textContent = '余额: 未设置API';
            return;
        }
        
        const channel = apiChannels.find(c => c.id === currentChannelId);
        if (!channel) {
            apiBalance.textContent = '余额: 未找到渠道';
            return;
        }
        
        apiBalance.textContent = '余额: 查询中...';
        
        try {
            if (channel.endpoint.includes('openai.com')) {
                // OpenAI API
                const response = await fetch('https://api.openai.com/dashboard/billing/credit_grants', {
                    headers: {
                        'Authorization': `Bearer ${channel.key}`
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    const balance = data.total_available.toFixed(2);
                    apiBalance.textContent = `余额: $${balance}`;
                } else {
                    apiBalance.textContent = '余额: 查询失败';
                }
            } else {
                // 其他API，显示暂不支持
                apiBalance.textContent = '余额: 不支持查询';
            }
        } catch (error) {
            console.error('查询余额失败:', error);
            apiBalance.textContent = '余额: 查询失败';
        }
    }

    // 发送消息
    async function sendMessage() {
        const text = messageInput.value.trim();
        if (!text || isStreaming) return;
        
        if (!currentChannelId) {
            alert('请先添加并选择API渠道');
            return;
        }
        
        const channel = apiChannels.find(c => c.id === currentChannelId);
        if (!channel) {
            alert('所选API渠道不可用');
            return;
        }
        
        // 获取选择的模型
        const conversation = conversations.find(c => c.id === currentConversationId);
        if (!conversation) return;
        
        // 添加用户消息
        const userMessage = {
            role: 'user',
            content: text,
            timestamp: Date.now(),
            tokens: estimateTokens(text)
        };
        
        conversation.messages.push(userMessage);
        updateUserStats(userMessage);
        
        // 添加助手消息（初始显示为"思考中..."）
        const assistantMessage = {
            role: 'assistant',
            content: '思考中...',
            timestamp: Date.now(),
            tokens: 0
        };
        
        conversation.messages.push(assistantMessage);
        
        // 更新UI
        renderMessages(conversation.messages);
        saveConversations();
        
        // 清空输入框并重置高度
        messageInput.value = '';
        messageInput.style.height = 'auto';
        
        // 构建API请求的消息历史
        const messages = conversation.messages
            .filter(m => m.role === 'user' || (m.role === 'assistant' && m.content !== '思考中...'))
            .map(m => ({
                role: m.role,
                content: m.content
            }));
        
        // 调用API
        isStreaming = true;
        startTime = Date.now();
        
        try {
            // 调用API获取回复
            const response = await callOpenAI(channel, messages);
            
            // 更新助手消息
            assistantMessage.content = response.content;
            assistantMessage.tokens = response.tokens;
            assistantMessage.timestamp = Date.now();
            
            // 计算耗时
            const endTime = Date.now();
            const timeElapsed = endTime - startTime;
            updateTimeStats(timeElapsed);
            
            // 更新统计
            updateAssistantStats(assistantMessage);
            
            // 保存对话
            saveConversations();
            
            // 更新对话标题（如果是第一条消息）
            if (conversation.messages.length === 2) {
                updateConversationTitle(conversation);
            }
        } catch (error) {
            console.error('API调用错误:', error);
            assistantMessage.content = `发生错误: ${error.message}`;
            renderMessages(conversation.messages);
            saveConversations();
        } finally {
            isStreaming = false;
        }
    }

    // 调用OpenAI API (或兼容的API)
    async function callOpenAI(channel, messages) {
        // 获取当前对话和模型信息
        const conversation = conversations.find(c => c.id === currentConversationId);
        const assistantMessage = conversation.messages[conversation.messages.length - 1];
        
        // 获取选择的模型
        const modelId = conversation.modelId;
        const modelObj = channel.models.find(m => m.id === modelId);
        const model = modelObj ? modelObj.name : channel.models[0].name;
        
        try {
            // 准备通用API请求头
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${channel.key}`
            };
            
            // 准备请求体
            const requestBody = {
                model: model,
                messages: messages,
                stream: true
            };
            
            // 发送请求
            const response = await fetch(channel.endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `API请求失败，状态码: ${response.status}`);
            }
            
            // 处理流式响应
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let content = '';
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                // 处理不同的流格式
                const lines = chunk.split('\n').filter(line => line.trim() !== '');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;
                        
                        try {
                            const json = JSON.parse(data);
                            // 支持不同的响应格式
                            let delta = '';
                            
                            // OpenAI格式
                            if (json.choices && json.choices[0]?.delta?.content) {
                                delta = json.choices[0].delta.content;
                            } 
                            // 通用格式
                            else if (json.output || json.result || json.text || json.content) {
                                delta = json.output || json.result || json.text || json.content;
                            }
                            
                            if (delta) {
                                content += delta;
                                // 实时更新UI
                                assistantMessage.content = content;
                                renderMessages(conversation.messages);
                                saveConversations();
                            }
                        } catch (e) {
                            console.error('解析流数据失败:', e);
                        }
                    }
                }
            }
            
            // 估算tokens
            const tokens = estimateTokens(content);
            
            return {
                content: content,
                tokens: tokens
            };
        } catch (error) {
            console.error('API调用出错:', error);
            throw error;
        }
    }

    // 更新对话标题
    function updateConversationTitle(conversation) {
        // 使用第一条用户消息作为标题
        if (conversation.messages.length > 0) {
            const firstMessage = conversation.messages.find(m => m.role === 'user');
            if (firstMessage) {
                // 截取前20个字符作为标题
                let title = firstMessage.content.trim().substring(0, 20);
                if (firstMessage.content.length > 20) {
                    title += '...';
                }
                conversation.title = title;
                saveConversations();
                renderConversationsList();
            }
        }
    }

    // 更新统计信息
    function updateStats(messages) {
        let userChars = 0;
        let userTokens = 0;
        let assistantChars = 0;
        let assistantTokens = 0;
        
        messages.forEach(message => {
            if (message.role === 'user') {
                userChars += message.content.length;
                userTokens += message.tokens || estimateTokens(message.content);
            } else if (message.role === 'assistant') {
                assistantChars += message.content.length;
                assistantTokens += message.tokens || estimateTokens(message.content);
            }
        });
        
        userStats.textContent = `我: ${userChars}字符 (${userTokens} tokens)`;
        assistantStats.textContent = `助手: ${assistantChars}字符 (${assistantTokens} tokens)`;
    }

    // 更新用户统计
    function updateUserStats(message) {
        const chars = message.content.length;
        const tokens = message.tokens || estimateTokens(message.content);
        userStats.textContent = `我: ${chars}字符 (${tokens} tokens)`;
    }

    // 更新助手统计
    function updateAssistantStats(message) {
        const chars = message.content.length;
        const tokens = message.tokens;
        assistantStats.textContent = `助手: ${chars}字符 (${tokens} tokens)`;
    }

    // 更新时间统计
    function updateTimeStats(time) {
        timeStats.textContent = `耗时: ${(time / 1000).toFixed(2)}s`;
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
            
            // 如果已有对话，选择第一个
            if (conversations.length > 0) {
                selectConversation(conversations[0].id);
            } else {
                createNewConversation();
            }
        } else {
            createNewConversation();
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
        
        // 选择新对话
        selectConversation(newConversation.id);
        
        // 聚焦输入框
        messageInput.focus();
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
        
        // 渲染消息
        if (conversation) {
            renderMessages(conversation.messages);
            
            // 如果对话指定了渠道，则切换到该渠道
            if (conversation.channelId) {
                const channelExists = apiChannels.some(c => c.id === conversation.channelId);
                if (channelExists) {
                    currentChannelId = conversation.channelId;
                    apiChannelSelector.value = currentChannelId;
                    
                    // 更新模型选择器
                    const channel = apiChannels.find(c => c.id === currentChannelId);
                    renderModelSelector(channel);
                }
            }
        } else {
            chatMessages.innerHTML = '';
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
        if (!confirm('确定要删除此对话吗？')) return;
        
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

    // 估算tokens数量 (粗略估计)
    function estimateTokens(text) {
        if (!text) return 0;
        
        // 粗略估计，英文约4字符/token，中文约2字符/token
        const englishChars = text.replace(/[\u4e00-\u9fa5]/g, '').length;
        const chineseChars = text.length - englishChars;
        return Math.ceil(englishChars / 4 + chineseChars / 2);
    }
}
