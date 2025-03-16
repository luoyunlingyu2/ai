/**
 * 设置和API渠道管理
 */

// 加载API渠道
function loadApiChannels() {
    try {
        const saved = localStorage.getItem('apiChannels');
        if (saved) {
            apiChannels = JSON.parse(saved);
        }
        
        // 加载当前渠道ID
        currentChannelId = localStorage.getItem('currentChannelId');
        
        renderApiSelector();
        
        // 如果有当前渠道，初始化模型选择器
        if (currentChannelId) {
            const channel = apiChannels.find(c => c.id === currentChannelId);
            if (channel) {
                renderModelSelector(channel);
                checkAndUpdateBalance();
            } else {
                currentChannelId = null;
                localStorage.removeItem('currentChannelId');
            }
        }
    } catch (error) {
        console.error('加载API渠道失败:', error);
        apiChannels = [];
    }
}

// 渲染API选择器
function renderApiSelector() {
    const selector = elements.apiSelector;
    
    // 保存当前选中值
    const currentValue = selector.value;
    
    selector.innerHTML = '<option value="">选择API渠道</option>';
    
    if (apiChannels.length === 0) {
        selector.disabled = true;
        elements.modelSelector.innerHTML = '<option value="">选择模型</option>';
        elements.modelSelector.disabled = true;
        return;
    }
    
    selector.disabled = false;
    
    apiChannels.forEach(channel => {
        const option = document.createElement('option');
        option.value = channel.id;
        option.textContent = channel.name;
        selector.appendChild(option);
    });
    
    // 恢复选中的值
    if (currentValue && apiChannels.some(c => c.id === currentValue)) {
        selector.value = currentValue;
    } else if (currentChannelId && apiChannels.some(c => c.id === currentChannelId)) {
        selector.value = currentChannelId;
    }
}

// 渲染模型选择器
function renderModelSelector(channel) {
    const selector = elements.modelSelector;
    
    // 保存当前选中值
    const currentValue = selector.value;
    
    selector.innerHTML = '<option value="">选择模型</option>';
    
    if (!channel || !channel.models || channel.models.length === 0) {
        selector.disabled = true;
        return;
    }
    
    selector.disabled = false;
    
    channel.models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name;
        selector.appendChild(option);
    });
    
    // 恢复选中的值
    if (currentValue && channel.models.some(m => m.id === currentValue)) {
        selector.value = currentValue;
    } else if (currentConversationId) {
        const conversation = conversations.find(c => c.id === currentConversationId);
        if (conversation && conversation.modelId && 
            channel.models.some(m => m.id === conversation.modelId)) {
            selector.value = conversation.modelId;
        } else if (channel.models.length > 0) {
            selector.value = channel.models[0].id;
        }
    }
}

// 检查并更新API余额
function checkAndUpdateBalance() {
    if (!currentChannelId) {
        elements.apiBalance.textContent = '余额: --';
        return;
    }
    
    const channel = apiChannels.find(c => c.id === currentChannelId);
    if (!channel) {
        elements.apiBalance.textContent = '余额: --';
        return;
    }
    
    elements.apiBalance.textContent = '余额: 查询中...';
    
    checkApiBalance(channel)
        .then(balance => {
            elements.apiBalance.textContent = `余额: ${balance}`;
        })
        .catch(error => {
            console.error('查询余额失败:', error);
            elements.apiBalance.textContent = '余额: 查询失败';
        });
}

// 打开设置
function openSettings() {
    renderApiChannelsList();
    showModal(elements.settingsModal);
}

// 渲染API渠道列表
function renderApiChannelsList() {
    const list = elements.apiChannelsList;
    list.innerHTML = '';
    
    if (apiChannels.length === 0) {
        list.innerHTML = '<div class="empty-list">暂无API渠道，请添加</div>';
        return;
    }
    
    apiChannels.forEach(channel => {
        const item = document.createElement('div');
        item.className = 'channel-item';
        
        item.innerHTML = `
            <div class="channel-name">${channel.name}</div>
            <div class="channel-endpoint">${channel.endpoint}</div>
            <div class="model-count">${channel.models.length} 个模型</div>
            <div class="channel-actions">
                <button class="secondary-btn edit-channel" data-id="${channel.id}">
                    <i class="fas fa-edit"></i> 编辑
                </button>
                <button class="danger-btn delete-channel" data-id="${channel.id}">
                    <i class="fas fa-trash"></i> 删除
                </button>
            </div>
        `;
        
        // 编辑按钮
        item.querySelector('.edit-channel').addEventListener('click', () => {
            editChannel(channel.id);
        });
        
        // 删除按钮
        item.querySelector('.delete-channel').addEventListener('click', () => {
            confirmDelete(`确定要删除渠道"${channel.name}"吗？`, () => {
                deleteChannel(channel.id);
            });
        });
        
        list.appendChild(item);
    });
}

