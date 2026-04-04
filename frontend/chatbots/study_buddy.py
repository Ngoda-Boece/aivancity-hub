"""study_buddy.py — Bot 5: Academic assistant for ML, math, code & more."""

from chatbots.base_chatbot import BaseChatbot
from chatbots.prompt_templates import STUDY_BUDDY_PROMPT


class StudyBuddy(BaseChatbot):
    """
    Enthusiastic, nerdy study companion covering ML, maths, Python,
    databases, and AI ethics. Adapts to beginner → advanced level,
    debugs code, and builds study plans.
    """

    name = "study_buddy"
    description = (
        "Your nerdy academic companion! Explains ML, maths, Python, and AI ethics. "
        "Debugs your code, creates study plans, and makes learning fun."
    )
    temperature = 0.7  # Creative and expressive — fits the enthusiastic personality

    @property
    def system_prompt(self) -> str:
        return STUDY_BUDDY_PROMPT


def generate_response(message: str, session_id: str = "default") -> str:
    """Functional interface for quick usage or testing."""
    bot = StudyBuddy()
    return bot.chat(session_id, message)
