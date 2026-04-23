import httpx
import json
from django.conf import settings

class GroqClient:
    """Cliente para la API de Groq."""

    def __init__(self):
        self.api_key = settings.GROQ_API_KEY
        self.model = settings.GROQ_MODEL
        self.base_url = 'https://api.groq.com/openai/v1'

    def chat(self, messages: list, options: dict = None) -> dict:
        payload = {
            'model': self.model,
            'messages': messages,
            'temperature': 0.7,
            'max_tokens': 1024,
        }
        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json',
        }
        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                f'{self.base_url}/chat/completions',
                json=payload,
                headers=headers
            )
            response.raise_for_status()
            data = response.json()
            return {
                'message': {
                    'content': data['choices'][0]['message']['content']
                },
                'eval_count': data.get('usage', {}).get('completion_tokens', 0)
            }

    def health_check(self) -> bool:
        try:
            headers = {'Authorization': f'Bearer {self.api_key}'}
            with httpx.Client(timeout=5.0) as client:
                r = client.get(f'{self.base_url}/models', headers=headers)
                return r.status_code == 200
        except Exception:
            return False

# Instancia global con nombre correcto
groq_client = GroqClient()