// 重置渠道表单
function resetChannelForm() {
    elements.channelForm.reset();
    elements.channelForm.dataset.mode = 'add';
    delete elements.channelForm.dataset.channelId;
    document.getElementById('channel-form-title').textContent = '添加API渠道';
}

// 编辑渠道
function editChannel(channelId) {
    const channel = apiChannels.find(c => c.id === channelId);
    if (!channel) return;
    
    document.getElementById('channel-form-title').textContent = '编辑API渠道';
    
    // 填充表单
    document.getElementById('channel-name').value = channel.name;
    document.getElementById('api-endpoint').value = channel.endpoint;
    document.getElementById('api-key').value = channel.key;
    
    const modelsText = channel.models.map(m => m.name).join('\n');
    document.getElementById('api-models').value = modelsText;
    
    // 设置表单模式
    elements.channelForm.dataset.mode = 'edit';
    elements.channelForm.dataset.channelId = channelId;
    
    showModal(elements.channelModal);
}

// 提交渠道表单
function submitChannelForm() {
    const name = document.getElementById('channel-name').value.trim();
    const endpoint = document.getElementById('api-endpoint').value.trim();
    const key = document.getElementById('api-key').value.trim();
    const modelsText = document.getElementById('api-models').value.trim();
    
    if (!name || !endpoint || !key) {
        showErrorMessage('请填写必填字段');
        return;
    }
    
    // 解析模型
    const modelNames = modelsText ? modelsText.split('\n').filter(Boolean) : ['default-model'];
    const models = modelNames.map(name => ({
        id: generateId(),
        name: name.trim()
    }));
    
    const mode = elements.channelForm.dataset.mode;
    
    if (mode === 'edit') {
        // 更新现有渠道
        const channelId = elements.channelForm.dataset.channelId;
        const index = apiChannels.findIndex(c => c.id === channelId);
        
        if (index !== -1) {
            apiChannels[index] = {
                ...apiChannels[index],
                name,
                endpoint,
                key,
                models
            };
            
            saveApiChannels();
            renderApiSelector();
            renderApiChannelsList();
            
            if (currentChannelId === channelId) {
                renderModelSelector(apiChannels[index]);
                checkAndUpdateBalance();
            }
        }
    } else {
        // 添加新渠道
        const newChannel = {
            id: generateId(),
            name,
            endpoint,
            key,
            models
        };
        
        apiChannels.push(newChannel);
        saveApiChannels();
        
        // 如果这是第一个渠道，自动选择它
        if (apiChannels.length === 1) {
            currentChannelId = newChannel.id;
            saveCurrentChannelId();
            renderApiSelector();
            renderModelSelector(newChannel);
            checkAndUpdateBalance();
        } else {
            renderApiSelector();
        }
        
        renderApiChannelsList();
    }
    
    // 关闭模态框并重置表单
    hideModal(elements.channelModal);
    resetChannelForm();
}

// 删除渠道
function deleteChannel(channelId) {
    const index = apiChannels.findIndex(c => c.id === channelId);
    if (index === -1) return;
    
    apiChannels.splice(index, 1);
    saveApiChannels();
    
    // 如果删除的是当前渠道，重置选择
    if (currentChannelId === channelId) {
        if (apiChannels.length > 0) {
            currentChannelId = apiChannels[0].id;
            saveCurrentChannelId();
            renderApiSelector();
            renderModelSelector(apiChannels[0]);
            checkAndUpdateBalance();
        } else {
            currentChannelId = null;
            localStorage.removeItem('currentChannelId');
            renderApiSelector();
            elements.modelSelector.innerHTML = '<option value="">选择模型</option>';
            elements.modelSelector.disabled = true;
            elements.apiBalance.textContent = '余额: --';
        }
    }
    
    renderApiChannelsList();
}

// 保存API渠道
function saveApiChannels() {
    localStorage.setItem('apiChannels', JSON.stringify(apiChannels));
}

// 保存当前渠道ID
function saveCurrentChannelId() {
    localStorage.setItem('currentChannelId', currentChannelId);
}
