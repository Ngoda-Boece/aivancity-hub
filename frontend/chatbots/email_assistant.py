"""email_assistant.py — Bot 2: Professional email writing assistant (FR/EN)."""

from chatbots.base_chatbot import BaseChatbot
from chatbots.prompt_templates import EMAIL_ASSISTANT_PROMPT


class EmailAssistant(BaseChatbot):
    """
    Precise, professional assistant for crafting academic and work emails.
    Supports French and English, adapts tone, and suggests subject lines.
    """

    name = "email_assistant"
    description = (
        "Helps you write polished professional emails in French or English. "
        "Adapts tone from formal to semi-formal and suggests subject lines."
    )
    temperature = 0.4  # Low: precision and consistency are key for emails

    @property
    def system_prompt(self) -> str:
        return EMAIL_ASSISTANT_PROMPT


def generate_response(message: str, session_id: str = "default") -> str:
    """Functional interface for quick usage or testing."""
    bot = EmailAssistant()
    return bot.chat(session_id, message)
