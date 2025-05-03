from pdf_to_text import extract_text_from_pdf
from api import convert_text_to_latex
import os
import argparse
import sys

def main():
    print("Starting PDF to LaTeX conversion")
    parser = argparse.ArgumentParser(description='Convert PDF to LaTeX')
    parser.add_argument('--input', required=True, help='Input PDF file path')
    parser.add_argument('--output', required=True, help='Output LaTeX file path')
    args = parser.parse_args()

    print(f"Input file: {args.input}")
    print(f"Output file: {args.output}")

    if not os.path.exists(args.input):
        print(f"Error: Input file {args.input} does not exist")
        sys.exit(1)

    print("Extracting text from PDF...")
    text = extract_text_from_pdf(args.input)
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