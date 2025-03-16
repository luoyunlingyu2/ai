/**
 * UI相关功能和事件处理
 */

// 设置UI事件监听器
function setupUIEventListeners() {
    // 输入框自动调整高度
    elements.messageInput.addEventListener('input', () => {
        const input = elements.messageInput;
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 150) + 'px';
        
        // 当有输入内容时启用发送按钮
        elements.sendBtn.disabled = input.value.trim() === '';
    });
    
    // 侧边栏切换(移动设备)
    elements.sidebarToggleBtn.addEventListener('click', () => {
        elements.sidebar.classList.add('active');
    });
    
    elements.sidebarCloseBtn.addEventListener('click', () => {
        elements.sidebar.classList.remove('active');
    });
    
    // API渠道选择
    elements.apiSelector.addEventListener('change', function() {
        currentChannelId = this.value;
        saveCurrentChannelId();
        
        // 更新模型选择器
        if (currentChannelId) {
            const channel = apiChannels.find(c => c.id === currentChannelId);
            if (channel) {
                renderModelSelector(channel);
                checkAndUpdateBalance();
                
                // 更新当前对话的渠道和模型
                if (currentConversationId) {
                    const conversation = conversations.find(c => c.id === currentConversationId);
                    if (conversation) {
                        conversation.channelId = currentChannelId;
                        if (channel.models && channel.models.length > 0) {
                            conversation.modelId = channel.models[0].id;
                        }
                        saveConversations();
                    }
                }
            }
        } else {
            elements.modelSelector.innerHTML = '<option value="">选择模型</option>';
            elements.modelSelector.disabled = true;
            elements.apiBalance.textContent = '余额: --';
        }
    });
    
    // 模型选择
    elements.modelSelector.addEventListener('change', function() {
        if (!currentConversationId) return;
        
        const conversation = conversations.find(c => c.id === currentConversationId);
        if (conversation) {
            conversation.modelId = this.value;
            saveConversations();
        }
    });
    
    // 添加渠道按钮
    elements.addChannelBtn.addEventListener('click', () => {
        resetChannelForm();
        showModal(elements.channelModal);
    });
    
    // 渠道表单提交
    elements.channelForm.addEventListener('submit', function(e) {
        e.preventDefault();
        submitChannelForm();
    });
    
    // 渠道表单取消
    elements.channelForm.querySelector('.cancel-btn').addEventListener('click', () => {
        hideModal(elements.channelModal);
    });
    
    // 密码显示切换
    document.getElementById('toggle-password').addEventListener('click', function() {
        const input = document.getElementById('api-key');
        const type = input.type === 'password' ? 'text' : 'password';
        input.type = type;
        
        const icon = this.querySelector('i');
        if (type === 'text') {
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    });
    
    // 关闭按钮
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const modal = this.closest('.modal');
            hideModal(modal);
        });
    });
    
    // 点击模态框外部关闭
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                hideModal(this);
            }
        });
    });
    
    // 上下文菜单
    document.getElementById('renameConversation').addEventListener('click', () => {
        if (!targetConversationId) return;
        
        const conversation = conversations.find(c => c.id === targetConversationId);
        if (conversation) {
            document.getElementById('conversation-name').value = conversation.title;
            showModal(elements.renameModal);
        }
        
        hideContextMenu();
    });
    
    document.getElementById('deleteConversation').addEventListener('click', () => {
        if (!targetConversationId) return;
        
        confirmDelete('确定要删除此对话吗？', () => {
            deleteConversation(targetConversationId);
        });
        
        hideContextMenu();
    });
    
    // 重命名保存
    document.getElementById('rename-save').addEventListener('click', () => {
        const newName = document.getElementById('conversation-name').value.trim();
        if (!newName || !targetConversationId) return;
        
        renameConversation(targetConversationId, newName);
        hideModal(elements.renameModal);
    });
    
    // 重命名取消
    elements.renameModal.querySelector('.cancel-btn').addEventListener('click', () => {
        hideModal(elements.renameModal);
    });
    
    // 点击其他区域隐藏上下文菜单
    document.addEventListener('click', function(e) {
        if (!elements.conversationMenu.contains(e.target) && 
            !e.target.classList.contains('conversation-menu')) {
            hideContextMenu();
        }
    });
}

// 显示对话上下文菜单
function showConversationMenu(event, conversationId) {
    const menu = elements.conversationMenu;
    const rect = event.target.getBoundingClientRect();
    
    menu.style.top = `${rect.bottom + 5}px`;
    menu.style.left = `${rect.left}px`;
    menu.style.display = 'block';
    
    targetConversationId = conversationId;
}

// 隐藏上下文菜单
function hideContextMenu() {
    elements.conversationMenu.style.display = 'none';
    targetConversationId = null;
}

// 确认删除
function confirmDelete(message, callback) {
    document.getElementById('confirm-title').textContent = '确认删除';
    document.getElementById('confirm-message').textContent = message;
    
    const confirmBtn = document.getElementById('confirm-ok');
    const cancelBtn = document.getElementById('confirm-cancel');
    
    // 清除旧事件
    const newConfirmBtn = confirmBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    
    // 设置新事件
    newConfirmBtn.addEventListener('click', () => {
        callback();
        hideModal(elements.confirmModal);
    });
    
    newCancelBtn.addEventListener('click', () => {
        hideModal(elements.confirmModal);
    });
    
    showModal(elements.confirmModal);
}

// 显示模态框
function showModal(modal) {
    modal.style.display = 'block';
    document.body.classList.add('modal-open');
}

// 隐藏模态框
function hideModal(modal) {
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
}

// 显示错误消息
function showErrorMessage(message) {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = 'notification error';
    notification.innerHTML = `
        <i class="fas fa-exclamation-circle"></i> ${message}
        <button class="close-notification"><i class="fas fa-times"></i></button>
    `;
    
    // 添加到页面
    document.body.appendChild(notification);
    
    // 设置关闭按钮
    notification.querySelector('.close-notification').addEventListener('click', () => {
        document.body.removeChild(notification);
    });
    
    // 自动关闭
    setTimeout(() => {
        if (document.body.contains(notification)) {
            notification.classList.add('fade-out');
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }
    }, 3000);
}

// 滚动到底部
function scrollToBottom() {
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

// 更新响应时间
function updateResponseTime() {
    const elapsed = Math.floor((Date.now() - startTime) / 100) / 10;
    elements.timeStats.innerHTML = `<i class="fas fa-clock"></i> ${elapsed.toFixed(1)}s`;
}
