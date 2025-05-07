from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from text_extractor import extract_text
import tempfile
import os
from api import convert_text_to_latex

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/convert")
async def convert_file(file: UploadFile = File(...)):
    # Create a temporary file to store the upload
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_file:
        content = await file.read()
        temp_file.write(content)
        temp_file.flush()
        
        try:
            # Extract text from the file
            text = extract_text(temp_file.name)
            
            # Convert text to LaTeX
            latex = convert_text_to_latex(text)
            
            return {"latex": latex}
        except Exception as e:
            return {"error": str(e)}
        finally:
            # Clean up the temporary file
            os.unlink(temp_file.name)

if __name__ == "__main__":
    import sys
    import argparse
    if len(sys.argv) > 1:
        # CLI mode
        parser = argparse.ArgumentParser(description="Convert document to LaTeX.")
        parser.add_argument('--input', required=True, help='Input file path')
        parser.add_argument('--output', required=True, help='Output LaTeX file path')
        args = parser.parse_args()
        try:
            text = extract_text(args.input)
            latex = convert_text_to_latex(text)
            with open(args.output, 'w', encoding='utf-8') as f:
                f.write(latex)
            print(f"Conversion successful. Output written to {args.output}")
        except Exception as e:
            print(f"Error: {e}")
            sys.exit(1)
    else:
        import uvicorn
        uvicorn.run(app, host="0.0.0.0", port=5000)