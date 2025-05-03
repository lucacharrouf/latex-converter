# claude_api.py
import requests
from config import CLAUDE_API_KEY

def convert_text_to_latex(text):
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": CLAUDE_API_KEY,
        "content-type": "application/json",
        "anthropic-version": "2023-06-01"
    }
    data = {
        "model": "claude-3-7-sonnet-20250219",
        "max_tokens": 2048,
        "messages": [{
            "role": "user",
            "content": f"Convert the following text into a LaTeX document:\n\n{text}"
        }]
    }
    response = requests.post(url, json=data, headers=headers)
    response.raise_for_status()
    return response.json()['content'][0]['text']