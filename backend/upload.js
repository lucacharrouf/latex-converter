import express from 'express';
import multer from 'multer';
import { supabase } from './db.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import cors from 'cors';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Function to run Python script
async function runPythonConversion(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    console.log('Running Python conversion script');
    console.log(`Input path: ${inputPath}`);
    console.log(`Output path: ${outputPath}`);
    
    const pythonProcess = spawn('python3', [
      path.join(__dirname, 'main.py'),
      '--input', inputPath,
      '--output', outputPath
    ]);

    pythonProcess.stdout.on('data', (data) => {
      console.log('Python script output:', data.toString());
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error('Python script error:', data.toString());
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python script exited with code ${code}`);
        reject(new Error(`Python script failed with code ${code}`));
      } else {
        console.log('Python conversion completed successfully');
        resolve();
      }
    });
  });
}

// Function to edit document using Python script
async function editDocument(currentTex, instructions) {
  return new Promise((resolve, reject) => {
    console.log('Running Python edit script');
    
    const pythonProcess = spawn('python3', [
      path.join(__dirname, 'edit.py'),
      '--tex', currentTex,
      '--instructions', instructions
    ]);

    let output = '';
    let error = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      error += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python script exited with code ${code}`);
        reject(new Error(error || `Python script failed with code ${code}`));
      } else {
        console.log('Python edit completed successfully');
        resolve(output.trim());
      }
    });
  });
}

router.post('/upload', upload.single('file'), async (req, res) => {
    console.log('Received file upload request');
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);
    
    const file = req.file;
  
    if (!file) {
      console.log('No file received');
      return res.status(400).json({ error: 'No file uploaded' });
    }
  
    console.log('File received:', file.originalname);
    console.log('File size:', file.size);
    console.log('File mimetype:', file.mimetype);
  
    // Create proper path structure
    const timestamp = Date.now();
    const storagePath = `uploads/${timestamp}_${file.originalname}`;
    console.log('Storage path:', storagePath);
    
    // Create absolute paths for local processing
    const tempDir = path.join(__dirname, 'temp');
    const outputDir = path.join(__dirname, '..', 'outputs');
    const tempFilePath = path.join(tempDir, file.originalname);
    const outputPath = path.join(outputDir, `${timestamp}_output.tex`);
    
    console.log('Temp directory:', tempDir);
    console.log('Output directory:', outputDir);
    console.log('Temp file path:', tempFilePath);
    console.log('Output path:', outputPath);
    
    // Ensure directories exist
    if (!fs.existsSync(tempDir)) {
      console.log('Creating temp directory');
      fs.mkdirSync(tempDir, { recursive: true });
    }
    if (!fs.existsSync(outputDir)) {
      console.log('Creating output directory');
      fs.mkdirSync(outputDir, { recursive: true });
    }
  
    try {
      // Save file temporarily
      console.log('Saving file temporarily to:', tempFilePath);
      fs.writeFileSync(tempFilePath, file.buffer);
      
      // Upload to Supabase Storage
      console.log('Uploading to Supabase storage');
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
      console.log('Supabase storage upload successful:', data);
      
      // Create record in docs table
      console.log('Creating database record');
      const { data: docRecord, error: docError } = await supabase
        .from('docs')
        .insert([{
          original_filename: file.originalname,
          pdf_storage_path: storagePath
        }])
        .select();
  
      if (docError) {
        console.error('Database insert error:', docError);
        throw new Error(docError.message);
      }
      console.log('Database record created:', docRecord);
  
      // Run Python conversion script
      try {
        await runPythonConversion(tempFilePath, outputPath);
        console.log('Conversion completed successfully');
        
        // Get relative path for storage
        const latexStoragePath = `outputs/${path.basename(outputPath)}`;
        console.log('LaTeX storage path:', latexStoragePath);
        
        // Read the LaTeX file content
        const latexContent = fs.readFileSync(outputPath, 'utf-8');
        
        // Update database with LaTeX path
        console.log('Updating database record with LaTeX path');
        const { error: updateError } = await supabase
          .from('docs')
          .update({ latex_storage_path: latexStoragePath })
          .eq('id', docRecord[0].id);

        if (updateError) {
          console.error('Database update error:', updateError);
        }
        
        // Clean up temp file
        console.log('Cleaning up temporary file');
        fs.unlinkSync(tempFilePath);
        
        res.json({ 
          success: true, 
          path: storagePath,
          output: latexStoragePath,
          documentId: docRecord[0].id,
          latexContent
        });
      } catch (conversionError) {
        console.error('Conversion error:', conversionError);
        throw conversionError;
      }
  
    } catch (error) {
      console.error('Error in upload process:', error);
      // Clean up temp file if it exists
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      res.status(500).json({ error: error.message });
    }
});

// New endpoint for document editing
router.post('/edit', async (req, res) => {
  try {
    const { currentTex, instructions } = req.body;
    
    if (!currentTex || !instructions) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const editedTex = await editDocument(currentTex, instructions);
    res.json({ output: editedTex, latexContent: editedTex });
    
  } catch (error) {
    console.error('Error in edit process:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to download a file from the outputs directory
router.get('/download/:filename', async (req, res) => {
  console.log('Download route hit:', req.params.filename);
  const filename = req.params.filename;
  const outputDir = path.join(__dirname, '..', 'outputs');
  const filePath = path.join(outputDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.download(filePath, filename, (err) => {
    if (err) {
      console.error('Error sending file:', err);
      res.status(500).json({ error: 'Error sending file' });
    }
  });
});

// New endpoint to serve the contents of a .tex file
router.get('/latex/:filename', async (req, res) => {
  const filename = req.params.filename;
  const outputDir = path.join(__dirname, '..', 'outputs');
  const filePath = path.join(outputDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    res.type('text/plain').send(content);
  } catch (err) {
    res.status(500).json({ error: 'Could not read file' });
  }
});

// Fallback for unmatched download routes
router.get('/download*', (req, res) => {
  res.status(404).json({ error: 'Download route not found' });
});

const app = express();
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:8081'], credentials: true }));

export default router;