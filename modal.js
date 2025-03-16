/**
 * 模态框功能 - 独立模块确保API设置可以打开
 */

// 等待DOM完全加载
document.addEventListener('DOMContentLoaded', () => {
    debug('DOM已加载，初始化模态框功能');
    initModals();
});

// 初始化所有模态框
function initModals() {
    // 获取所有模态框
    const modals = document.querySelectorAll('.modal');
    debug(`发现${modals.length}个模态框`);
    
    // 设置关闭按钮
    document.querySelectorAll('.close-btn, .cancel-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            if (modal) {
                hideModal(modal.id);
            }
        });
    });
    
    // 点击模态框背景关闭
    modals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideModal(modal.id);
            }
        });
    });
    
    // 设置按钮 - 直接绑定设置模态框
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        debug('找到设置按钮，绑定点击事件');
        settingsBtn.addEventListener('click', () => {
            // 渲染API列表
            try {
                if (typeof renderApiChannelsList === 'function') {
                    debug('渲染API渠道列表');
                    renderApiChannelsList();
                } else {
                    debug('渲染函数不存在，尝试替代方案');
                    // 简单渲染逻辑
                    const channelsList = document.getElementById('api-channels-list');
                    if (channelsList && window.apiChannels) {
                        renderChannelsBackup(channelsList, window.apiChannels);
                    }
                }
            } catch (err) {
                debug('渲染API列表出错', err);
            }
            
            // 显示设置模态框
            showModal('settings-modal');
        });
    } else {
        debug('未找到设置按钮!');
    }
    
    // 其他模态框初始化...
    initChannelModal();
    initConfirmModal();
    initRenameModal();
}

// 显示模态框
function showModal(modalId) {
    debugModal('打开', modalId);
    
    const modal = document.getElementById(modalId);
    if (!modal) {
        debug(`错误: 未找到ID为${modalId}的模态框`);
        return;
    }
    
    // 强制重置样式确保可见
    modal.style.cssText = "display: block !important; opacity: 1 !important; visibility: visible !important; z-index: 1000 !important;";
    document.body.classList.add('modal-open');
    
    // 动画效果
    const content = modal.querySelector('.modal-content');
    if (content) {
        content.classList.add('animate-in');
        setTimeout(() => content.classList.remove('animate-in'), 300);
    }
}

// 隐藏模态框
function hideModal(modalId) {
    debugModal('关闭', modalId);
    
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
}

// API渠道表单初始化
function initChannelModal() {
    const addChannelBtn = document.getElementById('add-channel-btn');
    if (addChannelBtn) {
        addChannelBtn.addEventListener('click', () => {
            // 重置表单
            const form = document.getElementById('channel-form');
            if (form) form.reset();
            
            // 更新标题
            const title = document.getElementById('channel-modal-title');
            if (title) title.textContent = '添加API渠道';
            
            // 清除ID
            form.removeAttribute('data-channel-id');
            
            showModal('channel-modal');
        });
    }
    
    // 表单提交
    const channelForm = document.getElementById('channel-form');
    if (channelForm) {
        channelForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveChannel();
        });
    }
    
    // 密码切换
    const togglePassword = document.getElementById('toggle-password');
    if (togglePassword) {
        togglePassword.addEventListener('click', () => {
            const apiKey = document.getElementById('api-key');
            if (apiKey) {
                const type = apiKey.type === 'password' ? 'text' : 'password';
                apiKey.type = type;
                
                const icon = togglePassword.querySelector('i');
                if (icon) {
                    icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
                }
            }
        });
    }
}

// 确认对话框初始化
function initConfirmModal() {
    // 已在通用处理中处理了关闭按钮
}

// 重命名对话框初始化
function initRenameModal() {
    const renameForm = document.getElementById('rename-save');
    if (renameForm) {
        renameForm.addEventListener('click', () => {
            const input = document.getElementById('conversation-name');
            if (input && window.targetConversationId) {
                const newName = input.value.trim();
                if (newName && typeof renameConversation === 'function') {
                    renameConversation(window.targetConversationId, newName);
                }
                hideModal('rename-modal');
            }
        });
    }
}

