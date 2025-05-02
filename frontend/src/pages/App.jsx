import React, { useEffect, useState, useRef, useCallback } from "react";
import NavBar from "../components/NavBar";
import ChatWindow from "../components/ChatWindow";
import VoiceControl from "../components/VoiceControl";
import { apiService } from "../services/api";
import vapiService from "../services/vapiService";

const POLL_INTERVAL = 500; // 0.5 seconds
const INITIAL_ERROR_STATE = { visible: false, message: '' };

export default function App() {
    const containerRef = useRef(null);
    const inputRef = useRef(null);
    const pollingRef = useRef(null);
    const scrollTimeoutRef = useRef(null);

    const [conversation, setConversation] = useState([]);
    const [lastMessage, setLastMessage] = useState(null);
    const [userInput, setUserInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(INITIAL_ERROR_STATE);
    const [done, setDone] = useState(true);

    // Uncomment if debounced input is needed in the future
    // const debouncedUserInput = useDebounce(userInput, DEBOUNCE_DELAY);

    const errorTimerRef = useRef(null);

    const handleError = useCallback((error, context) => {
        console.error(`${context}:`, error);

        const isConversationFetchError = error.status === 404;
        const errorMessage = isConversationFetchError
            ? "Error fetching conversation. Retrying..."  // Updated message
            : `Error ${context.toLowerCase()}. Please try again.`;

        setError(prevError => {
            // If the same 404 error is already being displayed, don't reset state (prevents flickering)
            if (prevError.visible && prevError.message === errorMessage) {
                return prevError;
            }
            return { visible: true, message: errorMessage };
        });

        // Clear any existing timeout
        if (errorTimerRef.current) {
            clearTimeout(errorTimerRef.current);
        }

        // Only auto-dismiss non-404 errors after 3 seconds
        if (!isConversationFetchError) {
            errorTimerRef.current = setTimeout(() => setError(INITIAL_ERROR_STATE), 3000);
        }
    }, []);


    const clearErrorOnSuccess = useCallback(() => {
        if (errorTimerRef.current) {
            clearTimeout(errorTimerRef.current);
        }
        setError(INITIAL_ERROR_STATE);
    }, []);

    const fetchConversationHistory = useCallback(async () => {
        try {
            const data = await apiService.getConversationHistory();
            const newConversation = data.messages || [];

            // Only update the conversation if it's different from what we have
            // This prevents flickering and maintains local optimistic updates
            setConversation(prevConversation => {
                // If the lengths are different, definitely update
                if (prevConversation.length !== newConversation.length) {
                    return newConversation;
                }

                // Check if the conversations are different
                const isDifferent = JSON.stringify(prevConversation) !== JSON.stringify(newConversation);

                // If they're different but have the same length, we need to be careful
                // not to lose optimistically added messages that haven't been processed by the backend yet
                if (isDifferent) {
                    // Get the last message from both conversations
                    const lastServerMsg = newConversation[newConversation.length - 1];
                    const lastLocalMsg = prevConversation[prevConversation.length - 1];

                    // If the last local message is a user message and the last server message is not,
                    // it means the backend hasn't processed our message yet, so keep our local version
                    if (lastLocalMsg.actor === "user" && lastServerMsg.actor !== "user") {
                        // Keep our optimistic update and add the new server message
                        return [...newConversation, lastLocalMsg];
                    }

                    return newConversation;
                }

                return prevConversation;
            });

            if (newConversation.length > 0) {
                const lastMsg = newConversation[newConversation.length - 1];
                const isAgentMessage = lastMsg.actor === "agent";

                setLoading(!isAgentMessage);
                setDone(lastMsg.response?.next === "done");

                setLastMessage(prevLastMessage =>
                    !prevLastMessage || lastMsg.response?.response !== prevLastMessage.response?.response
                        ? lastMsg
                        : prevLastMessage
                );
            } else {
                setLoading(false);
                setDone(true);
                setLastMessage(null);
            }

            // Successfully fetched data, clear any persistent errors
            clearErrorOnSuccess();
        } catch (err) {
            handleError(err, "fetching conversation");
        }
    }, [handleError, clearErrorOnSuccess]);

    // Setup polling with cleanup
    useEffect(() => {
        pollingRef.current = setInterval(fetchConversationHistory, POLL_INTERVAL);

        return () => clearInterval(pollingRef.current);
    }, [fetchConversationHistory]);

    // Initialize VAPI service and clean up on unmount
    useEffect(() => {
        // Initialize VAPI service
        vapiService.initialize();

        // Clean up VAPI service on unmount
        return () => {
            vapiService.cleanup();
        };
    }, []);


    const scrollToBottom = useCallback(() => {
        if (containerRef.current) {
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }

            scrollTimeoutRef.current = setTimeout(() => {
                const element = containerRef.current;
                element.scrollTop = element.scrollHeight;
                scrollTimeoutRef.current = null;
            }, 100);
        }
    }, []);

    const handleContentChange = useCallback(() => {
        scrollToBottom();
    }, [scrollToBottom]);

    useEffect(() => {
        if (lastMessage) {
            scrollToBottom();
        }
    }, [lastMessage, scrollToBottom]);

    useEffect(() => {
        if (inputRef.current && !loading && !done) {
            inputRef.current.focus();
        }

        return () => {
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
        };
    }, [loading, done]);

    const handleSendMessage = async () => {
        const trimmedInput = userInput.trim();
        if (!trimmedInput) return;

        try {
            // Immediately add user message to local conversation state for instant feedback
            setConversation(prevConversation => [
                ...prevConversation,
                { actor: "user", response: trimmedInput }
            ]);

            setLoading(true);
            setError(INITIAL_ERROR_STATE);
            await apiService.sendMessage(trimmedInput);
            setUserInput("");
        } catch (err) {
            // If there's an error, we should remove the optimistically added message
            setConversation(prevConversation =>
                prevConversation.filter(msg => !(msg.actor === "user" && msg.response === trimmedInput))
            );
            handleError(err, "sending message");
            setLoading(false);
        }
    };

    const handleConfirm = async () => {
        try {
            setLoading(true);
            setError(INITIAL_ERROR_STATE);
            await apiService.confirm();
        } catch (err) {
            handleError(err, "confirming action");
            setLoading(false);
        }
    };

    const handleStartNewChat = async () => {
        try {
            setError(INITIAL_ERROR_STATE);
            setLoading(true);
            await apiService.startWorkflow();
            setConversation([]);
            setLastMessage(null);
        } catch (err) {
            handleError(err, "starting new chat");
        } finally {
            setLoading(false);
        }
    };

    // Handle voice messages from VAPI
    const handleVoiceMessage = async (transcript) => {
        if (!transcript || loading || done) return;

        try {
            // Immediately add voice message to local conversation state for instant feedback
            setConversation(prevConversation => [
                ...prevConversation,
                { actor: "user", response: `[Voice] ${transcript}` }
            ]);

            setLoading(true);
            setError(INITIAL_ERROR_STATE);
            await apiService.sendMessage(transcript, true); // true indicates it's a voice message
        } catch (err) {
            // If there's an error, we should remove the optimistically added message
            setConversation(prevConversation =>
                prevConversation.filter(msg => !(msg.actor === "user" && msg.response === `[Voice] ${transcript}`))
            );
            handleError(err, "sending voice message");
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-screen">
            <NavBar title="Temporal AI Agent 🤖" />

            {error.visible && (
                <div className="fixed top-16 left-1/2 transform -translate-x-1/2
                    bg-red-500 text-white px-4 py-2 rounded shadow-lg z-50
                    transition-opacity duration-300">
                    {error.message}
                </div>
            )}

            <div className="flex-grow flex justify-center px-4 py-2 overflow-hidden">
                <div className="w-full max-w-lg bg-white dark:bg-gray-900 p-8 px-3 rounded shadow-md
                    flex flex-col overflow-hidden">
                    <div ref={containerRef}
                        className="flex-grow overflow-y-auto pb-20 pt-10 scroll-smooth">
                        <ChatWindow
                            conversation={conversation}
                            loading={loading}
                            onConfirm={handleConfirm}
                            onContentChange={handleContentChange}
                        />
                        {done && (
                            <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4
                                animate-fade-in">
                                Chat ended
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2
                w-full max-w-lg bg-white dark:bg-gray-900 p-4
                border-t border-gray-300 dark:border-gray-700 shadow-lg
                transition-all duration-200"
                style={{ zIndex: 10 }}>
                <div className="flex items-center gap-2">
                    {/* Voice control component */}
                    <div className="flex-shrink-0">
                        <VoiceControl
                            onVoiceMessage={handleVoiceMessage}
                            disabled={loading || done}
                        />
                    </div>

                    {/* Text input form */}
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        handleSendMessage();
                    }} className="flex items-center flex-grow">
                        <input
                            ref={inputRef}
                            type="text"
                            className={`flex-grow rounded-l px-3 py-2 border border-gray-300
                                dark:bg-gray-700 dark:border-gray-600 focus:outline-none
                                transition-opacity duration-200
                                ${loading || done ? "opacity-50 cursor-not-allowed" : ""}`}
                            placeholder="Type your message..."
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            disabled={loading || done}
                            aria-label="Type your message"
                        />
                        <button
                            type="submit"
                            className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-r
                                transition-all duration-200
                                ${loading || done ? "opacity-50 cursor-not-allowed" : ""}`}
                            disabled={loading || done}
                            aria-label="Send message"
                        >
                            Send
                        </button>
                    </form>
                </div>

                <div className="text-right mt-3">
                    <button
                        onClick={handleStartNewChat}
                        className={`text-sm underline text-gray-600 dark:text-gray-400
                            hover:text-gray-800 dark:hover:text-gray-200
                            transition-all duration-200
                            ${!done ? "opacity-0 cursor-not-allowed" : ""}`}
                        disabled={!done}
                        aria-label="Start new chat"
                    >
                        Start New Chat
                    </button>
                </div>
            </div>
        </div>
    );
}
