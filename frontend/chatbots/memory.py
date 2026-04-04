"""
memory.py — Per-session conversation memory management.

Each ConversationMemory instance holds an ordered list of messages
(role + content) for a single user session. Sessions are keyed by
a client-supplied session_id string.
"""


class ConversationMemory:
    """Stores and manages the message history for a single chat session."""

    def __init__(self, max_turns: int = 40):
        """
        Args:
            max_turns: Maximum number of message pairs (user + assistant)
                       to keep in memory. Older messages are dropped first
                       to keep context windows manageable.
        """
        self._messages: list[dict] = []
        self.max_turns = max_turns  # max_turns * 2 = max messages

    # ------------------------------------------------------------------
    # Core operations
    # ------------------------------------------------------------------

    def add_message(self, role: str, content: str) -> None:
        """Append a single message. role should be 'user' or 'assistant'."""
        self._messages.append({"role": role, "content": content})
        self._trim()

    def get_history(self) -> list[dict]:
        """Return a copy of the full message history."""
        return list(self._messages)

    def clear(self) -> None:
        """Wipe all messages (but keep the object alive for reuse)."""
        self._messages.clear()

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def to_mistral_messages(self, system_prompt: str) -> list[dict]:
        """
        Build the messages list expected by the Mistral chat completions API.
        The system prompt is always prepended as the first message.
        """
        return [{"role": "system", "content": system_prompt}] + self._messages

    def _trim(self) -> None:
        """Drop the oldest user+assistant pair when over the turn limit."""
        max_messages = self.max_turns * 2
        while len(self._messages) > max_messages:
            # Remove the oldest user message and its assistant reply
            self._messages.pop(0)
            if self._messages:
                self._messages.pop(0)

    def __len__(self) -> int:
        return len(self._messages)

    def __repr__(self) -> str:
        return f"ConversationMemory(messages={len(self._messages)})"
