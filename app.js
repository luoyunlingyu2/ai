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
    // 初始化DOM引用
    const chatMessages = document.getElementById('chat-messages');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const newChatBtn = document.getElementById('new-chat-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const apiChannelSelector = document.getElementById('api-channel-selector');
    const apiBalance = document.getElementById('api-balance');
    const settingsModal = document.getElementById('settings-modal');
    const addChannelModal = document.getElementById('add-channel-modal');
    const addChannelForm = document.getElementById('add-channel-form');
    const userStats = document.getElementById('user-stats');
    const assistantStats = document.getElementById('assistant-stats');
    const timeStats = document.getElementById('time-stats');
    const showSidebarBtn = document.getElementById('show-sidebar-btn');
    const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
    const sidebar = document.querySelector('.sidebar');

    // 加载数据
    loadApiChannels();
    loadConversations();
    
    // 设置事件监听
    setupEventListeners();

    // 发送消息
    function sendMessage() {
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
        
        // 找到当前对话
        const conversation = conversations.find(c => c.id === currentConversationId);
        if (!conversation) return;
        
        // 添加用户消息
        const userMessage = {
            role: 'user',
            content: text,
            timestamp: new Date().toISOString(),
            tokens: estimateTokens(text)
        };
        conversation.messages.push(userMessage);
        
        // 如果是第一条消息，更新对话标题
        if (conversation.messages.length === 1 || !conversation.title || conversation.title === '新对话') {
            conversation.title = text.length > 20 ? text.substring(0, 20) + '...' : text;
            renderConversationsList();
        }
        
        saveConversations();
        renderMessages(conversation.messages);
        
        // 清空输入框
        messageInput.value = '';
        messageInput.style.height = 'auto';
        
        // 更新统计
        updateUserStats(userMessage);
        
        // 记录开始时间
        startTime = Date.now();
        
        // 创建临时的助手消息占位符
        const assistantMessage = {
            role: 'assistant',
            content: '<span class="typing-indicator">思考中</span>',
            timestamp: new Date().toISOString(),
            tokens: 0
        };
        conversation.messages.push(assistantMessage);
        renderMessages(conversation.messages);
        
        try {
            isStreaming = true;
            
            // 准备发送到API的消息历史
            const apiMessages = conversation.messages
                .filter(m => m.role === 'user' || m.role === 'assistant')
                .slice(0, -1)  // 不包括刚添加的占位符
                .map(m => ({ role: m.role, content: m.content }));
            
            // 添加用户最新消息
            apiMessages.push({ role: 'user', content: text });
            
            // 调用API
            callOpenAI(channel, apiMessages).then(response => {
                // 更新助手消息
                assistantMessage.content = response.content;
                assistantMessage.tokens = response.tokens;
                assistantMessage.timestamp = new Date().toISOString();
                
                // 保存并更新界面
                saveConversations();
                renderMessages(conversation.messages);
                
                // 更新统计
                updateAssistantStats(assistantMessage);
                updateTimeStats(Date.now() - startTime);
            }).catch(error => {
                // 更新为错误消息
                assistantMessage.content = `<span class="error">错误: ${error.message}</span>`;
                saveConversations();
                renderMessages(conversation.messages);
                console.error('API调用失败:', error);
            }).finally(() => {
                isStreaming = false;
            });
            
        } catch (error) {
            // 更新为错误消息
            assistantMessage.content = `<span class="error">错误: ${error.message}</span>`;
            saveConversations();
            renderMessages(conversation.messages);
            console.error('API调用失败:', error);
            isStreaming = false;
        }
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

        // 关闭模态框
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                settingsModal.style.display = 'none';
                addChannelModal.style.display = 'none';
            });
        });

        // 点击模态框外部关闭
        window.addEventListener('click', (e) => {
            if (e.target === settingsModal) settingsModal.style.display = 'none';
            if (e.target === addChannelModal) addChannelModal.style.display = 'none';
        });

        // 添加渠道按钮
        document.getElementById('add-channel-btn').addEventListener('click', () => {
            addChannelModal.style.display = 'block';
        });

        // 添加渠道表单提交
        addChannelForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('channel-name').value;
            const endpoint = document.getElementById('api-endpoint').value;
            const key = document.getElementById('api-key').value;
            const model = document.getElementById('api-model').value || 'gpt-3.5-turbo';
            
            addApiChannel(name, endpoint, key, model);
            addChannelForm.reset();
            addChannelModal.style.display = 'none';
        });

        // API渠道选择器变化
        apiChannelSelector.addEventListener('change', () => {
            currentChannelId = apiChannelSelector.value;
            saveCurrentChannel();
            checkApiBalance();
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
        
        // 窗口大小变化时处理
        window.addEventListener('resize', handleResize);
    }

    // 根据窗口大小处理UI
    function handleResize() {
        if (window.innerWidth > 768) {
            sidebar.classList.remove('active');
            sidebar.style.transform = '';
        }
    }

    // 生成唯一ID
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // 保存API渠道
    function saveApiChannels() {
        localStorage.setItem('apiChannels', JSON.stringify(apiChannels));
    }

    // 保存当前渠道
    function saveCurrentChannel() {
        localStorage.setItem('currentChannelId', currentChannelId);
    }

    // 保存对话
    function saveConversations() {
        localStorage.setItem('conversations', JSON.stringify(conversations));
    }

    // 加载API渠道
    function loadApiChannels() {
        const saved = localStorage.getItem('apiChannels');
        if (saved) {
            apiChannels = JSON.parse(saved);
            renderApiChannelSelector();
            
            // 设置当前渠道
            const savedCurrentChannel = localStorage.getItem('currentChannelId');
            if (savedCurrentChannel && apiChannels.some(c => c.id === savedCurrentChannel)) {
                currentChannelId = savedCurrentChannel;
                apiChannelSelector.value = currentChannelId;
            } else if (apiChannels.length > 0) {
                currentChannelId = apiChannels[0].id;
            }
            
            checkApiBalance();
        }
    }

    // 渲染API渠道选择器
    function renderApiChannelSelector() {
        apiChannelSelector.innerHTML = '';
        
        if (apiChannels.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = '请添加API渠道';
            apiChannelSelector.appendChild(option);
        } else {
            apiChannels.forEach(channel => {
                const option = document.createElement('option');
                option.value = channel.id;
                option.textContent = channel.name;
                apiChannelSelector.appendChild(option);
            });
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
            const channelItem = document.createElement('div');
            channelItem.className = 'channel-item';
            channelItem.innerHTML = `
                <div class="channel-info">
                    <div class="channel-name">${escapeHtml(channel.name)}</div>
                    <div class="channel-endpoint">${escapeHtml(channel.endpoint)}</div>
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
                const channelId = e.currentTarget.dataset.id;
                editChannel(channelId);
            });
        });
        
        document.querySelectorAll('.delete-channel').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const channelId = e.currentTarget.dataset.id;
                deleteChannel(channelId);
            });
        });
    }

    // HTML转义
    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    // 添加API渠道
    function addApiChannel(name, endpoint, key, model) {
        const newChannel = {
            id: generateId(),
            name,
            endpoint,
            key,
            model
        };
        
        apiChannels.push(newChannel);
        saveApiChannels();
        renderApiChannelSelector();
        renderChannelsList();
        
        // 如果是第一个渠道，设为当前渠道
        if (apiChannels.length === 1) {
            currentChannelId = newChannel.id;
            apiChannelSelector.value = currentChannelId;
            saveCurrentChannel();
            checkApiBalance();
        }
    }

    // 编辑渠道
    function editChannel(channelId) {
        const channel = apiChannels.find(c => c.id === channelId);
        if (!channel) return;
        
        // 这里可以实现编辑渠道的逻辑，类似添加渠道的弹窗
        // 简化起见，这里直接用prompt
        const name = prompt('渠道名称', channel.name);
        if (!name) return;
        
        const endpoint = prompt('API接入点', channel.endpoint);
        if (!endpoint) return;
        
        const key = prompt('API密钥 (留空保持不变)', '');
        const model = prompt('模型名称', channel.model);
        
        channel.name = name;
        channel.endpoint = endpoint;
        if (key) channel.key = key;
        if (model) channel.model = model;
        
        saveApiChannels();
        renderApiChannelSelector();
        renderChannelsList();
        
        if (currentChannelId === channelId) {
            apiChannelSelector.value = channelId;
            checkApiBalance();
        }
    }

    // 删除渠道
    function deleteChannel(channelId) {
        if (!confirm('确定要删除这个API渠道吗？')) return;
        
        const index = apiChannels.findIndex(c => c.id === channelId);
        if (index === -1) return;
        
        apiChannels.splice(index, 1);
        saveApiChannels();
        renderApiChannelSelector();
        renderChannelsList();
        
        // 如果删除的是当前渠道，重新设置当前渠道
        if (currentChannelId === channelId) {
            currentChannelId = apiChannels.length > 0 ? apiChannels[0].id : null;
            if (currentChannelId) {
                apiChannelSelector.value = currentChannelId;
            }
            saveCurrentChannel();
            checkApiBalance();
        }
    }

    // 检查API余额
    async function checkApiBalance() {
        if (!currentChannelId) {
            apiBalance.textContent = '余额: 无可用渠道';
            return;
        }
        
        const channel = apiChannels.find(c => c.id === currentChannelId);
        if (!channel) return;
        
        apiBalance.textContent = '余额: 查询中...';
        
        try {
            // 这里实现查询API余额的逻辑
            // 由于不同API提供商的余额查询方式不同，这里只是模拟
            const response = await simulateBalanceCheck(channel);
            apiBalance.textContent = `余额: $${response.balance.toFixed(2)}`;
        } catch (error) {
            apiBalance.textContent = '余额: 查询失败';
            console.error('查询余额失败:', error);
        }
    }

    // 模拟余额查询
    async function simulateBalanceCheck(channel) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({ balance: Math.random() * 100 });
            }, 1000);
        });
    }

    // 加载对话历史
    function loadConversations() {
        const saved = localStorage.getItem('conversations');
        if (saved) {
            conversations = JSON.parse(saved);
            renderConversationsList();
            
            // 加载最后一个对话
            const savedCurrentId = localStorage.getItem('currentConversationId');
            if (savedCurrentId && conversations.some(c => c.id === savedCurrentId)) {
                loadConversation(savedCurrentId);
            } else if (conversations.length > 0) {
                loadConversation(conversations[0].id);
            } else {
                createNewConversation();
            }
        } else {
            createNewConversation();
        }
    }

    // 渲染对话列表
    function renderConversationsList() {
        const conversationsList = document.querySelector('.conversations-list');
        conversationsList.innerHTML = '';
        
        conversations.forEach(conversation => {
            const item = document.createElement('div');
            item.className = 'conversation-item';
            if (conversation.id === currentConversationId) {
                item.classList.add('active');
            }
            item.textContent = conversation.title || '新对话';
            item.dataset.id = conversation.id;
            item.addEventListener('click', () => {
                loadConversation(conversation.id);
                // 在移动设备上，点击对话后关闭侧边栏
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('active');
                }
            });
            conversationsList.appendChild(item);
        });
    }

    // 创建新对话
    function createNewConversation() {
        const newConversation = {
            id: generateId(),
            title: '新对话',
            messages: [],
            channelId: currentChannelId,
            createdAt: new Date().toISOString()
        };
        
        conversations.unshift(newConversation);
        saveConversations();
        loadConversation(newConversation.id);
        renderConversationsList();
        
        // 在移动设备上，创建新对话后关闭侧边栏
        if (window.innerWidth <= 768) {
            sidebar.classList.remove('active');
        }
    }

    // 加载对话
    function loadConversation(conversationId) {
        const conversation = conversations.find(c => c.id === conversationId);
        if (!conversation) return;
        
        currentConversationId = conversationId;
        localStorage.setItem('currentConversationId', conversationId);
        
        // 如果对话有关联的渠道，切换到该渠道
        if (conversation.channelId && apiChannels.some(c => c.id === conversation.channelId)) {
            currentChannelId = conversation.channelId;
            apiChannelSelector.value = currentChannelId;
            saveCurrentChannel();
            checkApiBalance();
        }
        
        renderMessages(conversation.messages);
        renderConversationsList();
        
        // 更新统计数据
        updateStats(conversation.messages);
    }

    // 渲染消息
    function renderMessages(messages) {
        chatMessages.innerHTML = '';
        
        if (messages.length === 0) {
            return;
        }
        
        let currentRole = null;
        let messageGroup = null;
        
        messages.forEach((message, index) => {
            // 如果角色变化或是第一条消息，创建新的消息组
            if (message.role !== currentRole) {
                currentRole = message.role;
                messageGroup = document.createElement('div');
                messageGroup.className = `message-group ${message.role}`;
                
                const header = document.createElement('div');
                header.className = `message-header ${message.role}`;
                
                const avatar = document.createElement('div');
                avatar.className = 'avatar';
                avatar.textContent = message.role === 'user' ? '我' : 'AI';
                
                const name = document.createElement('span');
                name.textContent = message.role === 'user' ? '我' : '助手';
                
                header.appendChild(avatar);
                header.appendChild(name);
                messageGroup.appendChild(header);
                
                chatMessages.appendChild(messageGroup);
            }
            
            // 添加消息内容到当前组
            const content = document.createElement('div');
            content.className = 'message-content';
            content.innerHTML = formatMessage(message.content);
            messageGroup.appendChild(content);
            
            // 如果是最后一条消息或下一条消息角色不同，添加时间
            if (index === messages.length - 1 || messages[index + 1].role !== message.role) {
                const time = document.createElement('div');
                time.className = 'message-time';
                time.textContent = formatTime(message.timestamp);
                messageGroup.appendChild(time);
            }
        });
        
        // 滚动到底部
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // 格式化消息内容，支持简单的markdown
    function formatMessage(content) {
        if (!content) return '';
        
        // 如果内容已经包含HTML标签，直接返回
        if (/<[a-z][\s\S]*>/i.test(content)) {
            return content;
        }
        
        // 转义HTML
        let formatted = escapeHtml(content);
        
        // 简单的markdown支持（粗体、斜体、代码）
        formatted = formatted
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        
        // 将换行符转换为<br>
        formatted = formatted.replace(/\n/g, '<br>');
        
        return formatted;
    }

    // 格式化时间
    function formatTime(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        const now = new Date();
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            // 今天，显示时:分
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays < 7) {
            // 一周内，显示星期几 时:分
            const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
            return days[date.getDay()] + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            // 一周以上，显示年-月-日 时:分
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
    }

    // 调用OpenAI API (模拟)
    async function callOpenAI(channel, messages) {
        return new Promise((resolve, reject) => {
            // 在实际应用中，应该使用fetch或axios调用真实API
            // 模拟API调用延迟
            const delay = Math.random() * 2000 + 1000;
            const tokens = Math.floor(Math.random() * 300 + 100);
            
            setTimeout(() => {
                if (Math.random() > 0.95) {  // 5%概率模拟错误
                    reject(new Error('API调用失败'));
                } else {
                    resolve({
                        content: `这是一个模拟的API响应。你发送的消息是: "${messages[messages.length - 1].content}"

该消息大约包含 ${estimateTokens(messages[messages.length - 1].content)} 个tokens。

在实际实现中，这里将连接到OpenAI或其他兼容的API，并支持流式输出响应。`,
                        tokens: tokens
                    });
                }
            }, delay);
        });
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

    // 估算tokens数量 (粗略估计)
    function estimateTokens(text) {
        if (!text) return 0;
        
        // 粗略估计，英文约4字符/token，中文约2字符/token
        const englishChars = text.replace(/[\u4e00-\u9fa5]/g, '').length;
        const chineseChars = text.length - englishChars;
        return Math.ceil(englishChars / 4 + chineseChars / 2);
    }
}
