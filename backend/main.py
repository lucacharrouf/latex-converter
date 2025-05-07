from flask import Flask, request, jsonify
from flask_cors import CORS
from text_extractor import extract_text
import tempfile
import os
from api import convert_text_to_latex
import sys
import argparse

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:5173"}})

@app.route("/api/convert", methods=["POST"])
def convert_file():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400
        
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400
        
    # Create a temporary file to store the upload
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_file:
        file.save(temp_file.name)
        temp_file.flush()
        
        try:
            # Extract text from the file
            text = extract_text(temp_file.name)
            
            # Convert text to LaTeX
            latex = convert_text_to_latex(text)
            
            return jsonify({"output": latex})
        except Exception as e:
            return jsonify({"error": str(e)}), 500
        finally:
            # Clean up the temporary file
            os.unlink(temp_file.name)

@app.route('/api/edit', methods=['POST'])
def edit_document():
    try:
        data = request.json
        current_tex = data.get('currentTex')
        edit_instructions = data.get('instructions')
        
        if not current_tex or not edit_instructions:
            return jsonify({'error': 'Missing required fields'}), 400
            
        edited_tex = convert_text_to_latex(current_tex, edit_instructions)
        return jsonify({'output': edited_tex})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def convert_document(input_path, output_path):
    try:
        # Extract text from the file
        text = extract_text(input_path)
        
        # Convert text to LaTeX
        latex = convert_text_to_latex(text)
        
        # Write the output
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(latex)
            
        print(f"Conversion successful. Output written to {output_path}")
        return True
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert document to LaTeX.")
    parser.add_argument('--input', required=True, help='Input file path')
    parser.add_argument('--output', required=True, help='Output LaTeX file path')
    args = parser.parse_args()
    
    success = convert_document(args.input, args.output)
    sys.exit(0 if success else 1)