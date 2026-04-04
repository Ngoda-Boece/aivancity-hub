"""campus_assistant.py — Bot 1: Campus life and navigation guide."""

from chatbots.base_chatbot import BaseChatbot
from chatbots.prompt_templates import CAMPUS_ASSISTANT_PROMPT


class CampusAssistant(BaseChatbot):
    """
    Friendly senior-student-style guide for everything Aivancity.
    Covers campus layout, admin procedures, deadlines, student life.
    """

    name = "campus_assistant"
    description = (
        "Your campus guide for everything Aivancity: rooms, buildings, "
        "admin procedures, deadlines, and student life tips."
    )
    temperature = 0.7  # Slightly creative for a casual, warm tone

    @property
    def system_prompt(self) -> str:
        return CAMPUS_ASSISTANT_PROMPT


def generate_response(message: str, session_id: str = "default") -> str:
    """
    Functional interface for quick usage or testing.
    For production use, prefer instantiating CampusAssistant directly.
    """
    bot = CampusAssistant()
    return bot.chat(session_id, message)
