import express from 'express';
import multer from 'multer';
import { supabase } from './db.js';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer();
const router = express.Router();

// Function to run Python script
async function runPythonScript(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    console.log('Starting Python script with:');
    console.log('Input:', inputPath);
    console.log('Output:', outputPath);

    const pythonProcess = spawn('python3', [
      path.join(__dirname, 'main.py'),
      '--input', inputPath,
      '--output', outputPath
    ]);

    let stdoutData = '';
    let stderrData = '';

    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
      console.log(`Python Output: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
      console.error(`Python Error: ${data}`);
    });

    pythonProcess.on('close', (code) => {
      console.log(`Python process exited with code ${code}`);
      if (code === 0) {
        resolve(stdoutData);
      } else {
        reject(new Error(`Python script failed: ${stderrData}`));
      }
    });
  });
}

router.post('/upload', upload.single('file'), async (req, res) => {
  console.log('Received file upload request');
  const file = req.file;

  if (!file) {
    console.log('No file received');
    return res.status(400).json({ error: 'No file uploaded' });
  }

  console.log('File received:', file.originalname);

  // Create a proper path structure for the file
  const storagePath = `uploads/${Date.now()}_${file.originalname}`;

  // Save the file temporarily
  const tempFilePath = path.join(__dirname, 'temp', file.originalname);
  const outputDir = path.join(__dirname, '..', 'outputs');
  const outputPath = path.join(outputDir, 'output.tex');
  
  console.log('Temp file path:', tempFilePath);
  console.log('Output directory:', outputDir);
  
  // Ensure temp and outputs directories exist
  if (!fs.existsSync(path.join(__dirname, 'temp'))) {
    console.log('Creating temp directory');
    fs.mkdirSync(path.join(__dirname, 'temp'));
  }
  if (!fs.existsSync(outputDir)) {
    console.log('Creating outputs directory');
    fs.mkdirSync(outputDir);
  }

  try {
    // Save the uploaded file temporarily
    console.log('Saving file temporarily');
    fs.writeFileSync(tempFilePath, file.buffer);
    console.log('File saved successfully');

    // Upload to Supabase Storage
    console.log('Uploading to Supabase');
    const { data, error } = await supabase.storage
      .from('docs')
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw new Error(error.message);
    }
    console.log('Supabase upload successful');

    // Run the Python script
    console.log('Starting PDF to LaTeX conversion');
    await runPythonScript(tempFilePath, outputPath);
    console.log('PDF to LaTeX conversion completed');

    // Verify the output file exists
    if (!fs.existsSync(outputPath)) {
      throw new Error('LaTeX output file was not created');
    }

    // Clean up the temporary file
    console.log('Cleaning up temporary file');
    fs.unlinkSync(tempFilePath);

    res.json({ 
      success: true, 
      storagePath: storagePath,
      latexOutput: 'output.tex'
    });

  } catch (error) {
    console.error('Error in upload process:', error);
    // Clean up the temporary file if it exists
    if (fs.existsSync(tempFilePath)) {
      console.log('Cleaning up temporary file after error');
      fs.unlinkSync(tempFilePath);
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;