// 备用渲染API渠道列表函数
function renderChannelsBackup(container, channels) {
    if (!container || !channels) return;
    
    container.innerHTML = '';
    
    if (channels.length === 0) {
        container.innerHTML = '<div class="empty-list">尚未添加API渠道</div>';
        return;
    }
    
    channels.forEach(channel => {
        const item = document.createElement('div');
        item.className = 'channel-item';
        
        const modelCount = channel.models ? channel.models.length : 0;
        
        item.innerHTML = `
            <div class="channel-info">
                <div class="channel-name">${channel.name || '未命名'}</div>
                <div class="channel-endpoint">${channel.endpoint || '未设置'}</div>
                <div class="model-count">支持${modelCount}个模型</div>
            </div>
            <div class="channel-actions">
                <button class="icon-btn edit-channel" data-id="${channel.id}">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="icon-btn delete-channel" data-id="${channel.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        container.appendChild(item);
    });
    
    // 添加编辑/删除事件
    container.querySelectorAll('.edit-channel').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            if (id && typeof editChannel === 'function') {
                editChannel(id);
            }
        });
    });
    
    container.querySelectorAll('.delete-channel').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            if (id) {
                confirmDelete('确定要删除此API渠道吗?', () => {
                    if (typeof deleteChannel === 'function') {
                        deleteChannel(id);
                    }
                });
            }
        });
    });
}

// 保存渠道
function saveChannel() {
    const form = document.getElementById('channel-form');
    if (!form) return;
    
    const name = document.getElementById('channel-name').value.trim();
    const endpoint = document.getElementById('api-endpoint').value.trim();
    const key = document.getElementById('api-key').value.trim();
    const modelsText = document.getElementById('api-models').value.trim();
    
    if (!name || !endpoint || !key) {
        alert('请填写所有必填字段');
        return;
    }
    
    // 处理模型列表
    const modelLines = modelsText.split('\n').filter(line => line.trim());
    const models = modelLines.map(line => {
        const trimmed = line.trim();
        return {
            id: trimmed,
            name: trimmed
        };
    });
    
    // 如果没有模型，添加默认模型
    if (models.length === 0) {
        if (endpoint.includes('openai.com')) {
            models.push({ id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' });
            models.push({ id: 'gpt-4', name: 'GPT-4' });
        } else if (endpoint.includes('anthropic.com')) {
            models.push({ id: 'claude-instant-1', name: 'Claude Instant' });
            models.push({ id: 'claude-2', name: 'Claude 2' });
        } else {
            models.push({ id: 'default', name: '默认模型' });
        }
    }
    
    const channelId = form.getAttribute('data-channel-id');
    
    // 创建渠道对象
    const channel = {
        id: channelId || generateId(),
        name,
        endpoint,
        key,
        models
    };
    
    // 更新全局状态
    if (!window.apiChannels) window.apiChannels = [];
    
    if (channelId) {
        // 更新已有渠道
        const index = window.apiChannels.findIndex(c => c.id === channelId);
        if (index !== -1) {
            window.apiChannels[index] = channel;
        }
    } else {
        // 添加新渠道
        window.apiChannels.push(channel);
    }
    
    // 保存到localStorage
    localStorage.setItem('apiChannels', JSON.stringify(window.apiChannels));
    
    // 重新渲染列表
    const channelsList = document.getElementById('api-channels-list');
    if (channelsList) {
        renderChannelsBackup(channelsList, window.apiChannels);
    }
    
    // 关闭模态框
    hideModal('channel-modal');
    
    // 更新选择器
    if (typeof renderApiSelector === 'function') {
        renderApiSelector();
    }
}

// 确认删除
function confirmDelete(message, callback) {
    const confirmMessage = document.getElementById('confirm-message');
    if (confirmMessage) confirmMessage.textContent = message;
    
    const okBtn = document.getElementById('confirm-ok');
    const cancelBtn = document.getElementById('confirm-cancel');
    
    if (okBtn) {
        // 克隆并替换按钮以移除旧事件
        const newOkBtn = okBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOkBtn, okBtn);
        
        // 添加新事件
        newOkBtn.addEventListener('click', () => {
            if (typeof callback === 'function') callback();
            hideModal('confirm-modal');
        });
    }
    
    if (cancelBtn) {
        // 克隆并替换按钮以移除旧事件
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        
        // 添加新事件
        newCancelBtn.addEventListener('click', () => {
            hideModal('confirm-modal');
        });
    }
    
    showModal('confirm-modal');
}

// 如果没有这个函数，定义一个
if (typeof generateId !== 'function') {
    function generateId() {
        return Math.random().toString(36).substr(2, 9);
    }
}
