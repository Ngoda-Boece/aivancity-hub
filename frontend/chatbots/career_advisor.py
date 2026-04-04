"""career_advisor.py — Bot 6: Career planning & CV strategy advisor."""

from chatbots.base_chatbot import BaseChatbot
from chatbots.prompt_templates import CAREER_ADVISOR_PROMPT


class CareerAdvisor(BaseChatbot):
    """
    Thoughtful, strategic career coach for AI/Data students.
    Covers role exploration, CV review, the French/European job market,
    and personalized career path strategy.
    """

    name = "career_advisor"
    description = (
        "Strategic career coach for Aivancity students. CV review, role exploration, "
        "French/European job market guidance, and personalized career strategy."
    )
    temperature = 0.6  # Thoughtful and measured, with room for nuance

    @property
    def system_prompt(self) -> str:
        return CAREER_ADVISOR_PROMPT


def generate_response(message: str, session_id: str = "default") -> str:
    """Functional interface for quick usage or testing."""
    bot = CareerAdvisor()
    return bot.chat(session_id, message)
