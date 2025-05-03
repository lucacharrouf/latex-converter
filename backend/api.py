import requests
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
CLAUDE_API_KEY = os.getenv('CLAUDE_API_KEY')

def convert_text_to_latex(text):
    """
    Convert text to LaTeX using Claude API.
    This provides better conversion quality than basic text replacement.
    """
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": CLAUDE_API_KEY,
        "content-type": "application/json",
        "anthropic-version": "2023-06-01"
    }
    
    prompt = f"""Please convert the following text into a well-formatted LaTeX document. 
    Use appropriate LaTeX commands for:
    - Section headers
    - Lists and bullet points
    - Mathematical expressions
    - Tables if present
    - Citations if present
    - Special characters and symbols
    
    Here's the text to convert:
    
    {text}
    
    Please provide only the LaTeX code, starting with \\documentclass and ending with \\end{{document}}.
    """
    
    data = {
        "model": "claude-3-7-sonnet-20250219",
        "max_tokens": 4096,
        "messages": [{
            "role": "user",
            "content": prompt
        }]
    }
    
    try:
        response = requests.post(url, json=data, headers=headers)
        response.raise_for_status()
        return response.json()['content'][0]['text']
    except Exception as e:
        print(f"Error calling Claude API: {str(e)}")
        # Fallback to basic conversion if API call fails
        return basic_latex_conversion(text)

def basic_latex_conversion(text):
    """
    Basic fallback conversion if Claude API fails.
    """
    latex_template = r"""
\documentclass{article}
\usepackage[utf8]{inputenc}
\usepackage{amsmath}
\usepackage{graphicx}

\title{Converted Document}
\author{LaTeX Converter}
\date{\today}

\begin{document}

\maketitle

%s

\end{document}
"""
    
    # Process the text
    # Replace special characters
    text = text.replace('&', '\\&')
    text = text.replace('%', '\\%')
    text = text.replace('$', '\\$')
    text = text.replace('#', '\\#')
    text = text.replace('_', '\\_')
    text = text.replace('{', '\\{')
    text = text.replace('}', '\\}')
    
    # Add paragraph breaks
    text = text.replace('\n\n', '\n\n\\par\n')
    
    return latex_template % text