"""wellness_bot.py — Bot 3: Mental health & emotional wellness companion."""

from chatbots.base_chatbot import BaseChatbot
from chatbots.prompt_templates import WELLNESS_BOT_PROMPT


class WellnessBot(BaseChatbot):
    """
    Calm, warm emotional support companion for student wellbeing.
    Non-clinical — never diagnoses, always redirects to professional help
    when there are signs of crisis.
    """

    name = "wellness"
    description = (
        "A calm, non-judgmental companion for stress, burnout, and emotional support. "
        "Offers coping strategies and redirects to professionals when needed."
    )
    temperature = 0.6  # Warm but measured — not too unpredictable

    @property
    def system_prompt(self) -> str:
        return WELLNESS_BOT_PROMPT


def generate_response(message: str, session_id: str = "default") -> str:
    """Functional interface for quick usage or testing."""
    bot = WellnessBot()
    return bot.chat(session_id, message)
