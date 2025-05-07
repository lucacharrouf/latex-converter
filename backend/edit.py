import sys
import argparse
from api import convert_text_to_latex

def edit_document(tex_content, instructions):
    try:
        # Use the convert_text_to_latex function with edit_instructions
        edited_tex = convert_text_to_latex(tex_content, instructions)
        print(edited_tex)  # Print the result to stdout
        return True
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Edit LaTeX document.")
    parser.add_argument('--tex', required=True, help='Current LaTeX content')
    parser.add_argument('--instructions', required=True, help='Edit instructions')
    args = parser.parse_args()
    
    success = edit_document(args.tex, args.instructions)
    sys.exit(0 if success else 1) 