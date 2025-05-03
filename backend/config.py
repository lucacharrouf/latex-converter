import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from .env file in root directory
dotenv_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path)

# Get API key from environment variables
CLAUDE_API_KEY = os.getenv('CLAUDE_API_KEY')

if not CLAUDE_API_KEY:
    raise ValueError("CLAUDE_API_KEY not found in .env file") 