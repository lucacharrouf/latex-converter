import os
import sys
import argparse
from pathlib import Path

# Add the current directory to Python path
current_dir = Path(__file__).parent
sys.path.append(str(current_dir))

from text_extractor import extract_text
from api import convert_text_to_latex

def main():
    print("Starting document to LaTeX conversion")
    parser = argparse.ArgumentParser(description='Convert document to LaTeX')
    parser.add_argument('--input', required=True, help='Input file path (PDF, DOCX, or PPTX)')
    parser.add_argument('--output', required=True, help='Output LaTeX file path')
    args = parser.parse_args()

    print(f"Input file: {args.input}")
    print(f"Output file: {args.output}")

    if not os.path.exists(args.input):
        print(f"Error: Input file {args.input} does not exist")
        sys.exit(1)

    print("Extracting text from document...")
    text = extract_text(args.input)
    print("Text extracted successfully")

    print("Converting to LaTeX...")
    latex_code = convert_text_to_latex(text)
    print("Conversion completed")

    print(f"Writing LaTeX to {args.output}")
    with open(args.output, "w") as f:
        f.write(latex_code)
    print("LaTeX code saved successfully")

if __name__ == "__main__":
    main()