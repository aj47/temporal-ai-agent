const API_BASE_URL = 'http://127.0.0.1:8000';

class ApiError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
        this.name = 'ApiError';
    }
}

async function handleResponse(response) {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
            errorData.message || 'An error occurred',
            response.status
        );
    }
    return response.json();
}

export const apiService = {
    async getConversationHistory() {
        try {
            const res = await fetch(`${API_BASE_URL}/get-conversation-history`);
            return handleResponse(res);
        } catch (error) {
            throw new ApiError(
                'Failed to fetch conversation history',
                error.status || 500
            );
        }
    },

    async sendMessage(message, isVoiceMessage = false) {
        if (!message?.trim()) {
            throw new ApiError('Message cannot be empty', 400);
        }

        try {
            // Add a prefix for voice messages to differentiate them in logs if needed
            const formattedMessage = isVoiceMessage ? `[Voice] ${message}` : message;

            const res = await fetch(
                `${API_BASE_URL}/send-prompt?prompt=${encodeURIComponent(formattedMessage)}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );
            return handleResponse(res);
        } catch (error) {
            throw new ApiError(
                'Failed to send message',
                error.status || 500
            );
        }
    },

    async startWorkflow() {
        try {
            const res = await fetch(
                `${API_BASE_URL}/start-workflow`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );
            return handleResponse(res);
        } catch (error) {
            throw new ApiError(
                'Failed to start workflow',
                error.status || 500
            );
        }
    },

    async confirm() {
        try {
            const res = await fetch(`${API_BASE_URL}/confirm`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return handleResponse(res);
        } catch (error) {
            throw new ApiError(
                'Failed to confirm action',
                error.status || 500
            );
        }
    },

    async getAgentGoal() {
        try {
            const res = await fetch(`${API_BASE_URL}/agent-goal`);
            return handleResponse(res);
        } catch (error) {
            throw new ApiError(
                'Failed to fetch agent goal',
                error.status || 500
            );
        }
    },

    async getToolData() {
        try {
            const res = await fetch(`${API_BASE_URL}/tool-data`);
            return handleResponse(res);
        } catch (error) {
            throw new ApiError(
                'Failed to fetch tool data',
                error.status || 500
            );
        }
    },

    async endChat() {
        try {
            const res = await fetch(`${API_BASE_URL}/end-chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return handleResponse(res);
        } catch (error) {
            throw new ApiError(
                'Failed to end chat',
                error.status || 500
            );
        }
    }
};