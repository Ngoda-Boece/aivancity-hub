"""interview_coach.py — Bot 4: Technical & HR interview preparation coach."""

from chatbots.base_chatbot import BaseChatbot
from chatbots.prompt_templates import INTERVIEW_COACH_PROMPT


class InterviewCoach(BaseChatbot):
    """
    Direct, challenging interview coach for AI/Data roles.
    Conducts mock interviews, gives structured feedback, covers HR,
    technical ML, and consulting case questions.
    """

    name = "interview_coach"
    description = (
        "Prepares you for AI/Data interviews at companies like Mistral, Capgemini, "
        "and Dataiku. Mock Q&A, structured feedback, and real insider tips."
    )
    temperature = 0.5  # Balanced: structured but not robotic

    @property
    def system_prompt(self) -> str:
        return INTERVIEW_COACH_PROMPT


def generate_response(message: str, session_id: str = "default") -> str:
    """Functional interface for quick usage or testing."""
    bot = InterviewCoach()
    return bot.chat(session_id, message)
