// api.js - 处理API相关功能

/**
 * 调用AI API
 * @param {Object} channel - API渠道信息
 * @param {Array} messages - 对话消息数组
 * @param {Object} assistantMessage - 助手消息对象，用于更新内容
 * @returns {Promise<Object>} - 返回包含内容和tokens的对象
 */
async function callAIAPI(channel, messages, assistantMessage) {
    // 获取选中的模型
    const conversation = conversations.find(c => c.id === currentConversationId);
    const modelId = conversation.modelId;
    const modelObj = channel.models.find(m => m.id === modelId);
    const model = modelObj ? modelObj.name : channel.models[0].name;
    
    try {
        // 准备通用API请求头
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${channel.key}`
        };
        
        // 根据不同API调整请求结构
        let endpoint = channel.endpoint;
        let requestBody = {
            model: model,
            messages: messages,
            stream: true
        };
        
        // 特殊API处理
        if (channel.endpoint.includes('anthropic.com')) {
            // Anthropic Claude API
            headers['x-api-key'] = channel.key;
            delete headers['Authorization'];
            
            // 调整消息格式
            const claudeMessages = messages.map(m => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: m.content
            }));
            
            requestBody = {
                model: model,
                messages: claudeMessages,
                stream: true
            };
        }
        
        // 发送请求
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            // 尝试获取错误信息
            const errorText = await response.text();
            let errorMsg = `API请求失败，状态码: ${response.status}`;
            try {
                const errorData = JSON.parse(errorText);
                errorMsg = errorData.error?.message || errorData.error || errorMsg;
            } catch (e) {
                // 如果不是JSON格式，使用原始错误文本
                errorMsg = errorText || errorMsg;
            }
            throw new Error(errorMsg);
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
                        // Anthropic Claude格式
                        else if (json.type === 'content_block_delta' && json.delta?.text) {
                            delta = json.delta.text;
                        }
                        // 通用格式
                        else if (json.output || json.result || json.text || json.content) {
                            delta = json.output || json.result || json.text || json.content;
                        }
                        
                        if (delta) {
                            content += delta;
                            // 实时更新UI和对话
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

/**
 * 检查API余额
 */
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
        } else if (channel.endpoint.includes('anthropic.com')) {
            // Anthropic API (可能不支持余额查询)
            apiBalance.textContent = '余额: 不支持查询';
        } else {
            // 其他API，显示暂不支持
            apiBalance.textContent = '余额: 不支持查询';
        }
    } catch (error) {
        console.error('查询余额失败:', error);
        apiBalance.textContent = '余额: 查询失败';
    }
}

/**
 * 估算tokens数量 (粗略估计)
 * @param {string} text - 输入文本
 * @returns {number} - 估算的token数量
 */
function estimateTokens(text) {
    if (!text) return 0;
    
    // 粗略估计，英文约4字符/token，中文约2字符/token
    const englishChars = text.replace(/[\u4e00-\u9fa5]/g, '').length;
    const chineseChars = text.length - englishChars;
    return Math.ceil(englishChars / 4 + chineseChars / 2);
}
