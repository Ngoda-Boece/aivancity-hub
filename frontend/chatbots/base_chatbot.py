"""
base_chatbot.py — Abstract base class for all 6 chatbots.

Provides:
- Mistral API integration via the official `mistralai` SDK
- Per-session conversation memory via ConversationMemory
- A single `chat()` method that handles the full request cycle
"""

import os
from abc import ABC, abstractmethod
from dotenv import load_dotenv
from mistralai.client import Mistral

from chatbots.memory import ConversationMemory

load_dotenv()


class BaseChatbot(ABC):
    """
    Abstract base for all specialized chatbots.

    Subclasses must define `system_prompt` and optionally override
    `model` and `temperature`.
    """

    # Default model — can be overridden in subclasses or via env var
    model: str = os.getenv("MISTRAL_MODEL", "mistral-large-latest")

    # Conversation temperature (0 = deterministic, 1 = creative)
    temperature: float = 0.6

    # Human-readable name and short description used by the API /bots endpoint
    name: str = ""
    description: str = ""

    def __init__(self):
        # Client is created lazily on first chat() call so the server
        # can start and serve /docs and /bots even without a .env configured.
        self._client: Mistral | None = None
        # session_id → ConversationMemory
        self._sessions: dict[str, ConversationMemory] = {}

    def _get_client(self) -> Mistral:
        """Return (and lazily create) the Mistral API client."""
        if self._client is None:
            api_key = os.getenv("MISTRAL_API_KEY")
            if not api_key:
                raise EnvironmentError(
                    "MISTRAL_API_KEY is not set. "
                    "Please copy .env.example to .env and add your key."
                )
            self._client = Mistral(api_key=api_key)
        return self._client

    # ------------------------------------------------------------------
    # Abstract interface
    # ------------------------------------------------------------------

    @property
    @abstractmethod
    def system_prompt(self) -> str:
        """Return the system-level instruction string for this bot."""

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def chat(self, session_id: str, user_message: str) -> str:
        """
        Process a user message and return the assistant's reply.

        Maintains per-session conversation history automatically.

        Args:
            session_id: Unique identifier for the user's session.
            user_message: The raw text message from the user.

        Returns:
            The assistant's reply as a string.
        """
        memory = self._get_or_create_memory(session_id)
        memory.add_message("user", user_message)

        messages = memory.to_mistral_messages(self.system_prompt)

        response = self._get_client().chat.complete(
            model=self.model,
            messages=messages,
            temperature=self.temperature,
        )

        reply = response.choices[0].message.content
        memory.add_message("assistant", reply)
        return reply

    def clear_session(self, session_id: str) -> None:
        """Clear the conversation history for a given session."""
        if session_id in self._sessions:
            self._sessions[session_id].clear()

    def get_history(self, session_id: str) -> list[dict]:
        """Return the raw message history for a session."""
        return self._get_or_create_memory(session_id).get_history()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get_or_create_memory(self, session_id: str) -> ConversationMemory:
        if session_id not in self._sessions:
            self._sessions[session_id] = ConversationMemory()
        return self._sessions[session_id]

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(model={self.model!r})"
