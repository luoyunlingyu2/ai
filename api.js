/**
 * API通信功能
 */

// 调用AI API获取响应
async function callAIAPI(channel, conversation, userMessage) {
    if (!channel || !conversation) {
        throw new Error('无效的API渠道或对话');
    }
    
    // 获取当前模型
    const modelId = conversation.modelId;
    const model = channel.models.find(m => m.id === modelId);
    const modelName = model ? model.name : channel.models[0].name;
    
    // 创建消息数组
    const messages = conversation.messages.map(m => ({
        role: m.role,
        content: m.content
    }));
    
    try {
        // 准备请求头
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // 根据不同API设置不同的认证方式
        if (channel.endpoint.includes('anthropic.com')) {
            headers['x-api-key'] = channel.key;
        } else {
            headers['Authorization'] = `Bearer ${channel.key}`;
        }
        
        // 准备请求体
        let requestBody = {
            model: modelName,
            messages: messages,
            stream: true
        };
        
        // Anthropic Claude API特殊处理
        if (channel.endpoint.includes('anthropic.com')) {
            requestBody = {
                model: modelName,
                messages: messages.map(m => ({
                    role: m.role === 'assistant' ? 'assistant' : 'user',
                    content: m.content
                })),
                stream: true
            };
        }
        
        // 发送请求
        const response = await fetch(channel.endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            let errorMessage = `API请求失败 (${response.status})`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error?.message || errorData.error || errorMessage;
            } catch (e) {
                // 如果解析JSON失败，使用响应文本
                const text = await response.text();
                errorMessage = text || errorMessage;
            }
            throw new Error(errorMessage);
        }
        
        return response;
    } catch (error) {
        console.error('API调用出错:', error);
        throw error;
    }
}

// 处理流式响应
async function handleStreamResponse(response, onData, onComplete) {
    if (!response.body) {
        throw new Error('响应没有数据流');
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let completeText = '';
    
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim() !== '');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    
                    // 检查流是否结束
                    if (data === '[DONE]') continue;
                    
                    try {
                        const json = JSON.parse(data);
                        let textDelta = '';
                        
                        // OpenAI格式
                        if (json.choices && json.choices[0]?.delta?.content) {
                            textDelta = json.choices[0].delta.content;
                        } 
                        // Anthropic Claude格式
                        else if (json.type === 'content_block_delta' && json.delta?.text) {
                            textDelta = json.delta.text;
                        }
                        // 通用格式
                        else if (json.output || json.result || json.text || json.content) {
                            textDelta = json.output || json.result || json.text || json.content;
                        }
                        
                        if (textDelta) {
                            completeText += textDelta;
                            onData(textDelta, completeText);
                        }
                    } catch (e) {
                        console.error('解析流数据失败:', e);
                    }
                }
            }
        }
        
        // 流处理完成后回调
        onComplete(completeText);
        return completeText;
    } catch (error) {
        console.error('处理流数据出错:', error);
        throw error;
    }
}

// 检查API余额
async function checkApiBalance(channel) {
    if (!channel) return '未设置API';
    
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
                return `$${data.total_available.toFixed(2)}`;
            } else {
                return '查询失败';
            }
        } else if (channel.endpoint.includes('anthropic.com')) {
            // Anthropic API
            return '不支持查询';
        } else {
            // 其他API
            return '不支持查询';
        }
    } catch (error) {
        console.error('查询余额失败:', error);
        return '查询失败';
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
